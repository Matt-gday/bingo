// Plays many one-line games with a computer "player" who marks every number on the best card and claims after
// a human delay, to see how often the player beats the regulars. Not part of the game. Run:
//   node tools/simulate-night.mjs [games] [speed] [lagSeconds]
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/game.js';
import { isFreeSquare } from '../src/engine/cards.js';
import { candidateSquareSets } from '../src/engine/patterns.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const patterns = load('patterns');
const callerLines = load('caller-lines');
const regularsData = load('regulars');

const games = Number(process.argv[2] ?? 300);
const speedId = process.argv[3] ?? 'steady';
const lag = Number(process.argv[4] ?? 3.5); // seconds from a number being called to the player's claim
const stage = process.argv[5] ?? 'line';
const pattern = patterns.patterns.find((p) => p.id === stage);

function pickThree() {
  const all = [...regularsData.regulars].sort(() => Math.random() - 0.5);
  return all.slice(0, 3);
}

let wins = 0;
let lost = 0;
let drawn = 0;
const callsAtWin = [];
const winnerCounts = {};
for (let g = 0; g < games; g++) {
  const game = new Game({ config, patterns, callerLines, speedId, stageIds: [stage], regulars: pickThree() });
  game.start();
  let claimAt = null;
  let lastCallCount = 0;
  const marked = new Set();
  for (let t = 0; t < 4000 * 1000 && game.screen !== 'result'; t += 50) {
    // the player marks the called number on whichever card gets them closest
    if (game.called.length !== lastCallCount) {
      lastCallCount = game.called.length;
      const number = game.currentNumber;
      let best = null;
      game.cards.forEach((card, c) => card.grid.forEach((row, r) => row.forEach((n, col) => {
        if (n !== number) return;
        const key = `${c}:${r},${col}`;
        let score = 0;
        for (const sq of candidateSquareSets(pattern)) {
          if (!sq.some(([rr, cc]) => rr === r && cc === col)) continue;
          const have = sq.filter(([rr, cc]) => isFreeSquare(rr, cc, config) || marked.has(`${c}:${rr},${cc}`)).length;
          score = Math.max(score, have);
        }
        if (!best || score > best.score) best = { c, r, col, key, score };
      })));
      if (best && game.canMark) {
        game.tapSquare(best.c, best.r, best.col);
        marked.add(best.key);
      }
      claimAt = null;
    }
    // can the player claim yet? (they know when they have a line)
    if (game.screen === 'cards' && claimAt === null && game.phase === 'calling') {
      const done = candidateSquareSets(pattern).some((sq) => game.cards.some((card, c) => sq.every(([r, col]) => isFreeSquare(r, col, config) || marked.has(`${c}:${r},${col}`))));
      if (done && game.pending === null) claimAt = game.callElapsed + lag * 1000;
      // the number just called is still pending: the player needs it locked or sent with the claim; treat it as marked
      if (!done && game.pending) {
        const key = `${game.pending.card}:${game.pending.row},${game.pending.col}`;
        const wouldDo = candidateSquareSets(pattern).some((sq) => game.cards.some((card, c) => sq.every(([r, col]) => isFreeSquare(r, col, config) || marked.has(`${c}:${r},${col}`) || (key === `${c}:${r},${col}`))));
        if (wouldDo) claimAt = game.callElapsed + lag * 1000;
      }
    }
    if (claimAt !== null && game.screen === 'cards' && game.callElapsed >= claimAt) {
      game.openShout();
      if (game.screen === 'shout') game.submitClaim();
      claimAt = null;
    }
    game.advance(50);
    if (game.screen === 'falseCall') break;
  }
  if (game.result?.outcome === 'win') {
    wins++;
    callsAtWin.push(game.called.length);
  } else if (game.result?.outcome === 'lost') {
    lost++;
    const name = game.result.stages[0].winner.name;
    winnerCounts[name] = (winnerCounts[name] ?? 0) + 1;
  } else drawn++;
}
const avg = callsAtWin.length ? (callsAtWin.reduce((a, b) => a + b, 0) / callsAtWin.length).toFixed(1) : '-';
console.log(`${games} games of "${stage}" on ${speedId}, player claims ${lag}s after the number: player won ${wins} (${((wins / games) * 100).toFixed(0)}%), a regular won ${lost}, other ${drawn}. Average calls when the player won: ${avg}.`);
console.log('Regulars who won:', winnerCounts);
