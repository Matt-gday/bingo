import test from 'node:test';
import assert from 'node:assert/strict';
import { Sfx } from '../src/audio/sfx.js';
import { Music } from '../src/audio/music.js';
import { attachGameSounds } from '../src/audio/gameSounds.js';
import { Game } from '../src/engine/game.js';
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const patterns = load('patterns');
const callerLines = load('caller-lines');

// A pretend audio engine that writes down what it plays.
function fakeEngine(log) {
  return {
    ctx: {},
    buffers: new Map(),
    ensure: () => true,
    load: (url) => Promise.resolve({ url }),
    play: (buffer, options) => {
      log.push({ url: buffer.url, gain: options.gain, rate: options.rate });
      return { stop: () => log.push({ stopped: buffer.url }) };
    },
    playLoop: (buffer) => {
      log.push({ loop: buffer.url });
      return { fadeTo: (level) => log.push({ fadeTo: level }), stop: () => log.push({ stoppedLoop: buffer.url }) };
    },
  };
}
const settings = (values) => ({ get: (key) => values[key], set: (key, value) => { values[key] = value; } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test('a sound with several takes never plays the same take twice in a row', async () => {
  const log = [];
  const sfx = new Sfx(fakeEngine(log), settings({ sfxOn: true }));
  sfx.sounds = { 'mark-pop': { files: ['a.mp3', 'b.mp3', 'c.mp3'], volume: 0.8 } };
  sfx.base = './sfx/';
  for (let i = 0; i < 40; i++) sfx.play('mark-pop');
  await settle();
  const played = log.map((entry) => entry.url);
  assert.equal(played.length, 40);
  for (let i = 1; i < played.length; i++) assert.notEqual(played[i], played[i - 1]);
});

test('sounds follow the on/off switch, and the sound has its own volume and pitch', async () => {
  const log = [];
  const values = { sfxOn: false };
  const sfx = new Sfx(fakeEngine(log), settings(values));
  sfx.sounds = { 'check-tick': { files: ['t.mp3'], volume: 0.7 } };
  sfx.play('check-tick');
  await settle();
  assert.equal(log.length, 0, 'off means silent');
  values.sfxOn = true;
  sfx.play('check-tick', { rate: 1.12 });
  sfx.play('does-not-exist');
  await settle();
  assert.equal(log.length, 1);
  assert.equal(log[0].gain, 0.7);
  assert.equal(log[0].rate, 1.12);
});

test('the music only plays when it is switched on, and fades when switched off', async () => {
  const log = [];
  const values = { musicOn: false };
  const music = new Music(fakeEngine(log), settings(values));
  music.tracks = { home: { file: 'home.mp3', volume: 0.35 } };
  music.base = './music/';
  music.play('home');
  await settle();
  assert.equal(log.length, 0, 'off by default');
  values.musicOn = true;
  music.sync();
  await settle();
  assert.ok(log.some((entry) => entry.loop === './music/home.mp3'));
  values.musicOn = false;
  music.sync();
  assert.ok(log.some((entry) => entry.stoppedLoop));
});

test('game events make the right sounds and buzzes', async () => {
  const log = [];
  const buzzes = [];
  const sfx = new Sfx(fakeEngine(log), settings({ sfxOn: true }));
  sfx.base = './sfx/';
  const ids = ['ball-land', 'mark-pop', 'mark-undo', 'ball-skip', 'check-tick', 'check-cross', 'check-build', 'false-call', 'win-fanfare', 'pause-on', 'countdown-beep', 'countdown-go'];
  sfx.sounds = Object.fromEntries(ids.map((id) => [id, { files: [`${id}.mp3`], volume: 0.5 }]));
  const haptics = { buzz: (pattern) => buzzes.push(pattern) };
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  attachGameSounds(game, { sfx, haptics, music: null });
  game.start(); // the first number is called
  game.tapSquare(0, 1, 1); // a mark
  game.tapSquare(0, 1, 1); // taken back
  game.skipCall(); // tapping the ball
  await settle();
  const heard = log.map((entry) => entry.url.replace('./sfx/', '').replace('.mp3', ''));
  assert.deepEqual(heard.slice(0, 4), ['ball-land', 'mark-pop', 'mark-undo', 'ball-skip']);
  assert.ok(buzzes.length >= 3, 'taps buzz');

  log.length = 0;
  game.pauseByPlayer();
  game.resume();
  await settle();
  const pauseHeard = log.map((entry) => entry.url.replace('./sfx/', '').replace('.mp3', ''));
  assert.deepEqual(pauseHeard, ['pause-on', 'countdown-beep'], 'a pause and the first count of the 3, 2, 1');
});

test('the ticks in a check rise in pitch, and the build-up stops dead when the answer comes', async () => {
  const log = [];
  const sfx = new Sfx(fakeEngine(log), settings({ sfxOn: true }));
  sfx.base = './sfx/';
  sfx.sounds = { 'check-tick': { files: ['tick.mp3'], volume: 0.7 }, 'check-build': { files: ['build.mp3'], volume: 0.8 }, 'check-cross': { files: ['x.mp3'], volume: 0.8 } };
  const game = { on(listener) { this.listener = listener; }, falseCall: null };
  attachGameSounds(game, { sfx, haptics: { buzz() {} }, music: null });
  game.listener('reveal', { ok: true, count: 1 });
  game.listener('reveal', { ok: true, count: 3 });
  game.listener('build');
  game.listener('reveal', { ok: false });
  await settle();
  const ticks = log.filter((entry) => entry.url === './sfx/tick.mp3');
  assert.equal(ticks[0].rate, 1);
  assert.ok(ticks[1].rate > ticks[0].rate);
  assert.ok(!log.some((entry) => entry.url === './sfx/build.mp3'), 'a build-up still loading when the answer arrives never starts');
  assert.ok(log.some((entry) => entry.url === './sfx/x.mp3'));
});
