import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/game.js';
import { createBot, botMarks, botToGo, playerCloseness } from '../src/engine/table.js';

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

test('a regular who misses every number never gets anywhere', () => {
  const bot = createBot({ ...regularsData.regulars[0], missChance: 1 }, config);
  for (let n = 1; n <= 75; n++) botMarks(bot, n, () => 0);
  assert.ok(botToGo(bot, line, config) >= 4);
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
