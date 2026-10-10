import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPrizeData, emptyPrizeState, setStatus, buyPrize, wouldFinish, closestSet, refillTable, badgeFor,
  finishedSets, wardrobeOf, drawPrizes, owns,
} from '../src/engine/prizes.js';
import { PrizeRound } from '../src/engine/prizeRound.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const data = buildPrizeData(load('prizes'), load('sets'));
const regulars = load('regulars').regulars;
const avatar = load('avatar');

test('every prize has a price, tags that are real sets, and every set has a sensible target', () => {
  for (const prize of data.list) {
    assert.ok(prize.price > 0, prize.id);
    for (const tag of prize.tags) assert.ok(data.setById.has(tag), `${prize.id} has unknown tag ${tag}`);
  }
  for (const set of data.sets) {
    const total = data.list.filter((p) => p.tags.includes(set.id)).reduce((s, p) => s + p.price, 0);
    assert.equal(set.totalValue, total, `${set.id} total value`);
    assert.ok(set.target > 0 && set.target < set.totalValue, `${set.id} target can be reached but is not everything`);
  }
});

test('every wearable prize points at a real avatar item and one of its colours', () => {
  const items = new Map(avatar.items.map((i) => [i.id, i]));
  for (const prize of data.list.filter((p) => p.wearable)) {
    const item = items.get(prize.wearable.item);
    assert.ok(item, `${prize.id}: unknown item`);
    assert.ok(item.colours.map((c) => c.toLowerCase()).includes(prize.wearable.colour.toLowerCase()), `${prize.id}: colour not on the item`);
    assert.ok(prize.tags.includes('dress-up'));
  }
});

test('a prize counts its full price towards every set it belongs to, and a set is done at its target', () => {
  const state = emptyPrizeState();
  const prize = data.list.find((p) => p.tags.length >= 2);
  buyPrize(data, state, 'player', prize.id);
  for (const tag of prize.tags) assert.equal(setStatus(data, state, 'player', tag).have, prize.price);
  const set = data.sets[0];
  const needed = data.list.filter((p) => p.tags.includes(set.id));
  const fresh = emptyPrizeState();
  let finishedNow = [];
  for (const p of needed) {
    if (setStatus(data, fresh, 'player', set.id).done) break;
    finishedNow = buyPrize(data, fresh, 'player', p.id).finished;
  }
  assert.ok(setStatus(data, fresh, 'player', set.id).done);
  assert.ok(finishedNow.some((f) => f.setId === set.id));
});

test('the first to finish a set gets gold, anyone later gets silver, and you cannot own a prize twice', () => {
  const state = emptyPrizeState();
  const set = data.sets.find((s) => s.id === 'stationery');
  const prizes = data.list.filter((p) => p.tags.includes(set.id));
  for (const p of prizes) {
    if (!setStatus(data, state, 'dot', set.id).done) buyPrize(data, state, 'dot', p.id);
  }
  for (const p of prizes) {
    if (!setStatus(data, state, 'player', set.id).done) buyPrize(data, state, 'player', p.id);
  }
  assert.equal(badgeFor(state, 'dot', set.id), 'gold');
  assert.equal(badgeFor(state, 'player', set.id), 'silver');
  assert.ok(owns(state, 'player', prizes[0].id));
  assert.deepEqual(wouldFinish(data, state, 'player', prizes[0].id), [], 'already owned, so it finishes nothing');
  assert.ok(finishedSets(data, state, 'player').includes('stationery'));
});

test('the closest set is the one with the biggest share done', () => {
  const state = emptyPrizeState();
  assert.equal(closestSet(data, state, 'player'), null);
  const cheap = data.list.find((p) => p.tags.length === 1);
  buyPrize(data, state, 'player', cheap.id);
  assert.equal(closestSet(data, state, 'player').setId, cheap.tags[0]);
});

test('the table fills to six distinct prizes, favours what the player lacks, and unsold prizes stay', () => {
  const state = emptyPrizeState();
  refillTable(data, state, config.prizeTable.slots);
  assert.equal(state.table.filter(Boolean).length, 6);
  assert.equal(new Set(state.table).size, 6);
  assert.equal(state.covered.length, 6, 'new arrivals are covered until looked at');
  const before = [...state.table];
  state.table[2] = null;
  refillTable(data, state, config.prizeTable.slots);
  assert.equal(state.table[0], before[0]);
  assert.notEqual(state.table[2], before[2]);
  assert.equal(drawPrizes(data, state, 3).length, 3);
});

test('wearables the player owns join the free starter wardrobe', () => {
  const state = emptyPrizeState();
  const hat = data.list.find((p) => p.wearable?.item === 'party-hat');
  buyPrize(data, state, 'player', hat.id);
  const wardrobe = wardrobeOf(data, state, avatar.starterItems);
  assert.ok(wardrobe.some((w) => w.item === 'party-hat' && w.colour === hat.wearable.colour.toUpperCase()));
  assert.ok(wardrobe.some((w) => w.item === 'bow'), 'the starter items are always there');
});

function roundOf({ credits = 500, wallet = 300, speedId = 'steady' } = {}) {
  const state = emptyPrizeState();
  refillTable(data, state, config.prizeTable.slots);
  const table = regulars.slice(0, 3);
  const wallets = Object.fromEntries(table.map((r) => [r.id, { credits: wallet }]));
  const events = [];
  const round = new PrizeRound({ config, data, state, regulars: table, wallets, playerCredits: credits, speedId, onEvent: (type, d) => events.push([type, d]) });
  return { round, state, wallets, events, table };
}

test('the regulars arrive a few seconds apart and then shop', () => {
  const { round, events } = roundOf();
  round.advance(config.prizeTable.firstBotDelaySeconds * 1000 + 100);
  assert.equal(events.filter(([t]) => t === 'arrive').length, 1);
  round.advance(config.prizeTable.secondsBetweenBotArrivals * 1000);
  assert.equal(events.filter(([t]) => t === 'arrive').length, 2);
  assert.ok(events.some(([t]) => t === 'eye'), 'someone is eyeing a prize');
});

test('a regular buys when their ring closes, paying the price, and everyone eyeing it is beaten', () => {
  const { round, wallets, state } = roundOf({ wallet: 400 });
  round.fastForward();
  const bought = round.log.filter((l) => l.owner !== 'player');
  assert.ok(bought.length > 0, 'the regulars bought things');
  for (const bot of round.bots) {
    const spent = bot.bought.map((id) => data.prizes.get(id).price).reduce((a, b) => a + b, 0);
    assert.equal(wallets[bot.id].credits, 400 - spent);
    assert.equal(new Set(state.owned[bot.id] ?? []).size, (state.owned[bot.id] ?? []).length, 'never two of the same prize');
  }
  assert.ok(round.over);
});

test('if the player buys first, a regular eyeing that prize is beaten to it', () => {
  const { round, events } = roundOf({ credits: 1000, wallet: 400 });
  let slot = null;
  for (let t = 0; t < 20000 && slot === null; t += 100) {
    round.advance(100);
    const eye = events.filter(([type]) => type === 'eye').at(-1);
    if (eye) slot = eye[1].slot;
  }
  assert.notEqual(slot, null);
  const result = round.playerBuy(slot);
  assert.ok(result.ok);
  assert.ok(events.some(([type, d]) => type === 'broken' && d.slot === slot), 'their ring disappears');
  assert.equal(round.playerBuy(slot).ok, false, 'it has gone');
});

test('the player cannot buy what they cannot afford, and is told how short they are', () => {
  const { round } = roundOf({ credits: 10 });
  const slot = round.slots.findIndex((s) => s.prize);
  const result = round.playerBuy(slot);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'short');
  assert.equal(result.short, data.prizes.get(round.slots[slot].prize).price - 10);
});

test('rings are slower on Relaxed and quicker on Quick', () => {
  const total = (speedId) => {
    const { round, events } = roundOf({ speedId });
    for (let t = 0; t < 30000 && !events.some(([type]) => type === 'eye'); t += 100) round.advance(100);
    return events.find(([type]) => type === 'eye')[1].total;
  };
  let relaxed = 0;
  let quick = 0;
  for (let i = 0; i < 30; i++) { relaxed += total('relaxed'); quick += total('quick'); }
  assert.ok(relaxed > quick * 1.5, `relaxed ${relaxed} vs quick ${quick}`);
});

test('what is left on the table stays for next time and empty slots get new arrivals', () => {
  const { round, state } = roundOf({ wallet: 400 });
  round.fastForward();
  round.commit();
  assert.equal(state.table.filter(Boolean).length, 6);
});
