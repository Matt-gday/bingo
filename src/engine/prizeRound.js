import { buyPrize, owns, drawPrizes, refillTable, wouldFinish, setStatus, ownedIds, closestSet } from './prizes.js';

// The timed part of the prize round. The player shops while the regulars shop beside them: when a regular decides
// to buy something, their face appears on that prize inside a ring, and when the ring closes they buy it. The
// player can beat them to it. Nothing here knows about the screen: it reads like the game (advance() many times a
// second, events come out through the listener).
//
// events: 'arrive' {bot}, 'eye' {bot, slot}, 'broken' {bot, slot}, 'sold' {slot, buyer, prize, finished},
//         'drop' {slot, prize}, 'leave' {bot}, 'over'

const pickBetween = ([low, high], rng) => low + rng() * (high - low);

export class PrizeRound {
  constructor({ config, data, state, regulars, wallets, playerCredits, speedId = 'steady', rng = Math.random, onEvent = () => {} }) {
    this.config = config;
    this.rules = config.prizeTable;
    this.data = data;
    this.state = state; // the player's prize world: mutated as things are bought
    this.rng = rng;
    this.onEvent = onEvent;
    this.playerCredits = playerCredits;
    this.speedScale = this.rules.speedScaleBySetting?.[speedId] ?? 1;
    this.slots = Array.from({ length: this.rules.slots }, (_, i) => ({ prize: state.table[i] ?? null, sold: null }));
    this.clock = 0;
    this.playerDone = false;
    this.log = []; // everything that was bought: { owner, prize, price }
    this.bots = regulars.map((regular, i) => ({
      id: regular.id,
      name: regular.name,
      regular,
      wallet: wallets[regular.id], // { credits }
      arrivesAt: this.rules.firstBotDelaySeconds * 1000 + i * this.rules.secondsBetweenBotArrivals * 1000,
      status: 'coming', // coming, thinking, eyeing, left
      thinkUntil: 0,
      target: null, // { slot, prizeId, total, elapsed, finishes }
      bought: [],
    }));
  }

  emit(type, data = {}) {
    this.onEvent(type, data);
  }

  prizeAt(slot) {
    const s = this.slots[slot];
    return s?.prize && !s.sold ? this.data.prizes.get(s.prize) : null;
  }

  get over() {
    return this.bots.every((b) => b.status === 'left');
  }

  // ---- the player ----

  canAfford(slot) {
    const prize = this.prizeAt(slot);
    return !!prize && this.playerCredits >= prize.price;
  }

  // The player buys what is in a slot. Returns { ok, reason, finished }.
  playerBuy(slot) {
    const prize = this.prizeAt(slot);
    if (!prize) return { ok: false, reason: 'gone' };
    if (owns(this.state, 'player', prize.id)) return { ok: false, reason: 'owned' };
    if (this.playerCredits < prize.price) return { ok: false, reason: 'short', short: prize.price - this.playerCredits };
    this.playerCredits -= prize.price;
    const { finished } = buyPrize(this.data, this.state, 'player', prize.id);
    this.sell(slot, 'player', prize, finished);
    return { ok: true, finished, prize };
  }

  // The player is finished: the regulars carry on without them (see fastForward).
  done() {
    this.playerDone = true;
  }

  // ---- the regulars ----

  advance(dtMs) {
    this.clock += dtMs;
    // a sold slot shows "Sold to ..." for a moment, then a new prize drops in
    this.slots.forEach((s, i) => {
      if (s.sold && this.clock >= s.sold.dropAt) this.drop(i);
    });
    for (const bot of this.bots) {
      if (bot.status === 'coming' && this.clock >= bot.arrivesAt) {
        bot.status = 'thinking';
        bot.thinkUntil = this.clock;
        this.emit('arrive', { bot });
      }
      if (bot.status === 'thinking' && this.clock >= bot.thinkUntil) this.choose(bot);
      if (bot.status === 'eyeing') {
        const t = bot.target;
        t.elapsed += dtMs;
        if (t.elapsed >= t.total) this.botBuys(bot);
      }
    }
    if (this.over) this.emit('over');
  }

  // Lets the regulars finish in the background, for a player who has left early. Returns when they have all gone.
  fastForward(stepMs = 250, limitMs = 10 * 60 * 1000) {
    for (let t = 0; t < limitMs && !this.over; t += stepMs) this.advance(stepMs);
  }

  affordableFor(bot) {
    const out = [];
    this.slots.forEach((s, slot) => {
      const prize = this.prizeAt(slot);
      if (!prize || owns(this.state, bot.id, prize.id) || bot.wallet.credits < prize.price) return;
      out.push({ slot, prize });
    });
    return out;
  }

  // A regular picks what they want: anything that finishes a set first, then what belongs to a set they collect,
  // then whatever they fancy. A regular with no set (Rex) buys on a whim.
  choose(bot) {
    const options = this.affordableFor(bot);
    if (!options.length) {
      bot.status = 'left';
      bot.target = null;
      this.emit('leave', { bot });
      return;
    }
    const collects = bot.regular.collects ?? [];
    const scored = options.map(({ slot, prize }) => {
      const finishes = wouldFinish(this.data, this.state, bot.id, prize.id).length > 0;
      const inSet = prize.tags.filter((t) => collects.includes(t)).length;
      const whim = this.rng() * 10;
      const score = collects.length ? (finishes ? 100 : 0) + inSet * 30 + whim : whim * 10;
      return { slot, prize, finishes, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const pick = scored[0];
    let seconds = pickBetween(bot.regular.shopping?.ringSeconds ?? [4, 6], this.rng) * this.speedScale;
    if (pick.finishes) seconds *= this.rules.desperationSpeedUp;
    bot.status = 'eyeing';
    bot.target = { slot: pick.slot, prizeId: pick.prize.id, total: seconds * 1000, elapsed: 0, finishes: pick.finishes };
    this.emit('eye', { bot, slot: pick.slot, finishes: pick.finishes, total: bot.target.total });
  }

  botBuys(bot) {
    const t = bot.target;
    const prize = this.prizeAt(t.slot);
    bot.target = null;
    bot.status = 'thinking';
    if (!prize || prize.id !== t.prizeId || bot.wallet.credits < prize.price || owns(this.state, bot.id, prize.id)) {
      this.think(bot, 800);
      return;
    }
    bot.wallet.credits -= prize.price;
    const { finished } = buyPrize(this.data, this.state, bot.id, prize.id);
    bot.bought.push(prize.id);
    this.sell(t.slot, bot.id, prize, finished);
    this.think(bot, 1800);
  }

  think(bot, ms) {
    bot.status = 'thinking';
    bot.thinkUntil = this.clock + ms;
  }

  // A prize has been sold (to the player or a regular): anyone who was eyeing it is beaten to it.
  sell(slot, buyer, prize, finished) {
    this.slots[slot].sold = { to: buyer, prize: prize.id, dropAt: this.clock + this.rules.soldBeatMs };
    this.state.table[slot] = null; // it has left the table (and returns to the pool)
    this.log.push({ owner: buyer, prize: prize.id, price: prize.price, finished });
    for (const bot of this.bots) {
      if (bot.status === 'eyeing' && bot.target && bot.target.slot === slot && bot.id !== buyer) {
        bot.target = null;
        bot.beatenOn = prize.id;
        this.think(bot, 1400); // a moment to be annoyed, then pick again
        this.emit('broken', { bot, slot, by: buyer });
      }
    }
    this.emit('sold', { slot, buyer, prize, finished });
  }

  // A new prize takes the sold slot's place (if the pool has any left).
  drop(slot) {
    const [id] = drawPrizes(this.data, this.state, 1, { rng: this.rng });
    this.slots[slot] = { prize: id ?? null, sold: null };
    this.state.table[slot] = id ?? null;
    if (id) this.emit('drop', { slot, prize: this.data.prizes.get(id) });
  }

  // Writes the slots back to the save, so what is left stays on the table for next time. A couple of the
  // unsold prizes are swapped for new arrivals, which stay covered until the player next opens the table.
  commit() {
    this.slots.forEach((s, i) => {
      this.state.table[i] = s.sold ? null : s.prize;
    });
    this.state.covered = [];
    const keep = this.state.table.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
    for (let n = 0; n < (this.rules.arrivalsPerNight ?? 0) && keep.length > 0; n++) {
      const slot = keep.splice(Math.floor(this.rng() * keep.length), 1)[0];
      this.state.table[slot] = null;
    }
    refillTable(this.data, this.state, this.slots.length, { rng: this.rng }); // empty slots get new arrivals, covered until looked at
    this.arrivals = this.state.covered.length;
  }

  // What everyone did, for the "Table closed" summary.
  summary() {
    return {
      player: this.log.filter((l) => l.owner === 'player'),
      regulars: this.bots.map((b) => ({ id: b.id, name: b.name, bought: this.log.filter((l) => l.owner === b.id) })),
      left: this.slots.filter((s) => s.prize && !s.sold).length,
      arrivals: this.arrivals ?? 0,
    };
  }
}

export { setStatus, ownedIds, closestSet };
