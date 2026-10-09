import { dealCards, isFreeSquare } from './cards.js';
import { candidateSquareSets } from './patterns.js';

// The regulars at the table. Each one has their own cards and marks the called numbers, sometimes missing
// one. Nothing here knows about the screen. The game asks how many squares each still needs and when they
// shout.

const setCache = new Map();
function setsFor(pattern) {
  if (!setCache.has(pattern.id)) setCache.set(pattern.id, candidateSquareSets(pattern));
  return setCache.get(pattern.id);
}

// Deals a regular their cards and gives them a blank set of marks.
export function createBot(regular, config) {
  const cardsConfig = { ...config, cards: { ...config.cards, playerCards: config.table?.cardsPerRegular ?? 2 } };
  return {
    id: regular.id,
    name: regular.name,
    pronoun: regular.pronoun,
    colour: regular.colour,
    missChance: regular.missChance,
    falseCallChance: regular.falseCallChance,
    reactionSeconds: regular.reactionSeconds ?? config.table?.reactionSecondsDefault ?? [1.5, 3.5],
    cards: dealCards(cardsConfig),
    marked: new Set(), // "card:row,col"
    sitOut: 0, // calls left to sit out after a false call
    claim: null, // { dueAt, kind: 'bingo' | 'false' } once they have decided to shout
    mood: null, // { name, until } a mood that lasts a little while (shocked, sulky, cheer)
  };
}

// The regular marks a called number on every card that has it, unless they miss it.
export function botMarks(bot, number, rng = Math.random) {
  if (bot.sitOut > 0) return;
  if (rng() < bot.missChance) return;
  bot.cards.forEach((card, c) => {
    card.grid.forEach((row, r) => row.forEach((n, col) => {
      if (n === number) bot.marked.add(`${c}:${r},${col}`);
    }));
  });
}

// How many squares the regular still needs for the pattern on their best card (0 = they have it).
export function botToGo(bot, pattern, config) {
  let best = Infinity;
  bot.cards.forEach((card, c) => {
    for (const squares of setsFor(pattern)) {
      let missing = 0;
      for (const [r, col] of squares) {
        if (isFreeSquare(r, col, config)) continue;
        if (!bot.marked.has(`${c}:${r},${col}`)) missing += 1;
      }
      if (missing < best) best = missing;
    }
  });
  return best;
}

// How much of the pattern the player has marked correctly (0 to 1), counting only called numbers.
// Used only to work out the small consolation when a regular wins, never shown to the player.
export function playerCloseness({ cards, marks, called, pattern, config }) {
  const calledSet = new Set(called);
  const marked = new Set(marks.filter((m) => calledSet.has(m.number)).map((m) => `${m.card}:${m.row},${m.col}`));
  let best = 0;
  cards.forEach((card, c) => {
    for (const squares of setsFor(pattern)) {
      let have = 0;
      let total = 0;
      for (const [r, col] of squares) {
        if (isFreeSquare(r, col, config)) continue; // the free square is nobody's effort
        total += 1;
        if (marked.has(`${c}:${r},${col}`)) have += 1;
      }
      if (total > 0) best = Math.max(best, have / total);
    }
  });
  return best;
}
