// Settings kept on this device (until Phase 4 adds a save for each player).

const KEY = 'soloBingo.settings';

export function createSettings(config) {
  const defaults = {
    speedId: 'steady',
    voiceOn: true,
    sfxOn: true, // sound effects
    musicOn: false, // background music, off until the player turns it on
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
  const values = { ...defaults, ...saved };

  return {
    get(name) {
      return values[name];
    },
    set(name, value) {
      values[name] = value;
      try {
        localStorage.setItem(KEY, JSON.stringify(values));
      } catch {
        // Not saving is fine; the setting still works until the page closes.
      }
    },
  };
}
