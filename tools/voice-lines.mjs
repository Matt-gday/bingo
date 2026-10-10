// Works out every line the caller can say, with its placeholders filled in, so each one
// can be recorded as an audio clip. The game looks a clip up by its exact text.

import { callText, capital, fillLine, numberInWords } from '../src/engine/caller.js';

const NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);

export function collectLines({ callerLines, patterns, regulars }) {
  const groups = {};
  const add = (group, text) => {
    if (!text) return;
    (groups[group] ??= new Set()).add(text);
  };

  // The calls themselves: with a nickname (Relaxed, Steady) and plain (Quick).
  for (const n of NUMBERS) {
    add('numbers with nicknames', callText(n, callerLines, true));
    add('plain numbers', callText(n, callerLines, false));
    add('numbers read in the card check', `${capital(numberInWords(n))}...`);
  }

  const spoken = patterns.patterns.filter((p) => !p.later).map((p) => p.spoken);
  const names = [
    ...regulars.regulars.map((r) => r.name),
    ...(regulars.ringIns?.names ?? []).map((r) => r.name),
  ];

  for (const line of callerLines.game.intro ?? []) add('welcome', line);
  for (const line of callerLines.game.splash ?? []) add('splash', line);
  for (const line of callerLines.game.howTo ?? []) add('how to play', line);
  for (const line of callerLines.game.home ?? []) add('home screen', line);
  for (const line of callerLines.game.homeTickle ?? []) add('home tickles', line);
  for (const line of callerLines.game.introCountdown ?? []) add('countdown', line);
  for (const line of callerLines.game.start) add('start of the game', line);
  for (const line of callerLines.game.tooSlow) add('too slow', line);
  for (const line of callerLines.game.noWinner ?? []) add('no winner', line);
  for (const line of callerLines.game.pause) add('pause', line);

  for (const pattern of spoken) {
    for (const line of callerLines.game.stageOpens) add('stage opens', fillLine(line, { pattern }));
    for (const line of callerLines.game.win) add('wins', fillLine(line, { pattern }));
    for (const line of callerLines.game.falseCall.noPattern) add('false calls', fillLine(line, { pattern }));
    for (const name of names) {
      for (const line of callerLines.game.botWins) add('regulars win', fillLine(line, { name, pattern }));
    }
  }

  for (const line of callerLines.game.falseCall.tooEarly ?? []) add('marked too early', line);
  for (const line of callerLines.game.tooManyWrong ?? []) add('too many wrong marks', line);

  // False calls that name the number: one clip for every number.
  for (const n of NUMBERS) {
    const number = numberInWords(n);
    for (const line of callerLines.game.falseCall.notCalled) add('false calls', fillLine(line, { number }));
  }

  return Object.fromEntries(Object.entries(groups).map(([group, set]) => [group, [...set]]));
}

export function allLines(input) {
  return [...new Set(Object.values(collectLines(input)).flat())];
}

// Which group each line belongs to (the first group that lists it).
export function groupOf(groups) {
  const map = new Map();
  for (const [group, list] of Object.entries(groups)) for (const line of list) if (!map.has(line)) map.set(line, group);
  return map;
}
