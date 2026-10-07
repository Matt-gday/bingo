// Makes a few test recordings in the voice-tests/ folder so you can compare ways of saying a line.
// They are NOT used by the game and are not committed. Run:  npm run voice:try
//
// The idea tested here: the number is said in the steady default tone, and a second tag put after it
// gives the nickname its own mood, so the number stays easy to catch.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const voice = JSON.parse(readFileSync(join(root, 'Data/voice.json'), 'utf8'));
const base = voice.audioTags?.default ?? '[warmly, cheerfully, gently]';

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const path = join(root, '.env');
  if (!existsSync(path)) return '';
  const match = readFileSync(path, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?(.*?)["']?\s*$/m);
  return match ? match[1] : '';
}

// [file name, text sent to ElevenLabs]. A = the whole line in one tag (what we have now). B = number steady, nickname coloured.
const tests = [
  ['01-A-eight-garden-gate-same-tone', `${base} Eight, Garden gate!`],
  ['01-B-eight-garden-gate-bright-sing-song', `${base} Eight, [bright, sing-song] Garden gate!`],

  ['02-A-thirteen-unlucky-for-some-same-tone', `${base} Thirteen, Unlucky for some!`],
  ['02-B-thirteen-unlucky-for-some-spooky-giggle', `${base} Thirteen, [spooky, giggling] Unlucky for some!`],

  ['03-A-seventeen-dancing-queen-same-tone', `${base} Seventeen, Dancing queen!`],
  ['03-B-seventeen-dancing-queen-musical', `${base} Seventeen, [musical, sing-song, twirling] Dancing queen!`],

  ['04-A-sixty-six-clickety-click-same-tone', `${base} Sixty-six, Clickety click!`],
  ['04-B-sixty-six-clickety-click-snappy', `${base} Sixty-six, [snappy, rhythmic, bouncy] Clickety click!`],

  ['05-legs-eleven-cheeky', '[cheeky, playful, giggling] Legs eleven!'],
  ['06-twenty-two-two-little-ducks-bouncy', `${base} Twenty-two, [bouncy, playful, cute] Two little ducks!`],
  ['07-seventy-three-queen-bee-buzzing', `${base} Seventy-three, [bubbly, buzzing, delighted] Queen bee!`],
  ['08-three-cup-of-tea-cosy', `${base} Three, [cosy, content, soft] Cup of tea!`],
  ['09-forty-five-halfway-there-encouraging', `${base} Forty-five, [encouraging, upbeat] Halfway there!`],
  ['10-seventy-five-last-ball-triumphant', `${base} Seventy-five, [triumphant, delighted, proud] Strive and strive!`],
];

const key = readKey();
if (!key) {
  console.error('No ElevenLabs key found in .env\n');
  process.exit(1);
}

const out = join(root, 'voice-tests');
mkdirSync(out, { recursive: true });
let characters = 0;

for (const [name, text] of tests) {
  characters += text.length;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=${voice.outputFormat}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: voice.modelId,
      voice_settings: {
        stability: voice.stability, similarity_boost: voice.similarityBoost, style: voice.style, use_speaker_boost: true,
        ...(voice.speed ? { speed: voice.speed } : {}),
      },
    }),
  });
  if (!response.ok) {
    console.error(`\nStopped at ${name}: ElevenLabs said ${response.status} ${(await response.text()).slice(0, 200)}\n`);
    process.exit(1);
  }
  writeFileSync(join(out, `${name}.mp3`), Buffer.from(await response.arrayBuffer()));
  console.log(`  ${name}`);
}
console.log(`\nDone. ${tests.length} clips (about ${characters} characters) in the voice-tests folder.\n`);
