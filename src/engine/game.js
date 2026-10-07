import { dealCards, letterFor } from './cards.js';
import { pickOne, shuffle } from './rng.js';
import { evaluateClaim } from './check.js';
import { callText, capital, fillLine, numberInWords, sayLine } from './caller.js';

// The rules of one game of bingo. This file knows nothing about the screen.
// The screen calls advance() many times a second and reads the state it needs.
//
// phase  = what the game itself is doing:
//   calling  - a number is out and its ring is running
//   locking  - the ring has run out and the marks have just locked
//   checking - the caller is checking a claim (the ring is stopped)
//   won      - the player's claim checked out
//   drawn    - all 75 numbers were called and nobody won
// screen = what the player is looking at:
//   cards, shout, checking, falseCall, result

const MAX_FRAME_MS = 250; // a long gap (the phone slept, the tab was hidden) must not skip calls

export class Game {
  constructor({ config, patterns, callerLines, speedId, stageIds = ['line'] }) {
    this.config = config;
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

  // ---- Starting and calling ----

  start() {
    this.setup();
    this.say(sayLine(this.callerLines, 'start', {}), 'smile');
    this.nextCall();
  }

  nextCall() {
    if (this.called.length >= this.deck.length) {
      this.phase = 'drawn';
      this.screen = 'result';
      this.result = { outcome: 'drawn' };
      this.say('That was the last ball. No winner tonight!', 'smile');
      this.emit('end');
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
    this.say(callText(this.currentNumber, this.callerLines, this.speed.useNicknames), 'talking');
    this.emit('call', { number: this.currentNumber });
  }

  say(text, mood = 'talking') {
    this.bubble = { text, mood };
  }

  advance(dtMs) {
    const dt = Math.min(dtMs, MAX_FRAME_MS);
    if (this.notice) {
      this.notice.msLeft -= dt;
      if (this.notice.msLeft <= 0) this.notice = null;
    }
    if (this.checking) this.advanceChecking(dt);
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
    if (this.phase === 'calling' && this.screen === 'cards') this.endCall();
  }

  endCall() {
    this.lockMarks();
    if (this.sitOut > 0) this.sitOut -= 1;
    this.phase = 'locking';
    this.lockElapsed = 0;
    this.say(sayLine(this.callerLines, 'marksLocked', {}), 'talking');
    this.emit('lock');
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
    const evaluation = evaluateClaim({
      cards: this.cards,
      marks: this.marks,
      called: this.called,
      pattern: this.pattern,
      config: this.config,
    });
    if (evaluation.result === 'noPattern') {
      this.startFalseCall(evaluation);
      this.screen = 'falseCall';
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

  revealDelay(evaluation, index) {
    const { firstDelayMs, delayGrowth, finalDelayMs } = this.config.check;
    const isLastNumber = index > 0 && index === evaluation.items.length - 1;
    return isLastNumber ? finalDelayMs : firstDelayMs * delayGrowth ** index;
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
        c.stage = 'concluded';
        this.startFalseCall(c.evaluation);
        this.emit('reveal', { ok: false });
      } else if (c.index === c.evaluation.order.length - 1) {
        c.stage = 'concluded';
        this.phase = 'won';
        this.say(sayLine(this.callerLines, 'win', { pattern: this.pattern.spoken }), 'cheer');
        this.emit('reveal', { ok: true, last: true });
      } else {
        c.index += 1;
        c.waitMs = this.revealDelay(c.evaluation, c.index);
        this.sayChecking();
        this.emit('reveal', { ok: true });
      }
    } else if (c.stage === 'concluded' && c.elapsed >= this.config.check.resultBeatMs) {
      if (this.phase === 'won') {
        this.screen = 'result';
        this.result = { outcome: 'win', falseCalls: this.falseCalls, calls: this.called.length };
        this.emit('end');
      } else if (this.screen === 'checking') {
        this.screen = 'falseCall';
      }
      this.checking = null;
    }
  }

  // ---- False calls ----

  startFalseCall(evaluation) {
    this.falseCalls += 1;
    this.sitOut = this.config.falseCall.sitOutCalls;
    const reason = evaluation.result === 'noPattern' ? 'noPattern' : evaluation.reason;
    const number = evaluation.failItem?.number;
    const lines = this.callerLines.game.falseCall[reason];
    this.falseCall = {
      reason,
      number,
      headline: this.falseCallHeadline(reason, number),
      short: this.falseCallShort(reason, number),
      text: fillLine(pickOne(lines), { number, pattern: this.pattern.spoken }),
      items: evaluation.items,
      order: evaluation.order,
      failItem: evaluation.failItem,
    };
    // The game restarts at once: the next number is already running.
    this.nextCall();
    if (this.phase !== 'drawn') this.say(this.falseCall.text, 'wince');
    this.emit('falseCall');
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
    if (this.screen === 'falseCall') {
      this.screen = 'cards';
      if (this.phase === 'calling') {
        this.say(callText(this.currentNumber, this.callerLines, this.speed.useNicknames), 'talking');
      }
    }
  }

  letterOf(number) {
    return letterFor(number, this.config);
  }
}
