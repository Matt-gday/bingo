// Makes the game's sound effects with ElevenLabs Sound Effects.
//
//   npm run sounds          lists the sounds and what is still to make (spends nothing)
//   npm run sounds:sample   makes three so you can listen first
//   npm run sounds:make     makes everything that is missing
//   npm run sounds:normalize  brings every sound already made up to an even level (also done to each new sound)
//   npm run sounds:tester   writes sounds-tester.html, a page to listen to every sound
//
// To make only some: add --only and part of a group or sound name, for example
//   npm run sounds:make -- --only Marking
//
// The key is read from the .env file (ELEVENLABS_API_KEY), never stored in the game or the repository.
// Sounds go in public/audio/sfx/ and are listed in manifest.json, which the game reads.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTesterPage } from './voice-tester-page.mjs';
import { normalizeMp3 } from './normalize.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? '') : undefined);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const data = JSON.parse(readFileSync(join(root, 'Data/sounds.json'), 'utf8'));
const outDir = join(root, 'public/audio/sfx');
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { sounds: {}, hashes: {} };
manifest.sounds ??= {};
manifest.hashes ??= {};

// Which takes of a sound are used: normally 1 to `variants`, or exactly the numbers listed in `keepTakes`
// (for example [5] keeps only take 5 of a sound that was tried six times).
const takeNumbers = (sound) => sound.keepTakes ?? Array.from({ length: sound.variants ?? 1 }, (_, i) => i + 1);
const takeOf = (sound, n) => ({ sound, n, key: `${sound.id}-${n}` });

const only = option('--only');
const chosen = data.sounds.filter((s) => !only || s.id.includes(only) || s.group.toLowerCase().includes(only.toLowerCase()));

// One entry for every take of every sound.
const takes = chosen.flatMap((s) => takeNumbers(s).map((n) => takeOf(s, n)));
const fingerprint = ({ sound, n }) => createHash('sha1')
  .update(JSON.stringify([sound.prompt, sound.seconds, data.promptInfluence, data.model, n]))
  .digest('hex').slice(0, 10);
const fileFor = (take) => `${take.key}-${fingerprint(take)}.mp3`;
const isMade = (take) => manifest.hashes[take.key] === fingerprint(take) && existsSync(join(outDir, fileFor(take)));
const todo = takes.filter((t) => !isMade(t));

function writeManifest() {
  // The game reads this: for each sound, its files and how loud to play it.
  manifest.sounds = {};
  for (const s of data.sounds) {
    const files = takeNumbers(s).map((n) => takeOf(s, n))
      .filter((t) => manifest.hashes[t.key] === fingerprint(t) && existsSync(join(outDir, fileFor(t))))
      .map(fileFor);
    if (files.length) manifest.sounds[s.id] = { files, volume: s.volume ?? 0.8 };
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function saveManifest({ final = false } = {}) {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      writeManifest();
      return;
    } catch (error) {
      await sleep(300 * attempt);
      if (attempt === 12 && final) throw error;
    }
  }
}

if (args.includes('--normalize')) {
  // Re-levels every sound that has already been made. Safe to run again: a sound already at the level stays as it is.
  let changed = 0;
  const silent = [];
  for (const take of takes.filter((t) => existsSync(join(outDir, fileFor(t))))) {
    const path = join(outDir, fileFor(take));
    const result = await normalizeMp3(readFileSync(path));
    if (result.silent) {
      silent.push(take.key);
      continue;
    }
    if (Math.abs(result.beforeDb - result.afterDb) > 0.5) {
      writeFileSync(path, result.buffer);
      changed += 1;
      console.log(`  ${take.key.padEnd(18)} ${result.beforeDb.toFixed(1)} dB -> ${result.afterDb.toFixed(1)} dB`);
    }
  }
  console.log(`
${changed} sounds re-levelled.${silent.length ? ` Silent takes (not changed, best remade): ${silent.join(', ')}` : ''}
`);
  process.exit(0);
}

if (args.includes('--tester')) {
  mkdirSync(outDir, { recursive: true });
  const groups = [...new Set(data.sounds.map((s) => s.group))];
  const sections = groups.map((group) => ({
    id: group.replace(/\W+/g, '-').toLowerCase(),
    title: group,
    blurb: '',
    rows: data.sounds.filter((s) => s.group === group).flatMap((s) => takeNumbers(s).map((n) => {
      const take = takeOf(s, n);
      return {
        text: `${s.id}${takeNumbers(s).length > 1 ? ` (take ${n})` : ''}: ${s.when}`,
        file: isMade(take) ? fileFor(take) : null,
        tag: s.prompt,
      };
    })),
  }));
  writeFileSync(join(root, 'sounds-tester.html'), buildTesterPage({ title: 'Sound effects tester', sections, audioFolder: 'public/audio/sfx/' }));
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  console.log(`Wrote sounds-tester.html with ${total} sounds (${total - todo.length} made).`);
  process.exit(0);
}

const seconds = (list) => list.reduce((sum, t) => sum + (t.sound.seconds ?? 1), 0);
console.log('\nSound effects\n');
for (const group of [...new Set(chosen.map((s) => s.group))]) {
  const inGroup = takes.filter((t) => t.sound.group === group);
  console.log(`  ${String(inGroup.length).padStart(3)}  ${group}`);
}
console.log(`\n  ${takes.length} sounds in all (${takes.length - todo.length} already made), ${todo.length} still to make.`);
console.log(`  Together they last about ${seconds(todo).toFixed(0)} seconds. Check how your ElevenLabs plan counts sound effects.\n`);

const wantsSample = args.includes('--sample');
if (!wantsSample && !args.includes('--make')) {
  console.log('Nothing was made. Run "npm run sounds:sample" to try three first.\n');
  process.exit(0);
}

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const path = join(root, '.env');
  if (!existsSync(path)) return '';
  const match = readFileSync(path, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?(.*?)["']?\s*$/m);
  return match ? match[1] : '';
}
const apiKey = readKey();
if (!apiKey) {
  console.error('No ElevenLabs key found in .env\n');
  process.exit(1);
}

const sampleIds = ['mark-pop', 'lock-thud', 'win-fanfare'];
const queue = wantsSample ? takes.filter((t) => sampleIds.includes(t.sound.id) && t.n === 1) : todo;

async function make(take) {
  const url = `https://api.elevenlabs.io/v1/sound-generation?output_format=${data.outputFormat}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: take.sound.prompt,
        duration_seconds: take.sound.seconds,
        prompt_influence: data.promptInfluence,
        model_id: data.model,
      }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const detail = await response.text();
    if (response.status === 429 && attempt < 4) {
      await sleep(2000 * attempt);
      continue;
    }
    throw Object.assign(new Error(`ElevenLabs said ${response.status}: ${detail.slice(0, 300)}`), { status: response.status });
  }
  throw new Error('Gave up after several tries.');
}

mkdirSync(outDir, { recursive: true });
let made = 0;
try {
  for (const take of queue) {
    process.stdout.write(`  ${String(made + 1).padStart(3)}/${queue.length}  ${take.key}\n`);
    const result = await normalizeMp3(await make(take));
    if (result.silent) {
      console.warn(`      (that take came out silent, so it was skipped: ${take.key})`);
      made += 1;
      continue;
    }
    writeFileSync(join(outDir, fileFor(take)), result.buffer);
    manifest.hashes[take.key] = fingerprint(take);
    made += 1;
    if (made % 5 === 0) await saveManifest();
    await sleep(300);
  }
  await saveManifest({ final: true });
  console.log(`\nDone. ${made} made into public/audio/sfx/.\n`);
} catch (error) {
  await saveManifest();
  console.error(`\nStopped after ${made} made: ${error.message}`);
  if (error.status === 401 || error.status === 403) console.error('The key was not accepted for Sound Effects. Check it has Sound Effects access.');
  if (error.status === 402 || /quota/i.test(error.message)) console.error('You may be out of credits. Run it again later; it carries on where it stopped.');
  console.error('Everything made so far is saved, so running it again carries on.\n');
  process.exit(1);
}
