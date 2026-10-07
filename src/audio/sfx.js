// The game's sound effects (made by tools/make-sounds.mjs). Each sound can have several takes; one is
// picked at random each time, never the same one twice in a row, so busy sounds do not get samey.

export class Sfx {
  constructor(engine, settings) {
    this.engine = engine;
    this.settings = settings;
    this.sounds = {}; // id -> { files, volume }
    this.base = '';
    this.last = new Map(); // id -> the take played last
    this.handles = new Map(); // id -> the handle of the take now playing
    this.cancelled = new Map(); // id -> how many times it has been cut short (a late-loading sound must not start after that)
  }

  get on() {
    return this.settings.get('sfxOn');
  }

  // Find out which sounds exist.
  loadList(baseUrl) {
    return fetch(`${baseUrl}manifest.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (manifest?.sounds) {
          this.sounds = manifest.sounds;
          this.base = baseUrl;
        }
      })
      .catch(() => {});
  }

  // Download and decode every sound ahead of time (they are small), so none is late when it is needed.
  // Call it after the first tap, when the phone allows audio.
  preload() {
    if (!this.engine.ensure()) return Promise.resolve();
    const urls = Object.values(this.sounds).flatMap((s) => s.files.map((f) => `${this.base}${f}`));
    return Promise.all(urls.map((url) => this.engine.load(url).catch(() => {})));
  }

  pick(id) {
    const entry = this.sounds[id];
    if (!entry?.files?.length) return null;
    const choices = entry.files.length > 1 ? entry.files.filter((f) => f !== this.last.get(id)) : entry.files;
    const file = choices[Math.floor(Math.random() * choices.length)];
    this.last.set(id, file);
    return { file, volume: entry.volume ?? 0.8 };
  }

  play(id, { rate = 1, gain = 1 } = {}) {
    if (!this.on || !this.engine.ctx) return; // off, or the phone has not allowed sound yet
    const choice = this.pick(id);
    if (!choice) return;
    const url = `${this.base}${choice.file}`;
    const cutsSoFar = this.cancelled.get(id) ?? 0;
    const start = (buffer) => {
      if ((this.cancelled.get(id) ?? 0) !== cutsSoFar) return; // it was cut short while it was still loading
      const handle = this.engine.play(buffer, {
        gain: choice.volume * gain,
        rate,
        onended: () => {
          if (this.handles.get(id) === handle) this.handles.delete(id);
        },
      });
      this.handles.set(id, handle);
    };
    const ready = this.engine.buffers.get(url);
    if (ready) start(ready);
    else this.engine.load(url).then(start).catch(() => {});
  }

  // Cut a sound short, for example the suspense build-up when the answer arrives.
  stop(id, fadeSeconds = 0.05) {
    this.cancelled.set(id, (this.cancelled.get(id) ?? 0) + 1);
    this.handles.get(id)?.stop(fadeSeconds);
    this.handles.delete(id);
  }
}
