import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/game.js';
import { createBot, botMarks, botToGo, botNeeds, playerCloseness } from '../src/engine/table.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const config = load('config');
const patterns = load('patterns');
const callerLines = load('caller-lines');
const regularsData = load('regulars');
const line = patterns.patterns.find((p) => p.id === 'line');

const perfect = (regular) => ({ ...regular, missChance: 0, falseCallChance: 0 });
const tableOf = (n = 3, tweak = perfect) => regularsData.regulars.slice(0, n).map(tweak);

function newGame({ stageIds = ['line'], regulars = tableOf(), speedId = 'quick' } = {}) {
  const game = new Game({ config, patterns, callerLines, speedId, stageIds, regulars });
  game.start();
  return game;
}

function run(game, totalMs, step = 100) {
  for (let t = 0; t < totalMs; t += step) game.advance(step);
}

// Plays the game with the player doing nothing, until the screen changes to something other than the cards.
function runUntilStageEnds(game, limitMs = 75 * 8000) {
  for (let t = 0; t < limitMs && game.screen === 'cards'; t += 100) game.advance(100);
}

test('a regular who marks every number never misses and counts down to zero squares to go', () => {
  const bot = createBot(perfect(regularsData.regulars[0]), config);
  const start = botToGo(bot, line, config);
  assert.equal(start, 4, 'a line on a free-centre card can be 4 away at the start, through the centre');
  for (let n = 1; n <= 75; n++) botMarks(bot, n, () => 0.99);
  assert.equal(botToGo(bot, line, config), 0);
});

test('a number a regular misses is noticed one call later', () => {
  const bot = createBot({ ...regularsData.regulars[0], missChance: 1 }, config);
  const number = bot.cards[0].grid[0][0];
  botMarks(bot, number, () => 0); // missed
  assert.ok(!bot.marked.has('0:0,0'));
  const other = bot.cards[0].grid[4][4];
  botMarks(bot, other, () => 0.99); // the next call: they notice the first one
  assert.ok(bot.marked.has('0:0,0'));
});

test('a regular who is sitting out does not mark', () => {
  const bot = createBot(perfect(regularsData.regulars[0]), config);
  bot.sitOut = 2;
  for (let n = 1; n <= 75; n++) botMarks(bot, n, () => 0.99);
  assert.equal(bot.marked.size, 0);
});

test('with perfect regulars and a player who does nothing, a regular wins the line', () => {
  const game = newGame();
  runUntilStageEnds(game);
  assert.equal(game.screen, 'result');
  assert.equal(game.result.outcome, 'lost');
  assert.equal(game.stageResults.length, 1);
  assert.equal(game.stageResults[0].winner.type, 'bot');
  assert.ok(game.called.length < 75, 'someone shouts long before the last number');
});

test('the player gets a small consolation when a regular wins, and none if they marked nothing', () => {
  const game = newGame();
  runUntilStageEnds(game);
  assert.equal(game.result.stages[0].credits, 0, 'no marks, no consolation');
  const cards = [{ grid: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === 2 && c === 2 ? 0 : c * 15 + r + 1))) }];
  const marks = [0, 1, 2].map((c) => ({ card: 0, row: 0, col: c, number: c * 15 + 1, seq: c }));
  const close = playerCloseness({ cards, marks, called: [1, 16, 31], pattern: line, config });
  assert.ok(close >= 0.6 && close < 1, `three of five on a row is ${close}`);
});

test('when a stage is won and more stages follow, the Stage won screen counts down and the night carries on', () => {
  const game = newGame({ stageIds: ['line', 'two-lines'] });
  runUntilStageEnds(game);
  assert.equal(game.screen, 'stageWon');
  assert.equal(game.phase, 'stageWon');
  assert.equal(game.stageIndex, 0);
  assert.equal(game.stageWon.winner.type, 'bot');
  const calledBefore = game.called.length;
  run(game, config.stageWon.nextStageCountdownSeconds * 1000 + 300);
  assert.equal(game.stageIndex, 1);
  assert.equal(game.screen, 'cards');
  assert.equal(game.phase, 'calling');
  assert.equal(game.called.length, calledBefore + 1, 'calling carries on from where it stopped');
  assert.equal(game.pattern.id, 'two-lines');
});

test('the whole night with perfect regulars ends with a result listing every stage', () => {
  const game = newGame({ stageIds: ['line', 'two-lines', 'full-house'] });
  for (let t = 0; t < 75 * 9000 && game.screen !== 'result'; t += 100) game.advance(100);
  assert.equal(game.screen, 'result');
  assert.ok(game.result.stages.length >= 1 && game.result.stages.length <= 3);
  assert.equal(typeof game.result.total, 'number');
});

test('a regular who shouts too soon is told off, sits out, and the game goes on', () => {
  const regulars = tableOf(3, (r) => ({ ...r, missChance: 0, falseCallChance: r.id === 'dot' ? 1 : 0 }));
  const game = newGame({ regulars, stageIds: ['full-house'] });
  let told = null;
  game.on((type, data) => { if (type === 'botFalseCall') told = data.bot; });
  for (let t = 0; t < 60 * 8000 && !told; t += 100) game.advance(100);
  assert.ok(told, 'someone shouted too soon');
  assert.equal(told.sitOut, config.table.botSitOutCalls);
  assert.equal(game.screen, 'cards', 'the player carries on playing');
  assert.ok(callerLines.game.botFalseCall.some((l) => game.bubble.text === l.replace('{name}', told.name).replace('{pattern}', game.pattern.spoken)));
});

test('regulars do not move while a claim is being checked', () => {
  const game = newGame();
  const bot = game.bots[0];
  game.screen = 'checking';
  game.phase = 'checking';
  game.checking = { stage: 'failed' };
  const before = game.clockMs;
  run(game, 5000);
  assert.equal(game.clockMs, before);
  assert.equal(bot.claim, null);
});

test('faces: a regular close to winning looks smug, one who just misbehaved looks sulky', () => {
  const game = newGame();
  const bot = game.bots[0];
  bot.marked.clear();
  assert.equal(game.botMood(bot), 'content');
  bot.sitOut = 1;
  assert.equal(game.botMood(bot), 'sulky');
});

test('a game with no regulars still works exactly as before', () => {
  const game = new Game({ config, patterns, callerLines, speedId: 'quick', stageIds: ['line'] });
  game.start();
  run(game, 20000);
  assert.equal(game.bots.length, 0);
  assert.notEqual(game.screen, 'stageWon');
});

test('a regular one square away is waiting for the numbers that would finish the line', () => {
  const bot = createBot(perfect(regularsData.regulars[0]), config);
  const card = bot.cards[0];
  // Mark the whole top row except its last square.
  for (let c = 0; c < 4; c++) bot.marked.add(`0:0,${c}`);
  const needed = card.grid[0][4];
  const waiting = botNeeds(bot, line, config, new Set());
  assert.ok(waiting.includes(needed), `waiting for ${waiting} and should include ${needed}`);
  assert.deepEqual(botNeeds(bot, line, config, new Set([needed])).includes(needed), false, 'a number already called is not waited for');
  const farAway = createBot(perfect(regularsData.regulars[0]), config);
  assert.deepEqual(botNeeds(farAway, line, config, new Set()), [], 'nothing is shown until they are one away');
});

test('nobody shouts over the player while they are calling bingo', () => {
  const game = newGame();
  const bot = game.bots[0];
  game.openShout();
  assert.equal(game.screen, 'shout');
  bot.claim = { dueAt: 0, kind: 'bingo' };
  for (const b of game.bots) for (const card of b.cards) card.grid.forEach((row, r) => row.forEach((n, c) => bot.marked.add(`${game.bots.indexOf(b) === 0 ? bot.cards.indexOf(card) : 0}:${r},${c}`)));
  game.advanceBots();
  assert.equal(game.screen, 'shout', 'the regular waits while the player calls');
});

test('a regular who has just got the pattern takes at least the minimum reaction time', () => {
  const game = newGame({ speedId: 'quick' });
  const bot = game.bots[0];
  for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) bot.marked.add(`0:${r},${c}`);
  game.botConsiders(bot);
  assert.ok(bot.claim, 'they decide to shout');
  assert.ok(bot.claim.dueAt - game.clockMs >= config.table.minReactionSeconds * 1000 - 1);
});

test('when the player wins first, the result says which regular they beat and by how long', () => {
  const game = newGame();
  const bot = game.bots[0];
  game.clockMs = 10000;
  game.claimClock = 10000;
  bot.claim = { dueAt: 11500, kind: 'bingo' };
  game.finishStage({ type: 'you' }, 20);
  const beat = game.stageResults[0].beat;
  assert.equal(beat.length, 1);
  assert.equal(beat[0].name, bot.name);
  assert.ok(Math.abs(beat[0].seconds - 1.5) < 0.01);
});

test('the card check never drags: a full house takes about as long as a couple of lines', () => {
  const game = newGame();
  const total = (n) => {
    const evaluation = { items: Array.from({ length: n }, () => ({})) };
    let sum = 0;
    for (let i = 0; i < n; i++) sum += game.revealDelay(evaluation, i);
    return sum;
  };
  assert.ok(total(5) < 14000, `one line ${total(5)}`);
  assert.ok(total(9) < 18000, `two lines ${total(9)}`);
  assert.ok(total(24) < 30000, `full house ${total(24)}`);
  const evaluation = { items: Array.from({ length: 24 }, () => ({})) };
  assert.equal(game.revealDelay(evaluation, 23), config.check.finalDelayMs, 'the last number is the slowest');
  assert.ok(game.revealDelay(evaluation, 5) <= config.check.briskDelayMs, 'numbers in the middle are quick');
});

test('the race director plants one rival per stage who usually finishes right on the planned call', async () => {
  const { completionCall } = await import('../src/engine/director.js');
  let close = 0;
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const game = newGame({ stageIds: ['line', 'two-lines'], regulars: tableOf(3, (r) => r) });
    assert.ok(game.plan, 'a plan was made');
    const positions = [];
    game.deck.forEach((n, k) => { positions[n] = k + 1; });
    game.plan.forEach((p) => {
      const pattern = patterns.patterns.find((x) => x.id === p.stage);
      const calls = game.bots.map((b) => completionCall(b.cards, positions, pattern, config));
      total += 1;
      if (Math.abs(calls[p.rival] - p.finish) <= 3) close += 1;
    });
  }
  assert.ok(close / total >= 0.75, `${close} of ${total} rivals finished within 3 calls of the plan`);
});

test('after a run of losses the likely shapes of the night have more wins, and after a run of wins fewer', async () => {
  const { arcWeights } = await import('../src/engine/director.js');
  const race = config.table.race;
  const share = (weights) => {
    let total = 0;
    let winWeight = 0;
    for (const [arc, w] of Object.entries(weights)) {
      total += w;
      winWeight += w * [...arc].filter((c) => c === 'W').length / arc.length;
    }
    return winWeight / total;
  };
  const neutral = share(arcWeights(race, 3, []));
  const losing = share(arcWeights(race, 3, [0, 0, 0, 0, 0, 1]));
  const winning = share(arcWeights(race, 3, [1, 1, 1, 1, 1, 1]));
  assert.ok(losing > neutral + 0.03, `losing ${losing} vs neutral ${neutral}`);
  assert.ok(winning < neutral - 0.03, `winning ${winning} vs neutral ${neutral}`);
});

test('nudging the deck for a full house keeps all 75 numbers and lets a card complete', async () => {
  const { shapeDeck } = await import('../src/engine/director.js');
  const game = newGame({ stageIds: ['line'] });
  const deck = game.deck.slice();
  const shaped = shapeDeck(deck, game.cards, config);
  assert.deepEqual([...shaped].sort((a, b) => a - b), Array.from({ length: 75 }, (_, i) => i + 1));
  const positions = [];
  shaped.forEach((n, i) => { positions[n] = i + 1; });
  const completes = game.cards.some((card) => Math.max(...card.grid.flat().filter((n) => n !== 0).map((n) => positions[n])) <= config.table.race.fullHouseCall[1]);
  assert.ok(completes, 'one card has all its numbers out by the planned call');
});
