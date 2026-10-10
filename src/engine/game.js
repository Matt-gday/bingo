import { dealCards, letterFor } from './cards.js';
import { pickOne, shuffle } from './rng.js';
import { evaluateClaim } from './check.js';
import { callText, capital, fillLine, numberInWords, sayLine } from './caller.js';
import { createBot, botMarks, botToGo, botNeeds, playerCloseness } from './table.js';
import { planRace, shapeForFullHouse } from './director.js';

// The rules of one game of bingo. This file knows nothing about the screen.
// The screen calls advance() many times a second and reads the state it needs.
//
// phase  = what the game itself is doing:
//   calling  - a number is out and its ring is running
//   locking  - the ring has run out and the marks have just locked
//   checking - the caller is checking a claim (the ring is stopped)
//   won      - the player's claim checked out
//   stageWon - a stage has been won (by the player or a regular) and the night carries on
//   over     - the night is over
//   drawn    - all 75 numbers were called and nobody won
// screen = what the player is looking at:
//   cards, shout, checking, falseCall, stageWon, result

const MAX_FRAME_MS = 250; // a long gap (the phone slept, the tab was hidden) must not skip calls

export class Game {
  constructor({ config, patterns, callerLines, speedId, stageIds = ['line'], introLine = null, regulars = [], history = [] }) {
    this.config = config;
    this.history = history; // how the player's recent stages went (1 = won, 0 = lost), to keep nights fair
    this.regulars = regulars; // the regulars at the table tonight (none = a game with just the player)
    this.introLine = introLine; // the welcome the caller says before the first number (none = start straight away)
    this.callerLines = callerLines;
    this.speed = config.speeds.find((s) => s.id === speedId) ?? config.speeds[0];
    this.stages = stageIds.map((id) => patterns.patterns.find((p) => p.id === id));
    this.stageIndex = 0;
    this.listeners = [];
    this.setup();
  }

  setup() {
    this.cards = dealCards(this.config);
    this.deck = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
    this.called = [];
    this.callElapsed = 0;
    this.lockElapsed = 0;
    this.phase = 'calling';
    this.screen = 'cards';
    this.marks = [];
    this.pending = null;
    this.markSeq = 0;
    this.sitOut = 0;
    this.falseCalls = 0;
    this.checking = null;
    this.falseCall = null;
    this.result = null;
    this.bubble = { text: '', mood: 'talking' };
    this.notice = null; // a short message over the cards, such as "Too slow!"
    this.intro = null; // { stage: 'welcome' | 'countdown', elapsedMs, count } before the first number
    this.pendingRestart = null; // after a failed claim, the next number waits for the caller to finish
    this.pauseState = null; // null, 'paused' or 'resuming' (the 3, 2, 1)
    this.pauseReason = null; // 'player' or 'auto'
    this.pausesLeft = this.config.pause.pausesPerGame;
    this.resumeMs = 0;
    // The table: the regulars' own cards and marks, and how the night has gone so far.
    this.bots = this.regulars.map((regular) => createBot(regular, this.config));
    // The race director picks each regular's cards so every stage is a real race (see director.js).
    this.plan = null;
    if (this.bots.length && this.config.table?.race?.enabled) {
      if (this.stages.some((p) => p.rule === 'all')) this.deck = shapeForFullHouse(this.deck, this.cards, this.stages, this.config); // make a full house reachable
      const { plan, cards } = planRace({
        playerCards: this.cards, deck: this.deck, stages: this.stages, botCount: this.bots.length, config: this.config, history: this.history,
      });
      this.plan = plan;
      this.bots.forEach((bot, i) => {
        bot.cards = cards[i];
        bot.missChance = 0; // their pace is planned, not left to luck
      });
    }
    this.clockMs = 0; // game time, which stops whenever the game is paused or checking a claim
    this.stageResults = []; // one entry per finished stage: who won it and what the player earned
    this.stageWon = null; // the "Stage won" screen while it is showing
    this.stageIndex = 0;
  }

  on(listener) {
    this.listeners.push(listener);
  }

  emit(type, data) {
    for (const listener of this.listeners) listener(type, data);
  }

  // ---- Things the screen reads ----

  get pattern() {
    return this.stages[this.stageIndex];
  }

  get callMs() {
    return this.speed.secondsPerCall * 1000;
  }

  get currentNumber() {
    return this.called[this.called.length - 1] ?? null;
  }

  get callProgress() {
    if (this.phase === 'intro') return this.introRing;
    if (this.phase === 'locking') return 1;
    return Math.min(1, this.callElapsed / this.callMs);
  }

  // The last few calls, newest first. The call that is still running is not included,
  // but once it has locked it joins the list.
  get recentCalls() {
    const shown = this.config.marking.recentCallsShown;
    const earlier = this.phase === 'calling' ? this.called.slice(0, -1) : this.called;
    return earlier.slice(-shown).reverse();
  }

  // On the shout screen the player gets a little extra time once the ring has run out,
  // so a hold that was started near the end can still finish.
  get graceMs() {
    return this.config.shout.graceSeconds * 1000;
  }

  get lockLimitMs() {
    const lock = this.config.marking.lockMomentMs;
    return this.screen === 'shout' ? Math.max(lock, this.graceMs) : lock;
  }

  // How far through the time to call (the ring plus the grace) the player is, from 0 to 1.
  get claimProgress() {
    const window = this.callMs + Math.max(this.config.marking.lockMomentMs, this.graceMs);
    if (this.phase === 'locking') return Math.min(1, (this.callMs + this.lockElapsed) / window);
    return Math.min(1, this.callElapsed / window);
  }

  get sittingOut() {
    return this.sitOut > 0;
  }

  squareState(card, row, col) {
    if (this.pending && this.pending.card === card && this.pending.row === row && this.pending.col === col) {
      return 'pending';
    }
    return this.marks.some((m) => m.card === card && m.row === row && m.col === col) ? 'locked' : 'empty';
  }

  // ---- The regulars ----

  botToGo(bot) {
    return botToGo(bot, this.pattern, this.config);
  }

  // The numbers a regular is waiting for (only when they are one square away). Shown at the table.
  botNeeds(bot) {
    return botNeeds(bot, this.pattern, this.config, new Set(this.called));
  }

  // What a regular's face shows right now.
  botMood(bot) {
    if (this.stageWon?.moods?.[bot.id]) return this.stageWon.moods[bot.id];
    if (bot.mood && bot.mood.until > this.clockMs) return bot.mood.name;
    if (bot.sitOut > 0) return 'sulky';
    return this.botToGo(bot) <= 1 ? 'smug' : 'content';
  }

  setBotMood(bot, name, seconds = this.config.table?.moodSeconds ?? 3.5) {
    bot.mood = { name, until: this.clockMs + seconds * 1000 };
  }

  // After a number is called, every regular marks it (or misses it), then decides whether to shout.
  botsReact(number) {
    for (const bot of this.bots) {
      botMarks(bot, number);
      this.botConsiders(bot);
    }
  }

  // A regular who has the pattern shouts after a short reaction. One who is close might shout too soon.
  botConsiders(bot) {
    if (bot.claim || bot.sitOut > 0) return;
    const toGo = this.botToGo(bot);
    const [low, high] = bot.reactionShare; // a share of one call: slower calling gives the player more time
    const floor = (this.config.table?.minReactionSeconds ?? 0) * 1000;
    const delay = Math.max(floor, (low + Math.random() * (high - low)) * this.callMs);
    if (toGo === 0) {
      bot.claim = { dueAt: this.clockMs + delay, kind: 'bingo' };
    } else if (toGo <= (this.config.table?.nearGoForFalseCall ?? 2) && Math.random() < bot.falseCallChance) {
      bot.claim = { dueAt: this.clockMs + delay, kind: 'false' };
    }
  }

  advanceBots() {
    if (this.phase !== 'calling' && this.phase !== 'locking') return;
    if (this.screen === 'shout') return; // the player is calling bingo: nobody shouts over them
    for (const bot of this.bots) {
      if (bot.claim && this.clockMs >= bot.claim.dueAt) {
        const claim = bot.claim;
        bot.claim = null;
        if (claim.kind === 'bingo' && this.botToGo(bot) === 0) this.botWins(bot);
        else this.botFalseCall(bot);
        if (this.phase === 'stageWon' || this.phase === 'over') return;
      }
    }
  }

  botFalseCall(bot) {
    bot.sitOut = this.config.table?.botSitOutCalls ?? this.config.falseCall.sitOutCalls;
    this.setBotMood(bot, 'sulky', 5);
    for (const other of this.bots) if (other !== bot) this.setBotMood(other, 'shocked', 2);
    this.say(fillLine(pickOne(this.callerLines.game.botFalseCall), { name: bot.name, pattern: this.pattern.spoken }), 'talking', 'botFalseCall');
    this.emit('botFalseCall', { bot });
  }

  botWins(bot) {
    if (this.screen === 'shout') this.screen = 'cards';
    this.lockMarks();
    const closeness = playerCloseness({
      cards: this.cards, marks: this.marks, called: this.called, pattern: this.pattern, config: this.config,
    });
    const credits = Math.round(this.pattern.payout * this.config.credits.closenessMaxShareOfPayout * closeness);
    this.say(fillLine(pickOne(this.callerLines.game.botWins), { name: bot.name, pattern: this.pattern.spoken }), 'cheer', 'botWins');
    this.finishStage({ type: 'bot', id: bot.id, name: bot.name, colour: bot.colour }, credits);
  }

  // A stage is over. If there are more stages the "Stage won" screen shows and the night carries on;
  // otherwise the night is over and the result shows.
  finishStage(winner, credits) {
    const last = this.stageIndex === this.stages.length - 1;
    const numbers = winner.type === 'you' ? this.checking?.evaluation?.order?.map((item) => item.number) ?? [] : [];
    // Whom the player beat to it, and by how much: regulars who had the pattern and were about to shout.
    const beat = winner.type !== 'you' ? [] : this.bots
      .filter((b) => b.claim?.kind === 'bingo' && b.claim.dueAt >= (this.claimClock ?? this.clockMs))
      .map((b) => ({ id: b.id, name: b.name, seconds: Math.max(0.1, (b.claim.dueAt - (this.claimClock ?? this.clockMs)) / 1000) }))
      .sort((a, b) => a.seconds - b.seconds);
    this.stageResults.push({ index: this.stageIndex, pattern: this.pattern, winner, credits, numbers, beat });
    this.checking = null;
    for (const bot of this.bots) bot.claim = null;
    this.emit('stageDone', { won: winner.type === 'you' });
    if (last) {
      this.phase = winner.type === 'you' ? 'won' : 'over';
      this.screen = 'result';
      this.result = this.buildResult(winner.type === 'you' ? 'win' : 'lost');
      this.emit('end', { outcome: this.result.outcome });
      return;
    }
    const moods = {};
    for (const bot of this.bots) moods[bot.id] = winner.id === bot.id ? 'cheer' : winner.type === 'you' ? 'sulky' : 'shocked';
    this.phase = 'stageWon';
    this.screen = 'stageWon';
    const ms = (this.config.stageWon?.nextStageCountdownSeconds ?? 3) * 1000;
    this.stageWon = {
      winner, credits: Math.round(credits * this.speed.creditMultiplier), moods,
      next: this.stages[this.stageIndex + 1], msLeft: ms, totalMs: ms,
    };
    this.emit('stageWon', { winner });
  }

  // The 3, 2, 1 has finished: the next stage opens on the same cards and marks, and calling carries on.
  openNextStage() {
    this.stageIndex += 1;
    this.stageWon = null;
    this.screen = 'cards';
    this.phase = 'calling';
    for (const bot of this.bots) {
      bot.claim = null;
      bot.mood = null;
    }
    this.nextCall();
    // A regular who already holds the new pattern can shout straight away.
    for (const bot of this.bots) this.botConsiders(bot);
  }

  buildResult(outcome) {
    const base = this.stageResults.reduce((sum, r) => sum + r.credits, 0);
    const multiplier = this.speed.creditMultiplier;
    const penalty = this.falseCalls * this.config.falseCall.creditPenaltyShare;
    const total = Math.max(0, Math.round(base * multiplier * (1 - penalty)));
    return {
      outcome, falseCalls: this.falseCalls, calls: this.called.length,
      stages: this.stageResults, base, multiplier, penalty, total,
    };
  }

  // ---- Starting and calling ----

  start() {
    this.setup();
    if (this.introLine && this.config.intro) {
      // The caller welcomes the player while they look over their cards, then counts 3, 2, 1.
      this.phase = 'intro';
      this.intro = { stage: 'welcome', elapsedMs: 0, count: null };
      this.say(this.introLine, 'smile', 'intro');
      this.emit('intro');
      return;
    }
    this.say(sayLine(this.callerLines, 'start', {}), 'smile');
    this.nextCall();
  }

  get introMs() {
    const { welcomeSeconds, countdownSeconds } = this.config.intro;
    return { welcome: welcomeSeconds * 1000, countdown: countdownSeconds * 1000 };
  }

  // The number on show while counting in (3, 2, 1), or null while the caller is still welcoming.
  get introCount() {
    return this.intro?.stage === 'countdown' ? this.intro.count : null;
  }

  // How far through the count-in the ring is, from 0 (full ring) to 1 (empty).
  get introRing() {
    if (this.intro?.stage !== 'countdown') return 0;
    const { welcome, countdown } = this.introMs;
    return Math.min(1, (this.intro.elapsedMs - welcome) / countdown);
  }

  advanceIntro(dt) {
    const intro = this.intro;
    const { welcome, countdown } = this.introMs;
    intro.elapsedMs += dt;
    if (intro.stage === 'welcome' && intro.elapsedMs >= welcome) {
      intro.stage = 'countdown';
      intro.count = Math.ceil(countdown / 1000);
      this.say(pickOne(this.callerLines.game.introCountdown), 'cheer', 'introCountdown');
      this.emit('introCount', { n: intro.count });
    }
    if (intro.stage === 'countdown') {
      const left = welcome + countdown - intro.elapsedMs;
      if (left <= 0) {
        // The first number waits until the caller has finished "Here we go!" (or a short limit passes).
        intro.waitedMs = (intro.waitedMs ?? 0) + dt;
        if (!intro.voiceDone && intro.waitedMs < (this.config.intro.maxWaitForVoiceMs ?? 0)) return;
        this.intro = null;
        this.nextCall(); // the first number drops
        return;
      }
      const n = Math.ceil(left / 1000);
      if (n !== intro.count) {
        intro.count = n;
        this.emit('introCount', { n });
      }
    }
  }

  // `announce: false` is used after a false call, when the caller is about to say something else.
  nextCall({ announce = true } = {}) {
    if (this.called.length >= this.deck.length) {
      this.phase = 'drawn';
      this.screen = 'result';
      this.result = this.buildResult('drawn');
      this.say(sayLine(this.callerLines, 'noWinner', {}), 'smile');
      this.emit('end', { outcome: 'drawn' });
      return;
    }
    this.called.push(this.deck[this.called.length]);
    this.callElapsed = 0;
    this.phase = 'calling';
    if (this.screen === 'shout') {
      // The next number came before the claim was made. That is not a false call, just too slow.
      this.screen = 'cards';
      this.notice = {
        text: sayLine(this.callerLines, 'tooSlow', {}),
        msLeft: this.config.shout.tooSlowMessageSeconds * 1000,
      };
      this.emit('tooSlow');
    }
    const callLine = callText(this.currentNumber, this.callerLines, this.speed.useNicknames);
    if (announce) this.say(callLine, 'talking', 'call');
    else this.bubble = { text: callLine, mood: 'talking' };
    this.emit('call', { number: this.currentNumber });
    this.botsReact(this.currentNumber);
  }

  // Everything the caller says goes in his bubble, and the voice reads it out if it is on.
  // `spoken` is what the voice says when it differs from the bubble (the bubble shows digits).
  say(text, mood = 'talking', kind = 'line', spoken = text) {
    this.bubble = { text, mood, spoken };
    this.emit('say', { text, mood, kind, spoken });
  }

  advance(dtMs) {
    const dt = Math.min(dtMs, MAX_FRAME_MS);
    if (this.pauseState === 'paused') return;
    if (this.pauseState === 'resuming') {
      this.resumeMs -= dt;
      if (this.resumeMs <= 0) {
        this.pauseState = null;
        this.pauseReason = null;
        this.emit('resume');
      } else if (this.resumeCount !== this.lastCount) {
        this.lastCount = this.resumeCount;
        this.emit('countdown', { n: this.lastCount });
      }
      return;
    }
    if (this.phase === 'intro') {
      this.advanceIntro(dt);
      return;
    }
    if (this.phase === 'stageWon') {
      this.stageWon.msLeft -= dt;
      if (this.stageWon.msLeft <= 0) this.openNextStage();
      return;
    }
    if (this.phase === 'calling' || this.phase === 'locking') this.clockMs += dt;
    if (this.notice) {
      this.notice.msLeft -= dt;
      if (this.notice.msLeft <= 0) this.notice = null;
    }
    if (this.pendingRestart) {
      this.pendingRestart.msLeft -= dt;
      if (this.pendingRestart.msLeft <= 0) this.restartAfterFalseCall();
    }
    if (this.checking && this.checking.stage !== 'failed') this.advanceChecking(dt);
    this.advanceBots();
    if (this.phase === 'calling') {
      this.callElapsed += dt;
      if (this.callElapsed >= this.callMs) this.endCall();
    } else if (this.phase === 'locking') {
      this.lockElapsed += dt;
      if (this.lockElapsed >= this.lockLimitMs) this.nextCall();
    }
  }

  // The player taps the ball to move on without waiting for the ring.
  skipCall() {
    if (this.phase === 'calling' && this.screen === 'cards') {
      this.emit('skip');
      this.endCall();
    }
  }

  endCall() {
    this.lockMarks();
    if (this.sitOut > 0) this.sitOut -= 1;
    for (const bot of this.bots) if (bot.sitOut > 0) bot.sitOut -= 1;
    this.phase = 'locking';
    this.lockElapsed = 0;
    this.emit('lock');
  }

  // ---- Pausing ----

  get canPause() {
    return !this.pauseState && (this.pausesLeft === null || this.pausesLeft > 0)
      && (this.phase === 'calling' || this.phase === 'locking') && this.screen === 'cards';
  }

  get resumeCount() {
    return Math.max(1, Math.ceil(this.resumeMs / 1000));
  }

  // The player's own pause (unlimited unless Data/config.json sets a limit).
  pauseByPlayer() {
    if (!this.canPause) return;
    if (this.pausesLeft !== null) this.pausesLeft -= 1; // null = unlimited
    this.pauseState = 'paused';
    this.pauseReason = 'player';
    this.emit('pause');
  }

  // Switching apps or a phone call: the game covers itself without using up the player's pause.
  autoPause() {
    if (this.pauseState || this.phase === 'won' || this.phase === 'drawn' || this.phase === 'over' || this.phase === 'stageWon' || this.screen === 'result') return;
    if (this.screen === 'shout') this.screen = 'cards';
    this.pauseState = 'paused';
    this.pauseReason = 'auto';
    this.emit('pause');
  }

  resume() {
    if (this.pauseState !== 'paused') return;
    this.pauseState = 'resuming';
    this.resumeMs = this.config.pause.resumeCountdownSeconds * 1000;
    this.lastCount = this.resumeCount;
    this.emit('countdown', { n: this.lastCount });
  }

  // ---- Marking ----

  get canMark() {
    return this.phase === 'calling' && this.screen === 'cards' && !this.sittingOut;
  }

  tapSquare(card, row, col) {
    if (!this.canMark) return;
    if (this.cards[card].grid[row][col] === 0) return; // the free square
    const state = this.squareState(card, row, col);
    if (state === 'locked') return;
    if (state === 'pending') {
      this.pending = null;
      this.emit('unmark');
    } else {
      // One mark per call: this either places it or moves it from where it was.
      this.pending = { card, row, col, number: this.cards[card].grid[row][col] };
      this.emit('mark');
    }
  }

  lockMarks() {
    if (!this.pending) return;
    this.marks.push({ ...this.pending, callIndex: this.called.length - 1, seq: this.markSeq++ });
    this.pending = null;
  }

  // ---- Claiming bingo ----

  get canClaim() {
    return (this.phase === 'calling' || this.phase === 'locking') && this.screen === 'cards' && !this.sittingOut;
  }

  openShout() {
    if (!this.canClaim) return;
    this.screen = 'shout';
    this.notice = null;
    this.emit('shout');
  }

  closeShout() {
    if (this.screen === 'shout') this.screen = 'cards';
  }

  // The player has shouted (or held the button). The caller checks the card.
  submitClaim() {
    if (this.screen !== 'shout' || (this.phase !== 'calling' && this.phase !== 'locking')) return;
    this.lockMarks();
    this.claimClock = this.clockMs; // when the player's claim went in
    const evaluation = evaluateClaim({
      cards: this.cards,
      marks: this.marks,
      called: this.called,
      pattern: this.pattern,
      config: this.config,
    });
    if (evaluation.result === 'noPattern') {
      // No complete line to check: the same checking screen, with nothing to tick and the caller saying why.
      this.phase = 'checking';
      this.screen = 'checking';
      this.checking = { evaluation, index: 0, revealed: [], stage: 'failed', elapsed: 0, waitMs: 0 };
      this.startFalseCall(evaluation);
      return;
    }
    this.phase = 'checking';
    this.screen = 'checking';
    this.checking = {
      evaluation,
      index: 0,
      revealed: [],
      stage: 'waiting',
      elapsed: 0,
      waitMs: this.revealDelay(evaluation, 0),
    };
    this.sayChecking();
    this.emit('claim');
  }

  // How long to wait before revealing number `index` of a claim. The first wait sets the scene, the middle numbers
  // tick over briskly (so a long claim like a full house does not drag), the last few build up, and the very
  // last number takes the longest.
  revealDelay(evaluation, index) {
    const { firstDelayMs, briskDelayMs, buildNumbers, buildDelayMs, buildGrowth, finalDelayMs } = this.config.check;
    const count = evaluation.items.length;
    if (index > 0 && index === count - 1) return finalDelayMs;
    if (index === 0) return firstDelayMs;
    const buildStart = count - 1 - buildNumbers; // the first of the slowing-down numbers
    if (index >= buildStart) return buildDelayMs * buildGrowth ** (index - buildStart);
    return briskDelayMs;
  }

  get isFinalReveal() {
    const c = this.checking;
    return !!c && c.stage === 'waiting' && c.index > 0 && c.index === c.evaluation.items.length - 1;
  }

  sayChecking() {
    const { evaluation, index } = this.checking;
    const number = evaluation.order[index].number;
    this.say(`${capital(numberInWords(number))}...`);
  }

  advanceChecking(dt) {
    const c = this.checking;
    c.elapsed += dt;
    if (c.stage === 'waiting' && c.elapsed >= c.waitMs) {
      const item = c.evaluation.order[c.index];
      c.revealed[c.index] = item.problem ? 'bad' : 'ok';
      c.elapsed = 0;
      if (item.problem) {
        c.stage = 'failed'; // the checking screen stays; the next number waits for the caller to finish
        this.startFalseCall(c.evaluation);
        this.emit('reveal', { ok: false });
      } else if (c.index === c.evaluation.order.length - 1) {
        c.stage = 'concluded';
        this.phase = 'won';
        this.say(sayLine(this.callerLines, 'win', { pattern: this.pattern.spoken }), 'cheer');
        this.emit('reveal', { ok: true, last: true, count: c.index + 1 });
      } else {
        c.index += 1;
        c.waitMs = this.revealDelay(c.evaluation, c.index);
        this.sayChecking();
        this.emit('reveal', { ok: true, count: c.index });
        if (this.isFinalReveal) this.emit('build'); // the slow, dramatic last number begins
      }
    } else if (c.stage === 'concluded' && c.elapsed >= this.config.check.resultBeatMs) {
      this.finishStage({ type: 'you' }, this.pattern.payout);
    }
  }

  // ---- False calls ----

  startFalseCall(evaluation) {
    this.falseCalls += 1;
    this.sitOut = this.config.falseCall.sitOutCalls;
    const reason = evaluation.result === 'noPattern' ? 'noPattern' : evaluation.reason;
    const number = evaluation.failItem?.number;
    const lines = this.callerLines.game.falseCall[reason];
    const template = pickOne(lines);
    this.falseCall = {
      reason,
      number,
      headline: this.falseCallHeadline(reason, number),
      short: this.falseCallShort(reason, number),
      text: fillLine(template, { number, pattern: this.pattern.spoken }),
      spoken: fillLine(template, { number: number ? numberInWords(number) : number, pattern: this.pattern.spoken }),
      items: evaluation.items,
      order: evaluation.order,
      failItem: evaluation.failItem,
    };
    // The numbers stay paused while the caller explains. The next number starts when he has finished
    // (the voice tells us with lineFinished), or after a short wait if there is no voice.
    this.pendingRestart = { msLeft: this.config.check.failLineMaxMs };
    this.say(this.falseCall.text, 'wince', 'falseCall', this.falseCall.spoken);
    this.emit('falseCall');
  }

  // The caller has finished the false-call line. Start the next number after a short beat.
  lineFinished({ silent = false } = {}) {
    if (this.intro?.stage === 'countdown') this.intro.voiceDone = true; // the caller has finished counting in
    if (!this.pendingRestart) return;
    const beat = silent ? this.config.check.silentFailMs : this.config.check.afterLineMs;
    this.pendingRestart.msLeft = Math.min(this.pendingRestart.msLeft, beat);
  }

  restartAfterFalseCall() {
    this.pendingRestart = null;
    this.nextCall({ announce: true });
  }

  // True once the next number is running behind the failed check.
  get restartedAfterFalseCall() {
    return this.checking?.stage === 'failed' && !this.pendingRestart && this.phase === 'calling';
  }

  falseCallHeadline(reason, number) {
    if (reason === 'notCalled') return `${number} not called`;
    if (reason === 'usedOnOtherCard') return `${number} already used`;
    return 'Not yet!';
  }

  falseCallShort(reason, number) {
    if (reason === 'notCalled') return `${number} was not called`;
    if (reason === 'usedOnOtherCard') return `${number} was already used`;
    return `Nothing to check yet`;
  }

  backToCards() {
    if (this.screen === 'checking' && this.restartedAfterFalseCall) {
      this.screen = 'cards';
      this.checking = null;
      // Show the current number again, but do not say it: it was already called, and a line may still be playing.
      this.bubble = { text: callText(this.currentNumber, this.callerLines, this.speed.useNicknames), mood: 'talking' };
    }
  }

  letterOf(number) {
    return letterFor(number, this.config);
  }
}
