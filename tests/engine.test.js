import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dealCards, cardNumbers, letterFor } from '../src/engine/cards.js';
import { candidateSquareSets } from '../src/engine/patterns.js';
import { evaluateClaim } from '../src/engine/check.js';
import { callText, numberInWords } from '../src/engine/caller.js';
import { Game } from '../src/engine/game.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const patterns = load('patterns');
const callerLines = load('caller-lines');
const line = patterns.patterns.find((p) => p.id === 'line');

// A card whose numbers are easy to read: column c, row r holds c * 15 + r + 1, centre free.
function simpleCard() {
  const grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => c * 15 + r + 1));
  grid[2][2] = 0;
  return { grid };
}

const mark = (card, row, col, number, seq) => ({ card, row, col, number, seq });

test('cards follow the column ranges and have a free centre', () => {
  for (let i = 0; i < 200; i++) {
    for (const card of dealCards(config)) {
      assert.equal(card.grid[2][2], 0);
      const all = cardNumbers(card);
      assert.equal(all.length, 24);
      assert.equal(new Set(all).size, 24);
      card.grid.forEach((row) => row.forEach((n, c) => {
        if (n !== 0) assert.equal(letterFor(n, config), 'BINGO'[c]);
      }));
    }
  }
});

test('the two cards share exactly the configured number of numbers', () => {
  for (let i = 0; i < 200; i++) {
    const [a, b] = dealCards(config);
    const shared = cardNumbers(a).filter((n) => cardNumbers(b).includes(n));
    assert.equal(shared.length, config.cards.sharedNumbersBetweenPlayerCards);
  }
});

test('pattern candidates', () => {
  const lines = candidateSquareSets(line);
  assert.equal(lines.length, 12);
  assert.ok(lines.every((l) => l.length === 5));
  const twoLines = candidateSquareSets(patterns.patterns.find((p) => p.id === 'two-lines'));
  assert.equal(twoLines.length, 66);
  const full = candidateSquareSets(patterns.patterns.find((p) => p.id === 'full-house'));
  assert.equal(full.length, 1);
  assert.equal(full[0].length, 25);
});

test('numbers are spoken', () => {
  assert.equal(numberInWords(47), 'forty-seven');
  assert.equal(numberInWords(30), 'thirty');
  assert.equal(callText(11, callerLines, true), 'Legs eleven!');
  assert.equal(callText(47, callerLines, true), 'Four and seven, forty-seven!');
  assert.equal(callText(11, callerLines, false), 'Eleven!');
});

test('a correct line wins', () => {
  const card = simpleCard();
  const called = [1, 2, 3, 4, 5];
  const marks = [0, 1, 2, 3, 4].map((r) => mark(0, r, 0, r + 1, r));
  const result = evaluateClaim({ cards: [card], marks, called, pattern: line, config });
  assert.equal(result.result, 'win');
  assert.equal(result.order.length, 5);
});

test('a line through the free centre only reveals four numbers', () => {
  const card = simpleCard();
  const called = [3, 18, 48, 63];
  const marks = [mark(0, 2, 0, 3, 0), mark(0, 2, 1, 18, 1), mark(0, 2, 3, 48, 2), mark(0, 2, 4, 63, 3)];
  const result = evaluateClaim({ cards: [card], marks, called, pattern: line, config });
  assert.equal(result.result, 'win');
  assert.equal(result.order.length, 4);
});

test('a number that was never called fails', () => {
  const card = simpleCard();
  const called = [1, 2, 3, 4]; // 5 was never called
  const marks = [0, 1, 2, 3, 4].map((r) => mark(0, r, 0, r + 1, r));
  const result = evaluateClaim({ cards: [card], marks, called, pattern: line, config });
  assert.equal(result.result, 'fail');
  assert.equal(result.reason, 'notCalled');
  assert.equal(result.failItem.number, 5);
  assert.equal(result.order.at(-1), result.failItem); // it stops at the first bad number
});

test('a number already used on the other card fails', () => {
  const card = simpleCard();
  const called = [1, 2, 3, 4, 5];
  const marks = [0, 1, 2, 3, 4].map((r) => mark(0, r, 0, r + 1, r + 10));
  marks.push(mark(1, 0, 0, 3, 0)); // the same number 3 was marked first on card two
  const result = evaluateClaim({ cards: [card, simpleCard()], marks, called, pattern: line, config });
  assert.equal(result.result, 'fail');
  assert.equal(result.reason, 'usedOnOtherCard');
  assert.equal(result.failItem.number, 3);
});

test('no complete line means a false call straight away', () => {
  const card = simpleCard();
  const marks = [0, 1, 2, 3].map((r) => mark(0, r, 0, r + 1, r));
  const result = evaluateClaim({ cards: [card], marks, called: [1, 2, 3, 4], pattern: line, config });
  assert.equal(result.result, 'noPattern');
});

test('a claim wins if any complete candidate is fully valid', () => {
  const card = simpleCard();
  // Column 0 is complete but number 5 was never called. Row 2 (through the centre) is complete and valid.
  const marks = [
    ...[0, 1, 2, 3, 4].map((r) => mark(0, r, 0, r + 1, r)),
    mark(0, 2, 1, 18, 5), mark(0, 2, 3, 48, 6), mark(0, 2, 4, 63, 7),
  ];
  const called = [1, 2, 3, 4, 18, 48, 63];
  const result = evaluateClaim({ cards: [card], marks, called, pattern: line, config });
  assert.equal(result.result, 'win');
});

// ---- The whole game ----

function newGame(speedId = 'steady') {
  const game = new Game({ config, patterns, callerLines, speedId, stageIds: ['line'] });
  game.start();
  return game;
}

function runFor(game, ms) {
  for (let t = 0; t < ms; t += 50) game.advance(50);
}

test('a call lasts the speed setting, then locks, then the next number comes', () => {
  const game = newGame('steady');
  const first = game.currentNumber;
  runFor(game, 4900);
  assert.equal(game.phase, 'calling');
  runFor(game, 200);
  assert.equal(game.phase, 'locking');
  runFor(game, config.marking.lockMomentMs + 50);
  assert.equal(game.phase, 'calling');
  assert.notEqual(game.currentNumber, first);
  assert.equal(game.called.length, 2);
});

test('one movable mark per call, and it locks when the ring runs out', () => {
  const game = newGame();
  game.tapSquare(0, 0, 0);
  game.tapSquare(1, 3, 3); // moves it to the other card
  assert.equal(game.squareState(0, 0, 0), 'empty');
  assert.equal(game.squareState(1, 3, 3), 'pending');
  game.tapSquare(1, 3, 3); // tap again to take it back
  assert.equal(game.pending, null);
  game.tapSquare(0, 1, 1);
  runFor(game, 5100);
  assert.equal(game.squareState(0, 1, 1), 'locked');
  assert.equal(game.marks.length, 1);
  game.tapSquare(0, 1, 1); // locked marks can never change
  assert.equal(game.marks.length, 1);
  assert.equal(game.pending, null);
});

test('marks cannot be placed while locked in or on the shout screen', () => {
  const game = newGame();
  game.openShout();
  game.tapSquare(0, 0, 0);
  assert.equal(game.pending, null);
});

test('a false call restarts the game and sits the player out for two calls', () => {
  const game = newGame();
  game.tapSquare(0, 0, 0);
  game.openShout();
  game.submitClaim(); // nothing near a line: false straight away
  assert.equal(game.screen, 'falseCall');
  assert.equal(game.falseCalls, 1);
  assert.equal(game.called.length, 2, 'the next number is already running');
  assert.equal(game.sitOut, 2);
  game.backToCards();
  game.tapSquare(0, 1, 1);
  assert.equal(game.pending, null, 'cannot mark while sitting out');
  assert.equal(game.canClaim, false);
  runFor(game, 5100 + config.marking.lockMomentMs + 50);
  assert.equal(game.sitOut, 1);
  runFor(game, 5100 + config.marking.lockMomentMs + 50);
  assert.equal(game.sitOut, 0);
  game.tapSquare(0, 1, 1);
  assert.notEqual(game.pending, null);
});

test('a full game with a correct claim is won after the check', () => {
  const game = newGame('quick');
  // Cheat in the test: mark the first row of card one, one number per call, calling exactly those numbers.
  const grid = game.cards[0].grid;
  const rowNumbers = grid[0];
  game.deck = [...rowNumbers, ...game.deck.filter((n) => !rowNumbers.includes(n))];
  game.called = [game.deck[0]];
  game.tapSquare(0, 0, 0);
  for (let c = 1; c < 5; c++) {
    runFor(game, 3000 + config.marking.lockMomentMs + 50);
    game.tapSquare(0, 0, c);
  }
  game.openShout();
  game.submitClaim();
  assert.equal(game.screen, 'checking');
  assert.equal(game.phase, 'checking');
  const before = game.callElapsed;
  runFor(game, 20000);
  assert.equal(game.callElapsed, before, 'the ring is stopped during the check');
  assert.equal(game.phase, 'won');
  assert.equal(game.screen, 'result');
});

test('a bad claim is caught during the check, then the game goes on', () => {
  const game = newGame();
  const grid = game.cards[0].grid;
  // Mark a whole row without those numbers ever being called.
  game.deck = game.deck.filter((n) => !grid[0].includes(n));
  game.called = [game.deck[0]];
  game.deck = [game.deck[0], ...game.deck.slice(1)];
  const picks = [];
  for (let c = 0; c < 5; c++) {
    game.tapSquare(0, 0, c);
    picks.push(c);
    game.lockMarks();
  }
  game.openShout();
  game.submitClaim();
  assert.equal(game.screen, 'checking');
  runFor(game, 3000);
  assert.equal(game.screen, 'falseCall');
  assert.equal(game.falseCall.reason, 'notCalled');
  assert.equal(game.sitOut, 2);
  assert.equal(game.phase, 'calling');
});
