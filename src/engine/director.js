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

// Works out, for every stage, which regular is the rival and at which call they should finish, then deals each
// regular the cards that best fit. Returns { plan, cards } where cards[i] belongs to regular i.
export function planRace({ playerCards, deck, stages, botCount, config, rng = Math.random }) {
  const race = config.table.race;
  const positions = [];
  deck.forEach((n, i) => { positions[n] = i + 1; });

  const plan = [];
  let previous = 0;
  stages.forEach((pattern, s) => {
    const best = completionCall(playerCards, positions, pattern, config); // the earliest a perfect player could finish
    const base = Math.max(best, previous + 1);
    const scenario = weightedPick(race.odds, rng);
    let finish;
    if (scenario === 'comfortable') finish = base + between(race.comfortableCalls, rng);
    else if (scenario === 'close') finish = base + between(race.closeCalls, rng);
    else finish = base - between(race.rivalWinsCalls, rng);
    // never before the stage can sensibly end, and never past the last number
    let usedScenario = scenario;
    if (finish < Math.max(race.earliestCall, previous + 1)) {
      finish = base + between(race.closeCalls, rng);
      usedScenario = 'close';
    }
    finish = Math.min(finish, 74);
    plan.push({ stage: pattern.id, scenario: usedScenario, rival: Math.floor(rng() * botCount), finish, best });
    previous = finish;
  });

  // Each regular needs cards that finish the rival's stages on the dot, and stay well behind in the others.
  const targets = Array.from({ length: botCount }, (_, b) => plan.map((p, s) => {
    if (p.rival === b) return { exact: p.finish };
    return { atLeast: Math.max(p.finish, p.best) + race.othersBehindCalls };
  }));

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
        score += t.exact !== undefined ? Math.abs(call - t.exact) : Math.max(0, t.atLeast - call) * 3;
      });
      if (score < bestScore) {
        bestScore = score;
        bestCards = candidate;
      }
    }
    return bestCards;
  });
  return { plan, cards };
}
