// The microphone. It is only ever turned on from the shout screen and the
// "Test your shout" screen, and it is switched off again the moment either closes.
// It measures loudness only. It never records or recognises words.

// On newer iPhones the page chooses how it uses audio. The game plays sound in 'playback' mode, but listening
// to the microphone needs 'play-and-record'.
function setSessionType(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {
    // Not supported on this phone, which is fine.
  }
}

export class Mic {
  constructor(config) {
    this.settings = config.shout;
    this.state = 'idle'; // idle, starting, live, denied, unavailable
    this.level = 0; // 0 (quiet) to 1 (very loud)
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buffer = null;
    this.session = 0;
    this.blocked = false; // the phone refused the microphone this session, so the game uses press-to-call
    this.granted = false; // the phone has allowed it in this session (so it need not be asked again)
    this.hiddenAt = 0;
    if (typeof document !== 'undefined') {
      // After a long time away the phone may have forgotten its permission, so ask again at the next Play.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.hiddenAt = Date.now();
        else if (this.hiddenAt && Date.now() - this.hiddenAt > 60000) this.granted = false;
      });
    }
    this.errorName = ''; // what the phone said when it refused, shown on screen to help find the cause
  }

  // Call this straight from a tap, because phones only allow the microphone
  // (and sound) to start from something the player did.
  start() {
    if (this.state === 'live' || this.state === 'starting') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      this.state = 'unavailable';
      return;
    }
    const session = ++this.session;
    this.state = 'starting';
    this.errorName = '';
    setSessionType('play-and-record'); // the sound-only mode used for the game's sounds does not allow a microphone
    this.level = 0;
    this.ctx = new AudioContextClass();
    this.ctx.resume?.();
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((stream) => {
        if (session !== this.session) {
          stream.getTracks().forEach((track) => track.stop()); // closed while the permission box was open
          return;
        }
        this.stream = stream;
        const source = this.ctx.createMediaStreamSource(stream);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.buffer = new Float32Array(this.analyser.fftSize);
        source.connect(this.analyser);
        this.state = 'live';
        this.granted = true;
        this.blocked = false;
      })
      .catch((error) => {
        if (session !== this.session) return;
        this.errorName = error?.name || 'Error';
        this.blocked = true;
        this.granted = false;
        this.state = error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'denied' : 'unavailable';
        this.release();
      });
  }

  // Asks the phone for the microphone and gives it straight back. Called when the player taps Play, so the
  // phone's question comes at a calm moment and never in the middle of a game. Resolves to 'ok', 'denied'
  // or 'unavailable'. If it is not 'ok', the game plays with the press-to-call button instead.
  async warmUp() {
    if (this.granted) return 'ok';
    if (!navigator.mediaDevices?.getUserMedia) {
      this.blocked = true;
      return 'unavailable';
    }
    setSessionType('play-and-record');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.granted = true;
      this.blocked = false;
      this.errorName = '';
      return 'ok';
    } catch (error) {
      this.blocked = true;
      this.errorName = error?.name || 'Error';
      return error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'denied' : 'unavailable';
    } finally {
      setSessionType('playback');
    }
  }

  stop() {
    this.session += 1;
    this.release();
    if (this.state !== 'denied' && this.state !== 'unavailable') this.state = 'idle';
    this.level = 0;
  }

  release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    this.ctx?.close?.().catch(() => {});
    this.ctx = null;
    setSessionType('playback'); // back to the mode that ignores the phone's silent switch
  }

  // Read the loudness right now. Call it once a frame while the mic is on.
  sample() {
    if (this.state !== 'live' || !this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (const value of this.buffer) sum += value * value;
    const rms = Math.sqrt(sum / this.buffer.length);
    const db = 20 * Math.log10(rms || 1e-8);
    const { dbFloor, dbCeiling } = this.settings;
    const now = Math.min(1, Math.max(0, (db - dbFloor) / (dbCeiling - dbFloor)));
    // The meter jumps up at once but falls back gently, so it is easy to read.
    this.level = Math.max(now, this.level * 0.88);
    return this.level;
  }
}
