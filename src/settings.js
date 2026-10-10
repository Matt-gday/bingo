// Settings. Device settings (sound, microphone) are kept on this phone for everyone. A few belong to the player
// whose turn it is and are kept in their own save (see profiles.js): their usual speed and night, how their recent
// stages went, and the look of their avatar.
// Only the things the player actually changed are stored, so a new default (for example "music on")
// reaches everyone who has not made their own choice.

const KEY = 'soloBingo.settings';
const VERSION = 2;

// These belong to the active player, not the phone.
const PLAYER_KEYS = new Set(['speedId', 'nightId', 'raceHistory']);

export function createSettings(config, profiles = null) {
  const defaults = {
    speedId: 'steady',
    raceHistory: [], // how the last stages went (1 = the player won), used to keep nights fair
    nightId: 'line', // how long a night: see 'nights' in Data/config.json
    voiceOn: true,
    sfxOn: true, // sound effects
    musicOn: true, // background music: on unless the player turned it off
    hapticsOn: true, // a light buzz on phones that support it
    holdToCallMode: false, // true = always use the hold button and never turn the microphone on
    shoutThreshold: config.shout.defaultLoudnessThreshold,
    shoutTested: false,
  };

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    // Private browsing or blocked storage: carry on with the defaults.
  }
  // Older versions saved every default whenever one setting changed, so a stored "music off" may never have
  // been the player's choice. Clear it once; from now on only real choices are stored.
  if ((saved.version ?? 1) < VERSION) {
    delete saved.musicOn;
    saved.version = VERSION;
  }

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Not saving is fine; the setting still works until the page closes.
    }
  };

  return {
    get(name) {
      const player = profiles?.active();
      if (player) {
        if (name === 'avatarLook') return player.look;
        if (PLAYER_KEYS.has(name)) return name in player.prefs ? player.prefs[name] : defaults[name];
      }
      return name in saved ? saved[name] : defaults[name];
    },
    set(name, value) {
      const player = profiles?.active();
      if (player && name === 'avatarLook') {
        profiles.update(player.id, { look: value });
        return;
      }
      if (player && PLAYER_KEYS.has(name)) {
        profiles.setPref(player.id, name, value);
        return;
      }
      saved[name] = value;
      save();
    },
  };
}
