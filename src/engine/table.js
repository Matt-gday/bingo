import { dealCards, isFreeSquare } from './cards.js';
import { candidateSquareSets } from './patterns.js';

// The regulars at the table. Each one has their own cards and marks the called numbers, sometimes missing
// one. Nothing here knows about the screen. The game asks how many squares each still needs and when they
// shout.

const setCache = new Map();
export function setsFor(pattern) {
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
    look: regular.look, // how they look in 3D (see Data/avatar.json)
    missChance: regular.missChance,
    reactionShare: regular.reactionShare ?? config.table?.reactionShareDefault ?? [0.6, 1.0],
    cards: dealCards(cardsConfig),
    marked: new Set(), // "card:row,col"
    missed: [], // numbers they did not notice; they spot them one call later
    claim: null, // { dueAt, kind: 'bingo' | 'false' } once they have decided to shout
    mood: null, // { name, until } a mood that lasts a little while (shocked, sulky, cheer)
  };
}

// The regular marks a called number on every card that has it, unless they miss it.
export function botMarks(bot, number, rng = Math.random) {
  const markNumber = (wanted) => bot.cards.forEach((card, c) => {
    card.grid.forEach((row, r) => row.forEach((n, col) => {
      if (n === wanted) bot.marked.add(`${c}:${r},${col}`);
    }));
  });
  // A number they missed last time dawns on them now, so a slip only costs a call, not the whole game.
  for (const late of bot.missed) markNumber(late);
  bot.missed = [];
  if (rng() < bot.missChance) bot.missed.push(number);
  else markNumber(number);
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

// The numbers that would complete the pattern for this regular right now, when they are one square away.
// Numbers already called are left out (those are only waiting to be noticed). Empty if they are not one away.
export function botNeeds(bot, pattern, config, calledSet) {
  const needs = new Set();
  let best = Infinity;
  const found = [];
  bot.cards.forEach((card, c) => {
    for (const squares of setsFor(pattern)) {
      let missing = 0;
      let lastMissing = null;
      for (const [r, col] of squares) {
        if (isFreeSquare(r, col, config)) continue;
        if (!bot.marked.has(`${c}:${r},${col}`)) {
          missing += 1;
          lastMissing = card.grid[r][col];
        }
      }
      if (missing < best) best = missing;
      if (missing === 1) found.push(lastMissing);
    }
  });
  if (best !== 1) return [];
  for (const n of found) if (!calledSet.has(n)) needs.add(n);
  return [...needs].sort((a, b) => a - b);
}

// How much of the pattern the player has marked correctly, counting only called numbers: the best of every way
// to complete it, as { have, total, ratio }. Used only to work out the small consolation when a regular wins and
// to say how close they were afterwards, never shown to the player during play.
export function playerProgress({ cards, marks, called, pattern, config }) {
  const calledSet = new Set(called);
  const marked = new Set(marks.filter((m) => calledSet.has(m.number)).map((m) => `${m.card}:${m.row},${m.col}`));
  let best = { have: 0, total: 1, ratio: 0 };
  cards.forEach((card, c) => {
    for (const squares of setsFor(pattern)) {
      let have = 0;
      let total = 0;
      for (const [r, col] of squares) {
        if (isFreeSquare(r, col, config)) continue; // the free square is nobody's effort
        total += 1;
        if (marked.has(`${c}:${r},${col}`)) have += 1;
      }
      if (total > 0 && have / total > best.ratio) best = { have, total, ratio: have / total };
    }
  });
  return best;
}

export function playerCloseness(args) {
  return playerProgress(args).ratio;
}
