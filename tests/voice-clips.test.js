import test from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../src/audio/voice.js';

// A pretend audio engine that writes down what it is asked to do.
function fakeEngine(log, { loads = true } = {}) {
  return {
    ensure: () => true,
    load: (url) => (loads ? Promise.resolve({ url }) : Promise.reject(new Error('missing'))),
    play(buffer, options) {
      log.push(`clip:${buffer.url}`);
      const handle = {
        stop(seconds) { log.push(`fade:${buffer.url}:${seconds}`); },
        end() { options.onended(); },
      };
      this.last = handle;
      return handle;
    },
  };
}

function withFakes(t, { loads = true } = {}) {
  const log = [];
  const synth = {
    paused: false, speaking: false, pending: false,
    getVoices: () => [],
    resume() {},
    cancel() { log.push('cancel-speech'); },
    speak(u) { log.push(`speech:${u.text}`); },
  };
  const keep = Object.fromEntries(['window', 'SpeechSynthesisUtterance', 'navigator'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-AU' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { speechSynthesis: synth } });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(keep)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const engine = fakeEngine(log, { loads });
  const voice = new Voice({ voice: { rate: 1, pitch: 1, fadeMs: 250 } }, { get: () => true, set() {} }, engine);
  voice.clips = { 'Eight, Garden gate!': 'eight.mp3', 'No line': 'line.mp3', 'Nine!': 'nine.mp3' };
  voice.clipBase = './audio/caller/';
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
  return { voice, log, engine, settle };
}

test('a line with a recording plays the recording, not the phone voice', async (t) => {
  const { voice, log, settle } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  await settle();
  assert.ok(log.includes('clip:./audio/caller/eight.mp3'));
  assert.ok(!log.some((entry) => entry.startsWith('speech:')));
});

test('a line without a recording is spoken by the phone', async (t) => {
  const { voice, log, settle } = withFakes(t);
  voice.speak('Something new');
  await settle();
  assert.ok(log.includes('speech:Something new'));
  assert.ok(!log.some((entry) => entry.startsWith('clip:')));
});

test('if the recording cannot be loaded, the phone voice takes over', async (t) => {
  const { voice, log, settle } = withFakes(t, { loads: false });
  voice.speak('Eight, Garden gate!');
  await settle();
  assert.ok(log.includes('speech:Eight, Garden gate!'));
});

test('a new line fades the old recording out instead of cutting it off', async (t) => {
  const { voice, log, settle } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  await settle();
  voice.speak('Nine!');
  await settle();
  assert.ok(log.includes('fade:./audio/caller/eight.mp3:0.25'), 'the old line fades over a quarter of a second');
  assert.ok(log.includes('clip:./audio/caller/nine.mp3'));
  assert.ok(log.indexOf('fade:./audio/caller/eight.mp3:0.25') < log.indexOf('clip:./audio/caller/nine.mp3'));
});

test('a line replaced before it finished loading never plays', async (t) => {
  const { voice, log, settle } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  voice.speak('Nine!'); // before the first one has loaded
  await settle();
  assert.ok(!log.includes('clip:./audio/caller/eight.mp3'));
  assert.ok(log.includes('clip:./audio/caller/nine.mp3'));
});

test('cancelling fades out the recording and stops anything about to start', async (t) => {
  const { voice, log, settle } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  await settle();
  voice.cancel();
  assert.ok(log.includes('fade:./audio/caller/eight.mp3:0.1'));
  voice.speak('Nine!');
  voice.cancel(); // cancelled before it loaded
  await settle();
  assert.ok(!log.includes('clip:./audio/caller/nine.mp3'));
});

test('a protected line is not cut off, and a number that arrives meanwhile is skipped, not delayed', async (t) => {
  const { voice, log, engine, settle } = withFakes(t);
  voice.speak('No line', { protect: true });
  await settle();
  voice.speak('Eight, Garden gate!'); // arrives while the false-call line is playing
  await settle();
  assert.ok(log.includes('clip:./audio/caller/line.mp3'));
  assert.ok(!log.includes('clip:./audio/caller/eight.mp3'), 'skipped');
  assert.ok(!log.some((entry) => entry.startsWith('fade:')), 'and the false-call line was not faded');
  engine.last.end(); // the false-call line finishes
  assert.equal(voice.protecting, false);
  voice.speak('Nine!'); // the next number, arriving after the line, is called as normal
  await settle();
  assert.ok(log.includes('clip:./audio/caller/nine.mp3'));
  assert.ok(!log.includes('clip:./audio/caller/eight.mp3'), 'and the skipped one is never played late');
});

test('cancelling frees the voice', async (t) => {
  const { voice, settle } = withFakes(t);
  voice.speak('No line', { protect: true });
  await settle();
  assert.equal(voice.protecting, true);
  voice.cancel();
  assert.equal(voice.protecting, false);
});
