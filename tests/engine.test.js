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
const ms = (id) => config.speeds.find((x) => x.id === id).secondsPerCall * 1000;
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

test('the two cards share between the lowest and highest configured number of numbers, and it varies', () => {
  const fewest = config.cards.sharedNumbersBetweenPlayerCards;
  const most = fewest + config.cards.extraSharedNumbersMax;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const [a, b] = dealCards(config);
    const shared = cardNumbers(a).filter((n) => cardNumbers(b).includes(n)).length;
    assert.ok(shared >= fewest && shared <= most, `shared ${shared}`);
    seen.add(shared);
  }
  assert.equal(seen.size, most - fewest + 1, 'every amount from the lowest to the highest comes up');
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
  assert.equal(callText(8, callerLines, true), 'Eight, Garden gate!');
  assert.equal(callText(39, callerLines, true), 'Thirty-nine steps!', 'said as one phrase, no comma');
  assert.equal(callText(39, callerLines, false), 'Thirty-nine!', 'Quick speed is just the number');
  assert.equal(callText(50, callerLines, true), 'Fifty, Half a century!');
  // every nickname either says its own number or has the number read first
  for (const [n, nickname] of Object.entries(callerLines.nicknames)) {
    const said = callText(Number(n), callerLines, true).toLowerCase();
    assert.ok(said.includes(numberInWords(Number(n))), `${n} / ${nickname}`);
  }
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

test('a number on both cards can be marked on both, and both marks count', () => {
  const card = simpleCard();
  const called = [1, 2, 3, 4, 5];
  const marks = [0, 1, 2, 3, 4].map((r) => mark(0, r, 0, r + 1, r + 10));
  marks.push(mark(1, 0, 0, 3, 0)); // the same number 3 was also marked on card two, earlier
  const result = evaluateClaim({ cards: [card, simpleCard()], marks, called, pattern: line, config });
  assert.equal(result.result, 'win', 'the line on card one still checks out');
});

test('no complete line means a false call straight away', () => {
  const card = simpleCard();
  const marks = [0, 1, 2, 3].map((r) => mark(0, r, 0, r + 1, r));
  const result = evaluateClaim({ cards: [card], marks, called: [1, 2, 3, 4], pattern: line, config });
  assert.equal(result.result, 'noPattern');
  assert.deepEqual(result.order, [], 'the screen can always read the list of numbers, even when there are none');
  assert.deepEqual(result.items, []);
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
  runFor(game, ms('steady') - 100);
  assert.equal(game.phase, 'calling');
  runFor(game, 200);
  assert.equal(game.phase, 'locking');
  runFor(game, config.marking.lockMomentMs + 50);
  assert.equal(game.phase, 'calling');
  assert.notEqual(game.currentNumber, first);
  assert.equal(game.called.length, 2);
});

test('tapping the ball ends the call early and locks the mark', () => {
  const game = newGame();
  const first = game.currentNumber;
  game.tapSquare(0, 1, 1);
  game.skipCall();
  assert.equal(game.phase, 'locking');
  assert.equal(game.squareState(0, 1, 1), 'locked');
  game.skipCall(); // does nothing during the lock moment
  runFor(game, config.marking.lockMomentMs + 50);
  assert.equal(game.phase, 'calling');
  assert.notEqual(game.currentNumber, first);
  assert.equal(game.called.length, 2);
});

test('on the shout screen the player gets a grace period after the ring runs out', () => {
  const game = newGame('steady');
  const first = game.currentNumber;
  game.openShout();
  runFor(game, ms('steady') + config.marking.lockMomentMs + 200);
  assert.equal(game.phase, 'locking', 'still waiting for the claim');
  assert.equal(game.screen, 'shout');
  game.submitClaim(); // a claim in the grace period is still taken (no marks, so it is a false call)
  assert.equal(game.falseCalls, 1);
  assert.equal(game.screen, 'checking');
  assert.equal(game.currentNumber, first, 'the numbers wait while the caller explains');
});

test('without a claim the next number comes after the grace period', () => {
  const game = newGame('steady');
  const first = game.currentNumber;
  game.openShout();
  runFor(game, ms('steady') + config.shout.graceSeconds * 1000 + 200);
  assert.notEqual(game.currentNumber, first);
  assert.equal(game.screen, 'cards');
  assert.equal(game.falseCalls, 0, 'too slow is not a false call');
  assert.equal(game.sittingOut, false);
  assert.ok(game.notice, 'the player is told they were too slow');
  runFor(game, config.shout.tooSlowMessageSeconds * 1000 + 100);
  assert.equal(game.notice, null);
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
  runFor(game, ms('steady') + 100);
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

// Lets the caller finish and the next number start after a failed claim.
function finishFalseCall(game) {
  game.lineFinished();
  runFor(game, config.check.afterLineMs + 100);
}

test('a false call keeps the numbers waiting, then restarts the game and sits the player out for two calls', () => {
  const game = newGame();
  game.tapSquare(0, 0, 0);
  game.openShout();
  game.submitClaim(); // nothing near a line: false straight away
  assert.equal(game.screen, 'checking', 'the same checking screen, not a separate one');
  assert.equal(game.falseCalls, 1);
  assert.equal(game.called.length, 1, 'no new number while the caller is talking');
  assert.equal(game.phase, 'checking');
  runFor(game, 3000);
  assert.equal(game.called.length, 1, 'still waiting for the caller to finish');
  finishFalseCall(game);
  assert.equal(game.called.length, 2, 'the next number starts once he has finished');
  assert.equal(game.phase, 'calling');
  assert.equal(game.sitOut, 2);
  assert.equal(game.restartedAfterFalseCall, true);
  game.backToCards();
  assert.equal(game.screen, 'cards');
  game.tapSquare(0, 1, 1);
  assert.equal(game.pending, null, 'cannot mark while sitting out');
  assert.equal(game.canClaim, false);
  runFor(game, ms('steady') + config.marking.lockMomentMs + 100);
  assert.equal(game.sitOut, 1);
  runFor(game, ms('steady') + config.marking.lockMomentMs + 100);
  assert.equal(game.sitOut, 0);
  game.tapSquare(0, 1, 1);
  assert.notEqual(game.pending, null);
});

test('if the voice never reports back, the next number starts after the longest wait', () => {
  const game = newGame();
  game.openShout();
  game.submitClaim();
  runFor(game, config.check.failLineMaxMs - 200);
  assert.equal(game.called.length, 1);
  runFor(game, 400);
  assert.equal(game.called.length, 2);
});

test('with the voice off the line is simply given time to be read', () => {
  const game = newGame();
  game.openShout();
  game.submitClaim();
  game.lineFinished({ silent: true });
  runFor(game, config.check.silentFailMs - 200);
  assert.equal(game.called.length, 1);
  runFor(game, 400);
  assert.equal(game.called.length, 2);
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
    runFor(game, ms('quick') + config.marking.lockMomentMs + 50);
    game.tapSquare(0, 0, c);
  }
  game.openShout();
  game.submitClaim();
  assert.equal(game.screen, 'checking');
  assert.equal(game.phase, 'checking');
  const before = game.callElapsed;
  runFor(game, 40000);
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
  for (let t = 0; t < 60000 && game.checking?.stage !== 'failed'; t += 50) game.advance(50);
  assert.equal(game.screen, 'checking', 'the failure is shown on the checking screen');
  assert.equal(game.checking.stage, 'failed');
  assert.equal(game.falseCall.reason, 'notCalled');
  assert.equal(game.sitOut, 2);
  assert.equal(game.phase, 'checking', 'the numbers are paused while the caller explains');
  finishFalseCall(game);
  assert.equal(game.phase, 'calling');
});

// ---- Pausing ----

test('with a pause limit of one, the ring stops and carries on after a 3, 2, 1, and a second pause is refused', () => {
  const limited = { ...config, pause: { ...config.pause, pausesPerGame: 1 } };
  const game = new Game({ config: limited, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  game.start();
  runFor(game, 2000);
  const before = game.callElapsed;
  game.pauseByPlayer();
  assert.equal(game.pauseState, 'paused');
  assert.equal(game.pausesLeft, 0);
  runFor(game, 30000);
  assert.equal(game.callElapsed, before, 'no time passes while paused');
  game.resume();
  assert.equal(game.pauseState, 'resuming');
  runFor(game, 1000);
  assert.equal(game.callElapsed, before, 'no time passes during the countdown either');
  runFor(game, config.pause.resumeCountdownSeconds * 1000);
  assert.equal(game.pauseState, null);
  runFor(game, 500);
  assert.ok(game.callElapsed > before);
  game.pauseByPlayer();
  assert.equal(game.pauseState, null, 'a limit of one means one pause per game');
});

test('by default the player can pause as many times as they like', () => {
  assert.equal(config.pause.pausesPerGame, null, 'the setting means no limit');
  const game = newGame('steady');
  for (let i = 0; i < 4; i++) {
    runFor(game, 500);
    game.pauseByPlayer();
    assert.equal(game.pauseState, 'paused', `pause number ${i + 1} works`);
    game.resume();
    runFor(game, config.pause.resumeCountdownSeconds * 1000 + 100);
    assert.equal(game.pauseState, null);
  }
  assert.equal(game.pausesLeft, null);
});

test('when all 75 numbers are called with no winner, the caller says one of the no-winner lines', () => {
  const game = newGame('quick');
  const heard = [];
  game.on((type, data) => type === 'say' && heard.push(data.text));
  game.called = game.deck.slice(0, 74); // one ball left
  game.nextCall();
  game.callElapsed = game.callMs;
  runFor(game, game.callMs + config.marking.lockMomentMs + 200);
  assert.equal(game.phase, 'drawn');
  assert.ok(callerLines.game.noWinner.includes(heard.at(-1)), heard.at(-1));
});

test('pausing is not available during a shout or a check', () => {
  const game = newGame();
  game.openShout();
  assert.equal(game.canPause, false);
});

test('an automatic pause (switching apps) does not use up the pause', () => {
  const game = newGame();
  game.openShout();
  game.autoPause();
  assert.equal(game.pauseState, 'paused');
  assert.equal(game.screen, 'cards', 'the shout screen is closed');
  assert.equal(game.pausesLeft, null, 'an automatic pause never uses up a limit');
  game.resume();
  runFor(game, config.pause.resumeCountdownSeconds * 1000 + 100);
  assert.equal(game.pauseState, null);
  game.pauseByPlayer();
  assert.equal(game.pauseState, 'paused');
});

test('every line the caller says is announced for the voice', () => {
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  const heard = [];
  game.on((type, data) => type === 'say' && heard.push(data));
  game.start();
  assert.ok(heard.some((h) => h.kind === 'call'));
});

test('after a false call the caller says only the false-call line, not the next number too', () => {
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  game.start();
  const heard = [];
  game.on((type, data) => type === 'say' && heard.push(data));
  game.openShout();
  game.submitClaim(); // nothing marked: no line to check
  assert.equal(heard.length, 1);
  assert.match(heard[0].spoken, /can't see a line there/);
  assert.equal(game.bubble.mood, 'wince');
});

test('going back to the cards after a false call does not make the caller speak again', () => {
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  game.start();
  game.openShout();
  game.submitClaim();
  game.lineFinished();
  for (let t = 0; t < config.check.afterLineMs + 100; t += 50) game.advance(50);
  const heard = [];
  game.on((type, data) => type === 'say' && heard.push(data));
  game.backToCards();
  assert.equal(heard.length, 0, 'nothing is said when going back');
  assert.equal(game.screen, 'cards');
  assert.notEqual(game.bubble.mood, 'wince', 'the bubble shows the current number again');
});

test('the number after a false call is called aloud once the caller has finished', () => {
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'] });
  game.start();
  game.openShout();
  const heard = [];
  game.on((type, data) => type === 'say' && heard.push(data));
  game.submitClaim();
  assert.equal(heard.length, 1, 'only the false-call line at first');
  assert.equal(heard[0].kind, 'falseCall');
  game.lineFinished();
  for (let t = 0; t < config.check.afterLineMs + 100; t += 50) game.advance(50);
  assert.equal(heard.length, 2);
  assert.equal(heard[1].kind, 'call', 'then the new number, even if the player has not tapped back');
});

test('a claim with no complete line leaves the checking screen with a complete, readable state', () => {
  const game = newGame();
  game.openShout();
  game.submitClaim();
  const c = game.checking;
  assert.equal(c.stage, 'failed');
  assert.ok(Array.isArray(c.evaluation.order));
  assert.ok(Array.isArray(c.evaluation.items));
  assert.ok(Array.isArray(c.revealed));
});

// ---- The welcome before the first number ----

function introGame() {
  const game = new Game({ config, patterns, callerLines, speedId: 'steady', stageIds: ['line'], introLine: 'Welcome to Bingo night, everyone!' });
  game.start();
  return game;
}

test('with a welcome line the caller welcomes first and no number is called yet', () => {
  const game = introGame();
  assert.equal(game.phase, 'intro');
  assert.equal(game.called.length, 0);
  assert.equal(game.bubble.text, 'Welcome to Bingo night, everyone!');
  assert.equal(game.introCount, null, 'still welcoming, no count yet');
  assert.equal(game.canMark, false);
  assert.equal(game.canClaim, false);
  assert.equal(game.canPause, false);
  game.tapSquare(0, 1, 1);
  assert.equal(game.pending, null, 'cards cannot be marked before the first number');
  game.skipCall();
  assert.equal(game.called.length, 0, 'tapping the ball does nothing yet');
});

test('after the welcome a 3, 2, 1 counts in, the ring empties, and then the first number drops', () => {
  const game = introGame();
  const counts = [];
  const heard = [];
  game.on((type, data) => {
    if (type === 'introCount') counts.push(data.n);
    if (type === 'say') heard.push(data);
  });
  const { welcomeSeconds, countdownSeconds } = config.intro;
  runFor(game, welcomeSeconds * 1000 - 100);
  assert.equal(game.introCount, null);
  assert.equal(game.introRing, 0, 'the ring is full during the welcome');
  runFor(game, 200);
  assert.equal(game.introCount, countdownSeconds, 'the count starts at 3');
  assert.ok(heard.some((h) => h.kind === 'introCountdown' && h.spoken.includes('Three')), 'the caller counts');
  runFor(game, (countdownSeconds * 1000) / 2);
  assert.ok(game.introRing > 0.3 && game.introRing < 0.8, 'the ring is part way empty');
  runFor(game, (countdownSeconds * 1000) / 2 + 200);
  assert.deepEqual(counts, [3, 2, 1]);
  assert.equal(game.phase, 'intro', 'the first number waits while the caller finishes saying "Here we go!"');
  game.lineFinished(); // the voice has finished
  runFor(game, 100);
  assert.equal(game.phase, 'calling');
  assert.equal(game.called.length, 1, 'the first number has dropped');
  assert.equal(game.intro, null);
});

test('the first number does not wait for ever if the voice never reports back', () => {
  const game = introGame();
  const { welcomeSeconds, countdownSeconds, maxWaitForVoiceMs } = config.intro;
  runFor(game, (welcomeSeconds + countdownSeconds) * 1000 + maxWaitForVoiceMs - 200);
  assert.equal(game.called.length, 0);
  runFor(game, 500);
  assert.equal(game.called.length, 1);
});

test('the intro waits while paused and never starts without a welcome line', () => {
  const game = introGame();
  runFor(game, 1000);
  game.autoPause();
  const before = game.intro.elapsedMs;
  runFor(game, 20000);
  assert.equal(game.intro.elapsedMs, before, 'no time passes while paused');
  const plain = newGame();
  assert.equal(plain.phase, 'calling', 'no welcome line means the first number is called at once');
  assert.equal(plain.called.length, 1);
});
