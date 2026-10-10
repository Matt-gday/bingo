// Prizes, sets and badges. Nothing here knows about the screen.
//
// A "state" is one player's whole prize world, kept in their save:
//   table:     the prize ids on the six-slot table (null = an empty slot)
//   covered:   prizes that arrived since the player last looked (they stay covered until the table opens)
//   owned:     { player: [ids], dot: [ids], ... } who owns what (one of each prize each)
//   finishers: { setId: [owner, owner, ...] } who finished each set, in order (the first gets gold)
// An owner is the string 'player' or a regular's id.

export function buildPrizeData(prizesJson, setsJson) {
  const prizes = new Map(prizesJson.prizes.map((p) => [p.id, p]));
  const sets = setsJson.sets;
  const setById = new Map(sets.map((s) => [s.id, s]));
  return { prizes, sets, setById, list: prizesJson.prizes };
}

export function emptyPrizeState() {
  return { table: [], covered: [], owned: {}, finishers: {} };
}

export const ownedIds = (state, owner) => state.owned[owner] ?? [];
export const owns = (state, owner, prizeId) => ownedIds(state, owner).includes(prizeId);

// How far an owner is towards a set: the full price of every prize they own with that tag, against the target.
export function setStatus(data, state, owner, setId) {
  const set = data.setById.get(setId);
  let have = 0;
  for (const id of ownedIds(state, owner)) {
    const prize = data.prizes.get(id);
    if (prize?.tags.includes(setId)) have += prize.price;
  }
  return { setId, have, target: set.target, done: have >= set.target, ratio: Math.min(1, have / set.target) };
}

export const finishedSets = (data, state, owner) => data.sets.filter((s) => setStatus(data, state, owner, s.id).done).map((s) => s.id);

// The sets that buying this prize would finish for this owner.
export function wouldFinish(data, state, owner, prizeId) {
  const prize = data.prizes.get(prizeId);
  if (!prize || owns(state, owner, prizeId)) return [];
  return prize.tags.filter((tag) => {
    const s = setStatus(data, state, owner, tag);
    return !s.done && s.have + prize.price >= s.target;
  });
}

// The unfinished set an owner is nearest to finishing (the biggest share done), or null if they have not started any.
export function closestSet(data, state, owner) {
  let best = null;
  for (const set of data.sets) {
    const s = setStatus(data, state, owner, set.id);
    if (s.done || s.have === 0) continue;
    if (!best || s.ratio > best.ratio) best = s;
  }
  return best;
}

export const streetCred = (data, state, owner) => finishedSets(data, state, owner).length;

// The badge an owner holds for a set: 'gold' for the first to finish it, 'silver' for anyone later, or null.
export function badgeFor(state, owner, setId) {
  const order = state.finishers[setId] ?? [];
  const index = order.indexOf(owner);
  if (index < 0) return null;
  return index === 0 ? 'gold' : 'silver';
}

// An owner buys a prize: it joins their collection, and any set it finishes is recorded, in order.
// Returns { finished: [{ setId, badge }] }.
export function buyPrize(data, state, owner, prizeId) {
  const finished = [];
  for (const setId of wouldFinish(data, state, owner, prizeId)) {
    const order = (state.finishers[setId] ??= []);
    if (!order.includes(owner)) order.push(owner);
    finished.push({ setId, badge: order.indexOf(owner) === 0 ? 'gold' : 'silver' });
  }
  (state.owned[owner] ??= []).push(prizeId);
  return { finished };
}

// Draws new prizes for the table: any prize not already on it. Prizes the player does not yet own are favoured,
// so the table stays interesting, but ones they own can still turn up (the regulars may want them).
export function drawPrizes(data, state, count, { unownedWeight = 3, rng = Math.random } = {}) {
  const onTable = new Set(state.table.filter(Boolean));
  const pool = data.list.filter((p) => !onTable.has(p.id));
  const picked = [];
  for (let i = 0; i < count && pool.length; i++) {
    const weights = pool.map((p) => (owns(state, 'player', p.id) ? 1 : unownedWeight));
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    for (; index < pool.length - 1; index++) {
      roll -= weights[index];
      if (roll <= 0) break;
    }
    picked.push(pool.splice(index, 1)[0].id);
  }
  return picked;
}

// Fills the empty slots of the table. New arrivals are remembered as "covered" until the player has looked.
export function refillTable(data, state, slots, options = {}) {
  while (state.table.length < slots) state.table.push(null);
  const empty = state.table.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
  const fresh = drawPrizes(data, state, empty.length, options);
  empty.forEach((slot, i) => {
    state.table[slot] = fresh[i] ?? null;
    if (fresh[i]) state.covered.push(fresh[i]);
  });
  return fresh;
}

// What the player may wear: the free starter items plus every wearable prize they own.
export function wardrobeOf(data, state, starterItems) {
  const worn = starterItems.map((s) => ({ item: s.item, colour: s.colour.toUpperCase() }));
  for (const id of ownedIds(state, 'player')) {
    const w = data.prizes.get(id)?.wearable;
    if (w) worn.push({ item: w.item, colour: w.colour.toUpperCase() });
  }
  return worn;
}

// A regular's wallet lives with the player's save: what they have earned and not yet spent.
export function regularWallet(profile, regularId, startingCredits) {
  profile.regulars[regularId] ??= { credits: startingCredits };
  return profile.regulars[regularId];
}
