// Settings kept on this device (until Phase 4 adds a save for each player).
// Only the things the player actually changed are stored, so a new default (for example "music on")
// reaches everyone who has not made their own choice.

const KEY = 'soloBingo.settings';
const VERSION = 2;

export function createSettings(config) {
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
      return name in saved ? saved[name] : defaults[name];
    },
    set(name, value) {
      saved[name] = value;
      save();
    },
  };
}
