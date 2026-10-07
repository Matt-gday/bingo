// The caller's voice, using the phone's built-in speech. Recorded voice files
// can replace this later without changing anything else.

export class Voice {
  constructor(config, settings) {
    this.settings = settings;
    this.config = config.voice;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.chosen = null;
    this.current = null;
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
    // Leave an idle engine alone. In particular, don't queue and immediately
    // cancel a silent "unlock" utterance before the first real call on iOS.
    if (this.current || this.synth.speaking || this.synth.pending) this.cancel();
    if (this.synth.paused) this.synth.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-AU';
    utterance.volume = 1;
    utterance.rate = this.config.rate;
    utterance.pitch = this.config.pitch;
    // Retain the utterance until completion, including while Safari starts it.
    this.current = utterance;
    const release = () => {
      if (this.current === utterance) this.current = null;
    };
    utterance.onend = release;
    utterance.onerror = release;
    this.synth.speak(utterance);
  }

  cancel() {
    this.current = null;
    this.synth?.cancel();
  }
}
