// Plays many nights of earning and shopping with simple stand-ins for the player, to see how the prices and set
// targets feel: how many nights until a first set is finished, how often the player gets gold, how rich the
// regulars get. Not part of the game. Run:  node tools/simulate-economy.mjs [players] [nights] [nightType]
import { readFileSync } from 'node:fs';
import { buildPrizeData, emptyPrizeState, refillTable, setStatus, finishedSets, closestSet, wouldFinish, owns, ownedIds } from '../src/engine/prizes.js';
import { PrizeRound } from '../src/engine/prizeRound.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const players = Number(process.argv[2] ?? 200);
const nights = Number(process.argv[3] ?? 40);
const nightType = process.argv[4] ?? 'mixed'; // line, two, full or mixed
const priceScale = Number(process.argv[5] ?? 1); // try cheaper or dearer prizes
const allowance = Number(process.argv[6] ?? 0); // what each regular also earns every night, away from the bingo
const prizesJson = load('prizes');
const setsJson = load('sets');
for (const p of prizesJson.prizes) p.price = Math.max(5, Math.round((p.price * priceScale) / 5) * 5);
for (const set of setsJson.sets) {
  set.totalValue = prizesJson.prizes.filter((p) => p.tags.includes(set.id)).reduce((a, p) => a + p.price, 0);
  set.target = Math.round((set.totalValue * setsJson.targetShare) / 10) * 10;
}
const data = buildPrizeData(prizesJson, setsJson);
const regularsData = load('regulars');

const payouts = { line: 20, 'two-lines': 40, 'full-house': 80 };
const winRate = { line: 0.66, 'two-lines': 0.7, 'full-house': 0.42 };
const speedMultiplier = 1.5;

function nightStages() {
  const type = nightType === 'mixed' ? ['line', 'two', 'full'][Math.floor(Math.random() * 3)] : nightType;
  return type === 'line' ? ['line'] : type === 'two' ? ['line', 'two-lines'] : ['line', 'two-lines', 'full-house'];
}

// what the player and the three regulars earn in one night
function night(regulars) {
  const stages = nightStages();
  let you = config.credits.forPlaying;
  const reg = Object.fromEntries(regulars.map((r) => [r.id, config.credits.forPlaying]));
  for (const stage of stages) {
    if (Math.random() < winRate[stage]) you += payouts[stage];
    else {
      reg[regulars[Math.floor(Math.random() * regulars.length)].id] += payouts[stage];
      you += payouts[stage] * config.credits.closenessMaxShareOfPayout * (0.4 + Math.random() * 0.5);
    }
  }
  return { you: Math.floor(you * speedMultiplier), reg: Object.fromEntries(Object.entries(reg).map(([k, v]) => [k, Math.floor(v * speedMultiplier)])) };
}

// the stand-in player: buy what finishes a set, else the best fit for their closest set, else save up
function playerShops(round, state) {
  for (let guard = 0; guard < 6; guard++) {
    const closest = closestSet(data, state, 'player');
    let best = null;
    round.slots.forEach((s, slot) => {
      const prize = round.prizeAt(slot);
      if (!prize || owns(state, 'player', prize.id) || prize.price > round.playerCredits) return;
      const finishes = wouldFinish(data, state, 'player', prize.id).length > 0;
      const inClosest = closest && prize.tags.includes(closest.setId);
      const score = 1 + (finishes ? 100 : 0) + (inClosest ? 40 : 0) + prize.tags.length * 3 - prize.price / 40; // cheaper is a little better
      if (!best || score > best.score) best = { slot, score };
    });
    if (!best) break;
    round.playerBuy(best.slot);
  }
}

const firstFinish = []; // the night a player first finished any set
const goldCounts = { player: 0, regulars: 0 };
const finishedByNight = { 10: [], 20: [], 40: [] };
const unspent = [];
const regularFinished = { 10: [], 20: [], 40: [] };

for (let p = 0; p < players; p++) {
  const state = emptyPrizeState();
  refillTable(data, state, config.prizeTable.slots);
  state.covered = [];
  const table = [...regularsData.regulars].sort(() => Math.random() - 0.5).slice(0, 3);
  const wallets = Object.fromEntries(table.map((r) => [r.id, { credits: config.prizeTable.regularStartingCredits }]));
  let credits = 0;
  let first = null;
  for (let n = 1; n <= nights; n++) {
    const earned = night(table);
    credits += earned.you;
    for (const r of table) wallets[r.id].credits += earned.reg[r.id] + allowance;
    const round = new PrizeRound({ config, data, state, regulars: table, wallets, playerCredits: credits, speedId: 'steady' });
    // the player shops in the first seconds, then the regulars finish
    for (let t = 0; t < 8000; t += 250) {
      round.advance(250);
      playerShops(round, state);
    }
    round.done();
    round.fastForward();
    credits = round.playerCredits;
    round.commit();
    if (first === null && finishedSets(data, state, 'player').length) first = n;
    if (finishedByNight[n]) {
      finishedByNight[n].push(finishedSets(data, state, 'player').length);
      regularFinished[n].push(table.reduce((sum, r) => sum + finishedSets(data, state, r.id).length, 0) / table.length);
    }
  }
  firstFinish.push(first ?? nights + 1);
  unspent.push(credits);
  for (const [setId, order] of Object.entries(state.finishers)) {
    if (order[0] === 'player') goldCounts.player += 1;
    else if (order.length) goldCounts.regulars += 1;
  }
}
const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`${players} players, ${nights} nights each (${nightType} nights)`);
console.log(`First set finished by the player: median night ${median(firstFinish)}, average ${mean(firstFinish)}`);
for (const n of Object.keys(finishedByNight)) {
  if (Number(n) > nights) continue;
  console.log(`After ${n} nights: player has finished ${mean(finishedByNight[n])} sets, a regular ${mean(regularFinished[n])}`);
}
console.log(`Gold badges: player ${goldCounts.player}, regulars ${goldCounts.regulars}`);
console.log(`Credits sitting unspent at the end: average ${mean(unspent)}`);
