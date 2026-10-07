// A light buzz on phones that can do it. Switched off with the "Buzz" setting.

export class Haptics {
  constructor(settings) {
    this.settings = settings;
  }

  get supported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  buzz(pattern) {
    if (!this.settings.get('hapticsOn') || !this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some phones refuse; nothing to do.
    }
  }
}
