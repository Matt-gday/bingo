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

  for (const line of callerLines.game.start) add('fixed lines', line);
  for (const line of callerLines.game.marksLocked) add('fixed lines', line);
  for (const line of callerLines.game.tooSlow) add('fixed lines', line);
  for (const line of callerLines.game.pause) add('fixed lines', line);

  for (const pattern of spoken) {
    for (const line of callerLines.game.stageOpens) add('lines about the pattern', fillLine(line, { pattern }));
    for (const line of callerLines.game.win) add('lines about the pattern', fillLine(line, { pattern }));
    for (const line of callerLines.game.falseCall.noPattern) add('lines about the pattern', fillLine(line, { pattern }));
    for (const name of names) {
      for (const line of callerLines.game.botFalseCall) add('lines about the regulars', fillLine(line, { name, pattern }));
      for (const line of callerLines.game.botWins) add('lines about the regulars', fillLine(line, { name, pattern }));
    }
  }

  // False calls that name the number: one clip for every number.
  for (const n of NUMBERS) {
    const number = numberInWords(n);
    for (const line of callerLines.game.falseCall.notCalled) add('false calls that name a number', fillLine(line, { number }));
    for (const line of callerLines.game.falseCall.usedOnOtherCard) add('false calls that name a number', fillLine(line, { number }));
  }

  return Object.fromEntries(Object.entries(groups).map(([group, set]) => [group, [...set]]));
}

export function allLines(input) {
  return [...new Set(Object.values(collectLines(input)).flat())];
}
