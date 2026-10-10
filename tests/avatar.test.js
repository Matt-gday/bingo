import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const avatar = load('avatar');
const regulars = load('regulars');

const SHAPES = ['sphere', 'hemisphere', 'cylinder', 'cone', 'torus', 'box', 'bow', 'headband'];
const HEX = /^#[0-9a-f]{6}$/i;

test('every wearable item has a slot, a name and parts made of known shapes', () => {
  const ids = new Set();
  for (const item of avatar.items) {
    assert.ok(!ids.has(item.id), `${item.id} is listed twice`);
    ids.add(item.id);
    assert.ok(['hat', 'glasses', 'neck'].includes(item.slot), `${item.id} has a slot`);
    assert.ok(item.name, `${item.id} has a name`);
    assert.ok(item.colours.length > 0 && item.colours.every((c) => HEX.test(c)), `${item.id} has colours`);
    assert.ok(item.parts.length > 0);
    for (const part of item.parts) {
      assert.ok(SHAPES.includes(part.shape), `${item.id}: unknown shape ${part.shape}`);
      assert.ok(part.colour === 'primary' || HEX.test(part.colour), `${item.id}: bad colour ${part.colour}`);
      for (const key of ['pos', 'rot', 'scale']) if (part[key]) assert.equal(part[key].length, 3, `${item.id}: ${key} needs three numbers`);
    }
  }
});

test('every regular and default look only uses things that exist', () => {
  const itemSlot = new Map(avatar.items.map((i) => [i.id, i.slot]));
  const eyes = new Set(avatar.eyes.map((e) => e.id));
  const looks = [...regulars.regulars.map((r) => [r.name, r.look]), ...Object.entries(avatar.defaults)];
  for (const [name, look] of looks) {
    assert.ok(look, `${name} has a look`);
    assert.ok(HEX.test(look.ball) && HEX.test(look.cheeks), `${name} has colours`);
    assert.ok(eyes.has(look.eyes), `${name}: eye style ${look.eyes}`);
    for (const slot of ['hat', 'glasses', 'neck']) {
      if (look[slot]) assert.equal(itemSlot.get(look[slot]), slot, `${name}: ${look[slot]} is not a ${slot}`);
    }
  }
});

test('the regulars are all recognisably different', () => {
  const keys = regulars.regulars.map((r) => JSON.stringify(r.look));
  assert.equal(new Set(keys).size, keys.length);
  const balls = regulars.regulars.map((r) => r.look.ball);
  assert.equal(new Set(balls).size, balls.length, 'each has their own ball colour');
});
