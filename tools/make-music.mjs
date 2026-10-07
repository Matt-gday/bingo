// Makes the game's background music with ElevenLabs Music.
//
//   npm run music          lists the tracks and what is still to make (spends nothing)
//   npm run music:make     makes every track that is missing
//   npm run music:tester   writes music-tester.html, a page to listen to the tracks
//
// The key is read from the .env file (ELEVENLABS_API_KEY), never stored in the game or the repository.
// Tracks go in public/audio/music/ and are listed in manifest.json.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTesterPage } from './voice-tester-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const data = JSON.parse(readFileSync(join(root, 'Data/music.json'), 'utf8'));
const outDir = join(root, 'public/audio/music');
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { tracks: {}, hashes: {} };
manifest.tracks ??= {};
manifest.hashes ??= {};

const fingerprint = (t) => createHash('sha1').update(JSON.stringify([t.prompt, t.seconds, data.model])).digest('hex').slice(0, 10);
const fileFor = (t) => `${t.id}-${fingerprint(t)}.mp3`;
const isMade = (t) => manifest.hashes[t.id] === fingerprint(t) && existsSync(join(outDir, fileFor(t)));
const todo = data.tracks.filter((t) => !isMade(t));

function writeManifest() {
  mkdirSync(outDir, { recursive: true });
  manifest.tracks = {};
  for (const t of data.tracks) if (isMade(t)) manifest.tracks[t.id] = { file: fileFor(t), volume: t.volume ?? 0.3 };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (args.includes('--tester')) {
  const rows = data.tracks.map((t) => ({ text: `${t.id}: ${t.when}`, file: isMade(t) ? fileFor(t) : null, tag: t.prompt }));
  writeFileSync(join(root, 'music-tester.html'), buildTesterPage({
    title: 'Background music tester',
    sections: [{ id: 'music', title: 'Tracks', blurb: 'Each track is meant to loop quietly behind the game.', rows }],
    audioFolder: 'public/audio/music/',
  }));
  console.log(`Wrote music-tester.html with ${rows.length} tracks (${rows.filter((r) => r.file).length} made).`);
  process.exit(0);
}

console.log('\nBackground music\n');
for (const t of data.tracks) console.log(`  ${isMade(t) ? 'made   ' : 'to make'}  ${t.id} (${t.seconds}s)  ${t.when}`);
console.log(`\n  ${todo.length} still to make, ${todo.reduce((n, t) => n + t.seconds, 0)} seconds of music in all. Check how your ElevenLabs plan counts music.\n`);
if (!args.includes('--make')) {
  console.log('Nothing was made. Run "npm run music:make" to make them.\n');
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

mkdirSync(outDir, { recursive: true });
let made = 0;
for (const t of todo) {
  process.stdout.write(`  making ${t.id}...\n`);
  const response = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${data.outputFormat}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ prompt: t.prompt, music_length_ms: t.seconds * 1000, model_id: data.model, force_instrumental: true }),
  });
  if (!response.ok) {
    console.error(`\nStopped at ${t.id}: ElevenLabs said ${response.status} ${(await response.text()).slice(0, 300)}`);
    if (response.status === 401 || response.status === 403) console.error('The key may not have Music Generation access. Edit the key in ElevenLabs and set Music Generation to Access.');
    writeManifest();
    process.exit(1);
  }
  writeFileSync(join(outDir, fileFor(t)), Buffer.from(await response.arrayBuffer()));
  manifest.hashes[t.id] = fingerprint(t);
  made += 1;
  writeManifest();
}
writeManifest();
console.log(`\nDone. ${made} made into public/audio/music/.\n`);
