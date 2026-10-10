// Plays many games with a computer "player" who marks every number where it helps most and claims after a human
// delay, to see how often the player beats the regulars. Not part of the game. Run:
//   node tools/simulate-night.mjs [games] [speed] [lagSeconds] [stages]
// for example: node tools/simulate-night.mjs 200 steady 5 line,two-lines,full-house
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/game.js';
import { isFreeSquare } from '../src/engine/cards.js';
import { setsFor } from '../src/engine/table.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const patterns = load('patterns');
const callerLines = load('caller-lines');
const regularsData = load('regulars');

const games = Number(process.argv[2] ?? 200);
const speedId = process.argv[3] ?? 'steady';
const lag = Number(process.argv[4] ?? 4); // seconds from the number that completes their pattern to their claim
const stageIds = (process.argv[5] ?? 'line').split(',');
const selfAdjust = process.argv[6] !== 'off';

const pickThree = () => [...regularsData.regulars].sort(() => Math.random() - 0.5).slice(0, 3);

const stageWins = stageIds.map(() => 0);
const stageSeen = stageIds.map(() => 0);
const winsPerNight = {};
let history = [];
const arcs = {};
for (let g = 0; g < games; g++) {
  const game = new Game({ config, patterns, callerLines, speedId, stageIds, regulars: pickThree(), history: selfAdjust ? history : [] });
  game.on((type, data) => { if (type === 'stageDone') history = [...history, data.won ? 1 : 0].slice(-20); });
  game.start();
  const marked = new Set();
  let lastCall = 0;
  let claimAt = null;
  let stageSeenIndex = -1;
  for (let t = 0; t < 6000 * 1000 && game.screen !== 'result'; t += 50) {
    if (game.stageIndex !== stageSeenIndex) {
      stageSeenIndex = game.stageIndex;
      claimAt = null;
    }
    const pattern = game.pattern;
    const complete = (extra) => game.cards.some((card, c) => setsFor(pattern).some((squares) => squares.every(
      ([r, col]) => isFreeSquare(r, col, config) || marked.has(`${c}:${r},${col}`) || extra === `${c}:${r},${col}`,
    )));
    if (game.called.length !== lastCall && game.phase === 'calling') {
      lastCall = game.called.length;
      const number = game.currentNumber;
      let best = null;
      game.cards.forEach((card, c) => card.grid.forEach((row, r) => row.forEach((n, col) => {
        if (n !== number) return;
        const key = `${c}:${r},${col}`;
        let score = 0;
        for (const squares of setsFor(pattern)) {
          if (!squares.some(([rr, cc]) => rr === r && cc === col)) continue;
          const have = squares.filter(([rr, cc]) => isFreeSquare(rr, cc, config) || marked.has(`${c}:${rr},${cc}`)).length;
          score = Math.max(score, have);
        }
        if (!best || score > best.score) best = { c, r, col, key, score };
      })));
      if (best && game.canMark) {
        game.tapSquare(best.c, best.r, best.col);
        marked.add(best.key);
      }
      claimAt = null;
      if (complete()) claimAt = game.callElapsed + lag * 1000;
    }
    if (game.screen === 'cards' && game.phase === 'calling' && claimAt === null && complete()) claimAt = game.callElapsed + lag * 1000;
    if (claimAt !== null && game.screen === 'cards' && game.phase === 'calling' && game.callElapsed >= claimAt) {
      game.openShout();
      if (game.screen === 'shout') game.submitClaim();
      claimAt = null;
    }
    game.advance(50);
  }
  const results = game.stageResults;
  let wins = 0;
  results.forEach((r, i) => {
    stageSeen[i] += 1;
    if (r.winner.type === 'you') { stageWins[i] += 1; wins += 1; }
  });
  winsPerNight[wins] = (winsPerNight[wins] ?? 0) + 1;
  if (game.plan) arcs[game.plan.map((p) => (p.kind === 'win' ? 'W' : 'L')).join('')] = (arcs[game.plan.map((p) => (p.kind === 'win' ? 'W' : 'L')).join('')] ?? 0) + 1;
}
console.log(`${games} nights of [${stageIds.join(', ')}] on ${speedId}, player claims ${lag}s after the number that completes their pattern${selfAdjust ? '' : ' (self-adjust off)'}`);
stageIds.forEach((id, i) => console.log(`  ${id}: player won ${stageWins[i]} of ${stageSeen[i]} (${stageSeen[i] ? Math.round((stageWins[i] / stageSeen[i]) * 100) : 0}%)`));
console.log('  stages won per night:', winsPerNight);
console.log('  planned shapes:', arcs);
