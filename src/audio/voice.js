// The caller's voice, using the phone's built-in speech. Recorded voice files
// can replace this later without changing anything else.

export class Voice {
  constructor(config, settings) {
    this.settings = settings;
    this.config = config.voice;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.chosen = null;
    this.synth?.addEventListener?.('voiceschanged', () => {
      this.chosen = null;
    });
  }

  get supported() {
    return !!this.synth && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  get on() {
    return this.supported && this.settings.get('voiceOn');
  }

  setOn(value) {
    this.settings.set('voiceOn', value);
    if (!value) this.cancel();
  }

  toggle() {
    this.setOn(!this.settings.get('voiceOn'));
    return this.settings.get('voiceOn');
  }

  // Phones only start speaking after a tap, so call this from the Play button.
  unlock() {
    if (!this.supported) return;
    const quiet = new SpeechSynthesisUtterance(' ');
    quiet.volume = 0;
    this.synth.speak(quiet);
  }

  pickVoice() {
    if (this.chosen) return this.chosen;
    const voices = this.synth.getVoices();
    const mine = (navigator.language || 'en').toLowerCase();
    this.chosen = voices.find((v) => v.lang.toLowerCase() === mine)
      ?? voices.find((v) => v.lang.toLowerCase().startsWith(mine.slice(0, 2)))
      ?? voices.find((v) => v.lang.toLowerCase().startsWith('en'))
      ?? null;
    return this.chosen;
  }

  speak(text) {
    if (!this.on || !text) return;
    this.synth.cancel(); // a new line always cuts off the last one, so he never falls behind
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = this.config.rate;
    utterance.pitch = this.config.pitch;
    this.synth.speak(utterance);
  }

  cancel() {
    this.synth?.cancel();
  }
}
