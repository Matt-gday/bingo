// The players on this phone. Each has a name, an avatar look, and a completely separate save: credits, how the
// nights have gone, and what the regulars have earned against them. Everything is kept on the device. Saved after
// every change, so nothing is lost if the app is closed.

const KEY = 'soloBingo.profiles';
const VERSION = 1;

const blankPlayer = (id, name, look) => ({
  id,
  name,
  look,
  credits: 0,
  prefs: {}, // this player's own choices: speedId, nightId, raceHistory
  stats: { nights: 0, nightsWon: 0, stagesWon: 0, creditsEarned: 0 },
  regulars: {}, // what each regular has earned against this player: { dot: { credits: 0 } }
  createdAt: Date.now(),
});

export function createProfiles(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  let data = { version: VERSION, activeId: null, players: [] };
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.players)) data = { ...data, ...saved };
  } catch {
    // Private browsing or damaged data: start with nobody, rather than breaking.
  }

  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(data));
    } catch {
      // Not saving is fine; everything still works until the page closes.
    }
  };
  const find = (id) => data.players.find((p) => p.id === id) ?? null;

  return {
    list: () => data.players,
    get: find,
    active: () => find(data.activeId),

    setActive(id) {
      if (!find(id)) return;
      data.activeId = id;
      save();
    },

    // Adds a player and makes them the active one. The name is tidied and never left empty.
    add({ name, look }) {
      const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 14) || 'Player';
      const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
      const player = blankPlayer(id, cleanName, look);
      data.players.push(player);
      data.activeId = id;
      save();
      return player;
    },

    update(id, patch) {
      const player = find(id);
      if (!player) return;
      if (patch.name !== undefined) player.name = String(patch.name).trim().replace(/\s+/g, ' ').slice(0, 14) || player.name;
      if (patch.look !== undefined) player.look = patch.look;
      save();
    },

    setPref(id, key, value) {
      const player = find(id);
      if (!player) return;
      player.prefs[key] = value;
      save();
    },

    // "Start my progress again": credits, results and the regulars' records go back to the start. Name and
    // avatar stay.
    reset(id) {
      const player = find(id);
      if (!player) return;
      player.credits = 0;
      player.stats = blankPlayer('', '', null).stats;
      player.regulars = {};
      player.prefs.raceHistory = [];
      save();
    },

    remove(id) {
      data.players = data.players.filter((p) => p.id !== id);
      if (data.activeId === id) data.activeId = data.players[0]?.id ?? null;
      save();
    },

    // Records a finished night for a player: the credits they won, how it went, and what each regular earned.
    recordNight(id, { credits, stagesWon, won, regularEarnings = {} }) {
      const player = find(id);
      if (!player) return;
      player.credits += credits;
      player.stats.nights += 1;
      player.stats.nightsWon += won ? 1 : 0;
      player.stats.stagesWon += stagesWon;
      player.stats.creditsEarned += credits;
      for (const [regularId, earned] of Object.entries(regularEarnings)) {
        player.regulars[regularId] = { credits: (player.regulars[regularId]?.credits ?? 0) + earned };
      }
      save();
    },
  };
}
