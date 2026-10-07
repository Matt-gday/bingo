import test from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../src/audio/voice.js';

function withFakes(t, { audioPlays = true } = {}) {
  const log = [];
  const synth = {
    paused: false, speaking: false, pending: false,
    getVoices: () => [],
    resume() {},
    cancel() { log.push('cancel-speech'); },
    speak(u) { log.push(`speech:${u.text}`); },
  };
  class FakeAudio {
    pause() { log.push('pause-clip'); }
    play() { log.push(`clip:${this.src}`); return audioPlays ? Promise.resolve() : Promise.reject(new Error('blocked')); }
  }
  const keep = Object.fromEntries(['window', 'SpeechSynthesisUtterance', 'navigator', 'Audio'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-AU' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { speechSynthesis: synth } });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(keep)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const voice = new Voice({ voice: { rate: 1, pitch: 1 } }, { get: () => true, set() {} });
  voice.clips = { 'Eight, Garden gate!': 'abc.mp3' };
  voice.clipBase = './audio/caller/';
  return { voice, log };
}

test('a line with a recording plays the recording, not the phone voice', (t) => {
  const { voice, log } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  assert.ok(log.includes('clip:./audio/caller/abc.mp3'));
  assert.ok(!log.some((entry) => entry.startsWith('speech:')));
});

test('a line without a recording is spoken by the phone', (t) => {
  const { voice, log } = withFakes(t);
  voice.speak('Something new');
  assert.ok(log.includes('speech:Something new'));
  assert.ok(!log.some((entry) => entry.startsWith('clip:')));
});

test('if the recording cannot play, the phone voice takes over', async (t) => {
  const { voice, log } = withFakes(t, { audioPlays: false });
  voice.speak('Eight, Garden gate!');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(log.includes('speech:Eight, Garden gate!'));
});

test('cancelling stops the recording as well as the phone voice', (t) => {
  const { voice, log } = withFakes(t);
  voice.speak('Eight, Garden gate!');
  voice.cancel();
  assert.ok(log.includes('pause-clip'));
});

test('a line replaced by a newer one does not stop the newer line when the old one is cancelled', async (t) => {
  const log = [];
  const { voice } = withFakes(t);
  voice.clips['Eight, Garden gate!'] = 'a.mp3';
  voice.clips['No line'] = 'b.mp3';
  let rejectFirst;
  let plays = 0;
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    value: class {
      pause() { log.push('pause'); }
      play() {
        plays += 1;
        if (plays === 1) return new Promise((_, reject) => { rejectFirst = reject; });
        return Promise.resolve();
      }
    },
  });
  voice.player = null;
  voice.speak('Eight, Garden gate!');
  voice.speak('No line');
  rejectFirst(new Error('The play() request was interrupted by a new load request'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(log, [], 'nothing was paused or spoken by phone after the older line was cancelled');
});
