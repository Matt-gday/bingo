// Plays recorded sounds through the browser's Web Audio system. Compared with a plain audio player it can
// start instantly and fade a sound out smoothly, and the same engine will play the sound effects later.

// A tiny silent sound. Playing it in a loop tells iPhones this page is "playing audio", so the phone's
// silent switch does not mute the game (the same way it does not mute a video).
function silentWavUrl() {
  const samples = 800; // 0.1 seconds of silence at 8000 Hz
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map(); // url -> decoded sound
    this.loading = new Map(); // url -> promise
  }

  // Call this from a tap the first time: phones only allow sound to start from something the player did.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.();
      return this.ctx;
    }
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return null;
    this.ctx = new AudioContextClass();
    this.ctx.resume?.();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // newer iPhones: ignore the silent switch
    } catch {
      // Not supported on this phone, so the silent loop below does the job.
    }
    try {
      if (typeof Audio !== 'undefined' && typeof Blob !== 'undefined') {
        this.keepAlive = new Audio(silentWavUrl());
        this.keepAlive.loop = true;
        this.keepAlive.volume = 0.01;
        this.keepAlive.play?.().catch(() => {});
      }
    } catch {
      // Fine: it only matters on phones that mute Web Audio with the silent switch.
    }
    return this.ctx;
  }

  // Stop all sound at once (the phone has locked or the game was switched away), and start it again later.
  // The quiet looping sound is stopped too, otherwise the phone keeps showing play controls on its lock screen.
  suspend() {
    this.keepAlive?.pause?.();
    this.ctx?.suspend?.();
  }

  resume() {
    this.ctx?.resume?.();
    this.keepAlive?.play?.()?.catch?.(() => {});
  }

  load(url) {
    if (this.buffers.has(url)) return Promise.resolve(this.buffers.get(url));
    if (!this.loading.has(url)) {
      const promise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load ${url}`);
          return response.arrayBuffer();
        })
        .then((data) => new Promise((resolve, reject) => this.ctx.decodeAudioData(data, resolve, reject)))
        .then((decoded) => {
          this.buffers.set(url, decoded);
          this.loading.delete(url);
          return decoded;
        })
        .catch((error) => {
          this.loading.delete(url);
          throw error;
        });
      this.loading.set(url, promise);
    }
    return this.loading.get(url);
  }

  // Plays a loaded sound. Returns a handle: stop(fadeSeconds) fades it out and stops it.
  // `rate` plays it faster (higher) or slower (lower); 1 is normal.
  play(buffer, { gain = 1, rate = 1, onended } = {}) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const volume = ctx.createGain();
    volume.gain.value = gain;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(volume).connect(ctx.destination);
    let finished = false;
    source.onended = () => {
      if (finished) return;
      finished = true;
      onended?.();
    };
    source.start();
    return {
      stop(fadeSeconds = 0.25) {
        if (finished) return;
        finished = true; // a faded-out sound is not "finished naturally"
        const now = ctx.currentTime;
        volume.gain.cancelScheduledValues(now);
        volume.gain.setValueAtTime(volume.gain.value, now);
        volume.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        try {
          source.stop(now + fadeSeconds + 0.02);
        } catch {
          // Already stopped.
        }
      },
    };
  }

  // Plays a loaded sound over and over (for music). The handle can change its volume smoothly and fade out.
  playLoop(buffer, { gain = 0 } = {}) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const volume = ctx.createGain();
    volume.gain.value = gain;
    source.buffer = buffer;
    source.loop = true;
    source.connect(volume).connect(ctx.destination);
    source.start();
    return {
      fadeTo(level, seconds = 1) {
        const now = ctx.currentTime;
        volume.gain.cancelScheduledValues(now);
        volume.gain.setValueAtTime(volume.gain.value, now);
        volume.gain.linearRampToValueAtTime(level, now + seconds);
      },
      stop(seconds = 1) {
        this.fadeTo(0, seconds);
        try {
          source.stop(ctx.currentTime + seconds + 0.05);
        } catch {
          // Already stopped.
        }
      },
    };
  }
}
