import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfiles } from '../src/profiles.js';
import { createSettings } from '../src/settings.js';

const config = JSON.parse(readFileSync(new URL('../Data/config.json', import.meta.url), 'utf8'));

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

test('two players each keep their own credits and choices', () => {
  const storage = memoryStorage();
  const profiles = createProfiles(storage);
  const matt = profiles.add({ name: 'Matt', look: { ball: '#9FB4FF' } });
  const victoria = profiles.add({ name: 'Victoria', look: { ball: '#FF8FCB' } });
  profiles.recordNight(matt.id, { credits: 130, stagesWon: 2, won: true, regularEarnings: { dot: 20 } });
  profiles.recordNight(victoria.id, { credits: 40, stagesWon: 1, won: false });
  assert.equal(profiles.get(matt.id).credits, 130);
  assert.equal(profiles.get(victoria.id).credits, 40);
  assert.equal(profiles.get(matt.id).regulars.dot.credits, 20);
  assert.equal(profiles.get(victoria.id).regulars.dot, undefined);

  // closing and reopening the app keeps everything
  const again = createProfiles(storage);
  assert.equal(again.list().length, 2);
  assert.equal(again.get(victoria.id).name, 'Victoria');
  assert.equal(again.get(matt.id).stats.nightsWon, 1);
  assert.equal(again.active().id, victoria.id, 'the last player added is the active one');
});

test('settings that belong to a player follow the active player; device settings do not', () => {
  const profiles = createProfiles(memoryStorage());
  const settings = createSettings(config, profiles);
  settings.set('voiceOn', false); // a device setting, with nobody signed in
  const a = profiles.add({ name: 'A', look: {} });
  settings.set('speedId', 'quick');
  const b = profiles.add({ name: 'B', look: {} });
  assert.equal(settings.get('speedId'), 'steady', 'B has not chosen a speed, so gets the default');
  settings.set('speedId', 'relaxed');
  profiles.setActive(a.id);
  assert.equal(settings.get('speedId'), 'quick');
  profiles.setActive(b.id);
  assert.equal(settings.get('speedId'), 'relaxed');
  assert.equal(settings.get('voiceOn'), false, 'the sound setting is for the phone, whoever is playing');
});

test('starting progress again clears credits and records but keeps the name and look', () => {
  const profiles = createProfiles(memoryStorage());
  const p = profiles.add({ name: 'Victoria', look: { ball: '#FF8FCB' } });
  profiles.recordNight(p.id, { credits: 90, stagesWon: 2, won: true, regularEarnings: { rex: 5 } });
  profiles.reset(p.id);
  const after = profiles.get(p.id);
  assert.equal(after.credits, 0);
  assert.equal(after.stats.nights, 0);
  assert.deepEqual(after.regulars, {});
  assert.equal(after.name, 'Victoria');
  assert.equal(after.look.ball, '#FF8FCB');
});

test('names are tidied, never empty, and damaged saved data does not break anything', () => {
  const profiles = createProfiles(memoryStorage());
  assert.equal(profiles.add({ name: '   ', look: {} }).name, 'Player');
  assert.equal(profiles.add({ name: '  A   very  long name indeed here ', look: {} }).name.length <= 14, true);
  const broken = { getItem: () => '{not json', setItem() {} };
  assert.equal(createProfiles(broken).list().length, 0);
});
