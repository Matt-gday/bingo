// Quiet background music (made by tools/make-music.mjs). It is off until the player turns it on.
// Switching tracks fades one out as the other fades in.

export class Music {
  constructor(engine, settings) {
    this.engine = engine;
    this.settings = settings;
    this.tracks = {}; // id -> { file, volume }
    this.base = '';
    this.current = null; // { id, handle, volume }
    this.wanted = null; // the track that should be playing, even if the phone is not ready yet
    this.ducked = false;
  }

  get on() {
    return this.settings.get('musicOn');
  }

  loadList(baseUrl) {
    return fetch(`${baseUrl}manifest.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (manifest?.tracks) {
          this.tracks = manifest.tracks;
          this.base = baseUrl;
        }
      })
      .catch(() => {})
      .then(() => this.sync()); // a screen may have asked for its music before this list arrived
  }

  // Say which track belongs here. It starts once music is on and the phone has allowed sound.
  play(id) {
    this.wanted = id;
    this.sync();
  }

  sync() {
    const entry = this.tracks[this.wanted];
    if (!this.on) {
      this.stopCurrent();
      return;
    }
    // Wait until the phone really has the audio running, so the track never starts into a sleeping system.
    if (!this.engine.ctx || this.engine.ctx.state === 'suspended' || this.engine.ctx.state === 'interrupted' || !entry) return;
    if (this.current?.id === this.wanted) return;
    const id = this.wanted;
    this.stopCurrent();
    this.engine
      .load(`${this.base}${entry.file}`)
      .then((buffer) => {
        if (this.wanted !== id || !this.on || this.current) return; // plans changed while it was loading
        const handle = this.engine.playLoop(buffer, { gain: 0 });
        handle.fadeTo(this.levelFor(entry.volume ?? 0.3), 1.5);
        this.current = { id, handle, volume: entry.volume ?? 0.3 };
      })
      .catch(() => {});
  }

  levelFor(volume) {
    return this.ducked ? volume * 0.3 : volume;
  }

  // Turn the music down while the game is paused, and back up afterwards.
  duck(on) {
    this.ducked = on;
    if (this.current) this.current.handle.fadeTo(this.levelFor(this.current.volume), 0.5);
  }

  stopCurrent() {
    this.current?.handle.stop(1);
    this.current = null;
  }
}
