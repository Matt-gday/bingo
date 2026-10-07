import test from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../src/audio/voice.js';

test('caller starts real speech, recovers a paused engine and handles interruptions', (t) => {
  const calls = [];
  const synth = {
    paused: true,
    getVoices: () => [],
    resume() { calls.push('resume'); this.paused = false; },
    cancel() { calls.push('cancel'); },
    speak(utterance) { calls.push(utterance.text); },
  };
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-AU' } });
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { speechSynthesis: synth } });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true, value: class { constructor(text) { this.text = text; } },
  });
  t.after(() => {
    for (const [key, descriptor] of [['window', oldWindow], ['SpeechSynthesisUtterance', oldUtterance], ['navigator', oldNavigator]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  let enabled = true;
  const voice = new Voice({ voice: { rate: 1.05, pitch: 1.1 } }, {
    get: () => enabled, set: (_key, value) => { enabled = value; },
  });
  voice.speak('Twenty two');
  assert.deepEqual(calls, ['resume', 'Twenty two']);
  const first = voice.current;
  assert.equal(first.volume, 1);
  assert.equal(first.lang, 'en-AU');
  voice.speak('Thirty three');
  const second = voice.current;
  first.onerror();
  assert.equal(voice.current, second, 'late cancellation must not clear the new call');
  second.onend();
  assert.equal(voice.current, null);
  voice.setOn(false);
  const count = calls.length;
  voice.speak('Muted');
  assert.equal(calls.length, count);
});
