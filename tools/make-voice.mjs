// Makes the caller's recorded voice with ElevenLabs.
//
//   npm run voice:list     writes every line to Docs/voice-lines.txt so you can read them
//   npm run voice          counts what would be recorded and spends nothing
//   npm run voice:sample   records just three numbers so you can listen first
//   npm run voice:make     records everything that is missing
//
// Delivery: Data/voice.json has an "audioTag" (for example "[warmly, cheerfully]") that is put in front
// of each line when it is sent. Eleven v3 and v4 read it as a direction for how to say the line.
// To try one without editing the file: npm run voice:sample -- --tag "[softly, smiling]"
//
// To record only some kinds of line, add --only and part of a group name from the list the first
// command prints. For example: npm run voice:make -- --only numbers
//
// The ElevenLabs key is read from a file called .env (which git ignores) or from the
// ELEVENLABS_API_KEY environment variable. It is never stored in the game or the repository.
// Recordings go in public/audio/caller/ and are listed in manifest.json, which the game reads.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLines, allLines, groupOf } from './voice-lines.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

const args = process.argv.slice(2);
const wantsSample = args.includes('--sample');
const wantsMake = args.includes('--make') || wantsSample;
const force = args.includes('--force');

function readEnvFile() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const input = {
  callerLines: readJson('Data/caller-lines.json'),
  patterns: readJson('Data/patterns.json'),
  regulars: readJson('Data/regulars.json'),
};
const voice = readJson('Data/voice.json');
// Try a different delivery without editing the file:  npm run voice:sample -- --tag "[softly, smiling]"
const option = (name) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? '') : undefined);
if (option('--tag') !== undefined) voice.audioTag = option('--tag');
if (option('--model') !== undefined) voice.modelId = option('--model');
const only = args.includes('--only') ? (args[args.indexOf('--only') + 1] ?? '') : '';
const allGroups = collectLines(input);
const groups = only ? Object.fromEntries(Object.entries(allGroups).filter(([name]) => name.includes(only))) : allGroups;
const lines = only ? [...new Set(Object.values(groups).flat())] : allLines(input);
if (only && lines.length === 0) {
  console.error(`No group has "${only}" in its name. Run "npm run voice" to see the groups.
`);
  process.exit(1);
}

// How a line is delivered: its own tag if it has one, else its group's tag, else the default.
const lineGroups = groupOf(allGroups);
const tags = voice.audioTags ?? { default: voice.audioTag ?? '' };
const tagFor = (text) => (option('--tag') !== undefined ? voice.audioTag : (tags.lines?.[text] ?? tags.groups?.[lineGroups.get(text)] ?? tags.default ?? ''));

const outDir = join(root, 'public/audio/caller');
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { clips: {}, hashes: {} };
manifest.hashes ??= {};

// A clip is remade if the text, the voice or any voice setting changes.
const fingerprint = (text) => createHash('sha1')
  .update(JSON.stringify([text, voice.voiceId, voice.modelId, tagFor(text), voice.stability, voice.similarityBoost, voice.style, voice.speed]))
  .digest('hex')
  .slice(0, 12);

const todo = lines.filter((text) => force || manifest.hashes[text] !== fingerprint(text) || !existsSync(join(outDir, manifest.clips[text] ?? '')));
const characters = (list) => list.reduce((sum, text) => sum + text.length, 0);

if (args.includes('--list')) {
  const text = Object.entries(groups)
    .map(([group, list]) => `== ${group} (${list.length}) ==\n${list.join('\n')}`)
    .join('\n\n');
  writeFileSync(join(root, 'Docs/voice-lines.txt'), `${text}\n`);
  console.log(`Wrote ${lines.length} lines to Docs/voice-lines.txt`);
  process.exit(0);
}

console.log('\nCaller recordings\n');
for (const [group, list] of Object.entries(groups)) console.log(`  ${String(list.length).padStart(4)}  ${group}`);
console.log(`\n  ${lines.length} lines in all, ${manifest.clips ? Object.keys(manifest.clips).length : 0} already recorded.`);
console.log(`  ${todo.length} still to record, using about ${characters(todo).toLocaleString()} characters of your ElevenLabs allowance.`);
console.log('  (Prize-table lines are not included yet. They come after that part of the game is built.)\n');

if (!wantsMake) {
  console.log('Nothing was recorded. Run "npm run voice:sample" to try three numbers first.\n');
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY ?? readEnvFile().ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('No ElevenLabs key found. Put this line in a file called .env in the project folder:\n  ELEVENLABS_API_KEY=your-key-here\n');
  process.exit(1);
}
if (!voice.voiceId) {
  console.error('There is no voice yet. Put your voice ID in Data/voice.json, next to "voiceId".\n');
  process.exit(1);
}

// For the sample, one line in each style so you can judge the voice properly.
const sampleTexts = [
  'Forty-five...', // the card check
  "That's a line. Well played!", // a win
  "Ooh, unlucky. I haven't called thirty-four yet.", // a false call
  "Sit down, Dot, that's not a line.", // a regular told off
  'Rex has it! Well done, Rex.', // a regular wins
  'No peeking! Your cards are covered.', // the pause
];
const queue = wantsSample ? sampleTexts.filter((t) => lines.includes(t)) : todo;

mkdirSync(outDir, { recursive: true });
let made = 0;

async function record(text) {
  const body = {
    // The tag is only sent to ElevenLabs. The game still looks the clip up by the plain line.
    text: tagFor(text) ? `${tagFor(text)} ${text}` : text,
    model_id: voice.modelId,
    voice_settings: {
      stability: voice.stability,
      similarity_boost: voice.similarityBoost,
      style: voice.style,
      use_speaker_boost: true,
      ...(voice.speed ? { speed: voice.speed } : {}),
    },
  };
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=${voice.outputFormat}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const detail = await response.text();
    if (response.status === 429 && attempt < 4) {
      await sleep(2000 * attempt); // too many at once: wait and try again
      continue;
    }
    throw Object.assign(new Error(`ElevenLabs said ${response.status}: ${detail.slice(0, 300)}`), { status: response.status });
  }
  throw new Error('Gave up after several tries.');
}

try {
  for (const text of queue) {
    const hash = fingerprint(text);
    const file = `${hash}.mp3`;
    process.stdout.write(`  ${String(made + 1).padStart(3)}/${queue.length}  ${text}\n`);
    writeFileSync(join(outDir, file), await record(text));
    manifest.clips[text] = file;
    manifest.hashes[text] = hash;
    manifest.voice = voice.voiceId;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`); // saved as we go, so a stop loses nothing
    made += 1;
    await sleep(200);
  }
  console.log(`\nDone. ${made} recorded into public/audio/caller/.\n`);
} catch (error) {
  console.error(`\nStopped after ${made} recorded: ${error.message}`);
  if (error.status === 401) console.error('The key was not accepted. Check the line in your .env file.');
  if (error.status === 402 || /quota/i.test(error.message)) console.error('You may be out of characters for this month. Run it again later; it carries on where it stopped.');
  console.error('Everything recorded so far is saved, so running it again carries on.\n');
  process.exit(1);
}
