import prizesJson from '../Data/prizes.json';
import setsJson from '../Data/sets.json';
import regularsData from '../Data/regulars.json';
import config from '../Data/config.json';
import { buildPrizeData, refillTable, regularWallet, closestSet, setStatus, finishedSets, badgeFor, streetCred, ownedIds } from './engine/prizes.js';

// The prize world as the screens see it: the shared prize data, and one player's save made ready to use.

export const data = buildPrizeData(prizesJson, setsJson);
export const regulars = regularsData.regulars;
export const regularById = (id) => regulars.find((r) => r.id === id);

// Makes sure a player's prize world is ready: every regular has a wallet and the table has prizes on it.
export function ensureWorld(profile) {
  for (const r of regulars) regularWallet(profile, r.id, config.prizeTable.regularStartingCredits);
  const state = profile.prizes;
  if (state.table.filter(Boolean).length < config.prizeTable.slots) {
    refillTable(data, state, config.prizeTable.slots);
    state.covered = []; // the very first table is simply there, not a surprise
  }
  return state;
}

// Everyone at tonight's table, in the order they are shown: the player first.
export function owners(profile, tableRegulars) {
  const state = profile.prizes;
  return [
    { id: 'player', name: 'You', look: profile.look, credits: profile.credits, you: true },
    ...tableRegulars.map((r) => ({
      id: r.id, name: r.name, look: r.look, colour: r.colour, regular: r, credits: profile.regulars[r.id]?.credits ?? 0,
    })),
  ].map((o) => ({ ...o, closest: closestSet(data, state, o.id) }));
}

// What an owner has: for the cabinet screens.
export function cabinetOf(profile, owner) {
  const state = profile.prizes;
  const progress = data.sets
    .map((s) => setStatus(data, state, owner, s.id))
    .filter((s) => s.have > 0 && !s.done)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
  const finished = finishedSets(data, state, owner).map((id) => ({ set: data.setById.get(id), badge: badgeFor(state, owner, id) }));
  const prizes = ownedIds(state, owner).map((id) => data.prizes.get(id)).filter(Boolean);
  return { progress, finished, prizes, cred: streetCred(data, state, owner) };
}

// Who is furthest ahead on a set that the player has not yet started (for the Sets screen).
export function whoIsAhead(profile, setId) {
  const state = profile.prizes;
  let best = null;
  for (const r of regulars) {
    const s = setStatus(data, state, r.id, setId);
    if (s.have > 0 && (!best || s.ratio > best.ratio)) best = { name: r.name, ratio: s.ratio };
  }
  return best;
}
