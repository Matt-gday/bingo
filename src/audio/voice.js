// The caller's voice. If a recording of a line exists (see tools/make-voice.mjs) it is played;
// anything without a recording is spoken with the phone's built-in speech.

import { AudioEngine } from './engine.js';

export class Voice {
  constructor(config, settings, engine = new AudioEngine()) {
    this.settings = settings;
    this.engine = engine;
    this.handle = null; // the recording that is playing now, so it can be faded out
    this.config = config.voice;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.chosen = null;
    this.current = null;
    this.clips = {}; // line of text -> recording file name
    this.clipBase = '';
    this.protecting = false; // a line that must be heard in full (the false call) is playing
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

  // Find out which recordings exist. Without a manifest everything is spoken by the phone.
  loadClips(baseUrl) {
    return fetch(`${baseUrl}manifest.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (manifest?.clips) {
          this.clips = manifest.clips;
          this.clipBase = baseUrl;
        }
      })
      .catch(() => {});
  }

  // Fade out whatever recording is playing, so a new line never chops it off abruptly.
  fadeOut(seconds = (this.config.fadeMs ?? 250) / 1000) {
    this.handle?.stop(seconds);
    this.handle = null;
  }

  playClip(file, text) {
    if (!this.engine.ensure()) return false; // called from a tap, which is what lets the phone play sound
    const turn = (this.turn = (this.turn ?? 0) + 1);
    this.fadeOut();
    this.current = null;
    this.synth?.cancel();
    this.engine
      .load(`${this.clipBase}${file}`)
      .then((buffer) => {
        if (turn !== this.turn) return; // a newer line has already taken over
        this.handle = this.engine.play(buffer, {
          onended: () => {
            if (turn !== this.turn) return;
            this.handle = null;
            this.finished();
          },
        });
      })
      .catch(() => {
        if (turn === this.turn) this.speakWithPhone(text); // could not load the recording: use the phone's voice
      });
    return true;
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

  // `protect` marks a line that must be heard in full (the false call). Anything else that arrives while
  // it is playing is skipped, not delayed: a number is only called if it can start the moment it appears.
  speak(text, { protect = false } = {}) {
    if (!this.on || !text) return;
    if (this.protecting && !protect) return;
    this.protecting = protect;
    clearTimeout(this.protectTimer);
    // Safety net: if a line never reports that it finished, do not hold everything up for ever.
    if (protect) this.protectTimer = setTimeout(() => this.finished(), 8000);
    const file = this.clips[text];
    if (file && this.playClip(file, text)) return;
    this.speakWithPhone(text);
  }

  speakWithPhone(text) {
    if (!this.supported) return;
    this.fadeOut();
    this.turn = (this.turn ?? 0) + 1;
    // Leave an idle engine alone. In particular, don't queue and immediately
    // cancel a silent "unlock" utterance before the first real call on iOS.
    if (this.current || this.synth.speaking || this.synth.pending) {
      this.current = null;
      this.synth.cancel();
    }
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
      if (this.current === utterance) {
        this.current = null;
        this.finished();
      }
    };
    utterance.onend = release;
    utterance.onerror = release;
    this.synth.speak(utterance);
  }

  // A protected line has finished playing, so the voice is free again.
  finished() {
    clearTimeout(this.protectTimer);
    this.protecting = false;
  }

  cancel() {
    clearTimeout(this.protectTimer);
    this.protecting = false;
    this.current = null;
    this.turn = (this.turn ?? 0) + 1; // a clip that fails to load after this must not start speaking
    this.fadeOut(0.1);
    this.synth?.cancel();
  }
}
