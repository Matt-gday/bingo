import { dealCards, isFreeSquare } from './cards.js';
import { setsFor } from './table.js';

// The race director. Once the number order and the player's cards are known, it shapes the regulars' cards
// so every stage is a real race: sometimes the player has time to spare, sometimes it is neck and neck, and now
// and then a regular simply gets there first. Each regular's card is picked from many random ones, so it is
// still an ordinary card, only chosen to finish at the right call.

// The call (1 to 75) at which a set of cards first completes a pattern, given the order the numbers come out in.
export function completionCall(cards, positions, pattern, config) {
  let best = Infinity;
  for (const card of cards) {
    for (const squares of setsFor(pattern)) {
      let latest = 0;
      for (const [r, c] of squares) {
        if (isFreeSquare(r, c, config)) continue;
        latest = Math.max(latest, positions[card.grid[r][c]]);
        if (latest >= best) break;
      }
      if (latest < best) best = latest;
    }
  }
  return best;
}

// How fast a sensible player really gets there. They can mark only one number per call, so a number on both
// cards (or one they were too busy to mark) is marked a call or two later. This plays the game for them with a
// sensible rule (each call, mark the called square that helps most) and notes the call at which each stage is
// first complete.
export function playerPace(playerCards, deck, stages, config) {
  const marked = new Set();
  const done = stages.map(() => Infinity);
  const called = new Set();
  const progress = (c, pattern, extra) => {
    let best = 0;
    for (const squares of setsFor(pattern)) {
      let have = 0;
      for (const [r, col] of squares) {
        if (isFreeSquare(r, col, config) || marked.has(`${c}:${r},${col}`) || extra === `${c}:${r},${col}`) have += 1;
      }
      best = Math.max(best, have);
    }
    return best;
  };
  const complete = (pattern) => playerCards.some((card, c) => setsFor(pattern).some((squares) => squares.every(
    ([r, col]) => isFreeSquare(r, col, config) || marked.has(`${c}:${r},${col}`),
  )));
  deck.forEach((number, i) => {
    called.add(number);
    const target = Math.max(0, done.findIndex((d) => d === Infinity));
    let choice = null;
    playerCards.forEach((card, c) => card.grid.forEach((row, r) => row.forEach((n, col) => {
      if (n === 0 || !called.has(n)) return;
      const key = `${c}:${r},${col}`;
      if (marked.has(key)) return;
      const score = progress(c, stages[target], key);
      if (!choice || score > choice.score) choice = { key, score };
    })));
    if (choice) marked.add(choice.key);
    stages.forEach((pattern, s2) => {
      if (done[s2] === Infinity && complete(pattern)) done[s2] = i + 1;
    });
  });
  return done;
}

function weightedPick(weights, rng) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [name, w] of entries) {
    roll -= w;
    if (roll <= 0) return name;
  }
  return entries[0][0];
}

const between = ([low, high], rng) => low + Math.floor(rng() * (high - low + 1));

// The shapes a night can take, for example "WWL" = win the line, win two lines, narrowly lose the full house.
// With a record of how the last stages went (1 = the player won, 0 = a regular did), the shapes are tilted:
// after a run of losses the shapes with more wins become likelier, and after a run of wins the other way.
export function arcWeights(race, stageCount, history = []) {
  const base = race.arcs?.[String(stageCount)];
  if (!base) return null;
  const adjust = race.selfAdjust ?? {};
  const recent = history.slice(-(adjust.historyLength ?? 12));
  let bias = 0;
  if (recent.length >= (adjust.minSamples ?? 4)) {
    const rate = recent.reduce((a, b) => a + b, 0) / recent.length;
    bias = Math.max(-0.7, Math.min(0.9, ((adjust.targetWinRate ?? 0.62) - rate) * (adjust.strength ?? 3)));
    const lastThree = recent.slice(-3);
    if (lastThree.length === 3 && lastThree.every((r) => r === 0)) bias = Math.min(0.9, bias + 0.4); // a losing streak
  }
  const weights = {};
  for (const [arc, weight] of Object.entries(base)) {
    const wins = [...arc].filter((ch) => ch === 'W').length;
    weights[arc] = Math.max(0.02, weight * (1 + bias * (wins - stageCount / 2)));
  }
  return weights;
}

// Works out the shape of the night (which stages the player can win and which are near misses) and, for every
// stage, which regular is the rival and at which call they finish. Then it deals each regular the cards that
// best fit. The regulars who are not the rival are made to look close too: they often finish on the very same
// call as the rival, so they are waiting for the same number. Returns { plan, cards }.
export function planRace({ playerCards, deck, stages, botCount, config, history = [], rng = Math.random }) {
  const race = config.table.race;
  const positions = [];
  deck.forEach((n, i) => { positions[n] = i + 1; });

  const pace = playerPace(playerCards, deck, stages, config);
  const weights = arcWeights(race, stages.length, history);
  const arc = weights ? weightedPick(weights, rng) : [...stages].map(() => (rng() < 0.65 ? 'W' : 'L')).join('');

  const plan = [];
  let previous = 0;
  stages.forEach((pattern, s) => {
    const best = Math.min(74, pace[s]); // when a sensible player would finish this stage
    const base = Math.max(best, previous + 1);
    let kind = arc[s] === 'W' ? 'win' : 'miss';
    let scenario;
    let finish;
    if (kind === 'win') {
      scenario = rng() < race.comfortableShare ? 'comfortable' : 'close';
      finish = base + between(scenario === 'comfortable' ? race.comfortableCalls : race.closeCalls, rng);
    } else {
      scenario = 'nearMiss'; // a regular gets there just ahead of the player
      finish = base - between(race.nearMissCalls, rng);
      if (finish < Math.max(race.earliestCall, previous + 1)) {
        // too early in the game for that: make it a race instead
        kind = 'win';
        scenario = 'close';
        finish = base + between(race.closeCalls, rng);
      }
    }
    finish = Math.min(finish, 74);
    const rival = Math.floor(rng() * botCount);
    // The others: some finish on the same call as the rival (so they wait for the same number), some a little
    // later. In a close race one of them may finish on the player's own call, so the two wait for the same number.
    const others = [];
    let tieUsed = false;
    for (let b = 0; b < botCount; b++) {
      if (b === rival) continue;
      let target;
      if (kind === 'win' && scenario === 'close' && !tieUsed && rng() < race.decoyTieChance) {
        target = { exact: best, atLeast: best };
        tieUsed = true;
      } else {
        const spread = between(race.decoySpread, rng);
        const call = Math.min(74, finish + spread);
        target = { exact: call, atLeast: kind === 'win' ? best + 1 : finish };
      }
      others[b] = target;
    }
    plan.push({ stage: pattern.id, kind, scenario, rival, finish, best, others });
    previous = finish;
  });

  const targets = Array.from({ length: botCount }, (_, b) => plan.map((p) => (p.rival === b ? { exact: p.finish, atLeast: 0 } : p.others[b])));

  const dealConfig = { ...config, cards: { ...config.cards, playerCards: config.table.cardsPerRegular ?? 2 } };
  const cards = targets.map((target) => {
    let bestCards = null;
    let bestScore = Infinity;
    for (let i = 0; i < race.samples && bestScore > 1; i++) {
      const candidate = dealCards(dealConfig);
      let score = 0;
      stages.forEach((pattern, s) => {
        const call = completionCall(candidate, positions, pattern, config);
        const t = target[s];
        score += Math.abs(call - t.exact);
        if (call < t.atLeast) score += (t.atLeast - call) * 4; // never beat the player to a stage that is theirs to win
      });
      if (score < bestScore) {
        bestScore = score;
        bestCards = candidate;
      }
    }
    return bestCards;
  });
  return { plan, cards, arc };
}
