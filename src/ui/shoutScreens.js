import { html, setText, setClass, setRing, icons, callerImages } from './helpers.js';
import { pickOne } from '../engine/rng.js';

// The shout screen and the "Test your shout" screen.

function percent(value) {
  return `${(Math.min(1, Math.max(0, value)) * 100).toFixed(1)}%`;
}

// ---------- Shout ----------

export function shoutScreen(game, { mic, settings }) {
  const R = 108;
  const length = 2 * Math.PI * R;
  const holdMs = game.config.shout.holdToCallSeconds * 1000;
  const holdMode = settings.get('holdToCallMode');
  const threshold = settings.get('shoutThreshold');

  const el = html(`<main class="screen tense">
    <div class="shout">
      <div class="top">
        <div class="badge" data-badge></div>
        <p class="hint" data-hint></p>
      </div>
      <div class="middle">
        <div class="mic-rings">
          <svg viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <circle cx="110" cy="110" r="${R}" stroke="#fff" stroke-opacity="0.18" stroke-width="3"></circle>
            <circle class="shout-ring" cx="110" cy="110" r="${R}" stroke="#fff" stroke-width="5" stroke-linecap="round" transform="rotate(-90 110 110)"></circle>
          </svg>
          <div class="mic-mid"><div class="mic-core" data-core>${icons.mic(52, 2)}</div></div>
        </div>
        <h1><span class="small" data-small></span><span class="big">BINGO!</span></h1>
      </div>
      <div class="meter-block" data-meter>
        <div class="meter">
          <div class="meter-fill" data-fill></div>
          <div class="meter-mark" style="left:${percent(threshold)}"></div>
        </div>
        <div class="meter-labels"><span>Quiet</span><span>Loud enough</span></div>
        <p class="meter-status" data-status></p>
      </div>
      <div class="bottom">
        <button class="btn btn-white hold-btn" data-hold><div class="fill"></div><span data-hold-label></span></button>
        <button class="btn btn-ghost" data-back>${icons.back()}Back to my cards</button>
      </div>
    </div>
  </main>`);

  const ring = el.querySelector('.shout-ring');
  const holdFill = el.querySelector('.hold-btn .fill');
  const holdLabel = el.querySelector('[data-hold-label]');
  const holdButton = el.querySelector('[data-hold]');
  const core = el.querySelector('[data-core]');
  const meter = el.querySelector('[data-meter]');
  const meterFill = el.querySelector('[data-fill]');
  const status = el.querySelector('[data-status]');
  const badge = el.querySelector('[data-badge]');
  const hint = el.querySelector('[data-hint]');
  const small = el.querySelector('[data-small]');

  const openedAt = performance.now();
  let heldSince = null;
  let aboveSince = null;

  const begin = () => {
    if (heldSince === null) heldSince = performance.now();
  };
  const release = () => {
    heldSince = null;
    holdFill.style.width = '0';
  };

  holdButton.addEventListener('pointerdown', (event) => {
    holdButton.setPointerCapture?.(event.pointerId);
    begin();
  });
  holdButton.addEventListener('pointerup', release);
  holdButton.addEventListener('pointercancel', release);
  holdButton.addEventListener('contextmenu', (event) => event.preventDefault());
  holdButton.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) begin();
  });
  holdButton.addEventListener('keyup', release);
  el.querySelector('[data-back]').addEventListener('click', () => game.closeShout());

  function update(_game, now) {
    setRing(ring, game.claimProgress, length);

    const micFailed = mic.state === 'denied' || mic.state === 'unavailable';
    const useMic = !holdMode && !micFailed;
    meter.hidden = !useMic;
    setText(small, useMic ? 'Shout' : 'Call');
    setText(holdLabel, heldSince !== null ? 'Keep holding...' : useMic ? "Can't shout? Hold to call it" : 'Hold to call bingo');
    setClass(badge, 'warm', useMic && mic.state === 'live');
    setText(badge, useMic ? (mic.state === 'live' ? 'Mic is live' : 'Starting the microphone...') : 'Hold to call');
    setText(hint, !holdMode && micFailed
      ? game.callerLines.shout.denied
      : useMic ? 'Shout before the next number is called.' : 'Call before the next number is called.');

    if (useMic && mic.state === 'live') {
      const level = mic.sample();
      meterFill.style.width = percent(level);
      core.style.transform = `scale(${1 + level * 0.18})`;
      setText(status, level >= threshold ? 'Loud enough!' : level > threshold * 0.45 ? 'Louder!' : 'Give it a shout!');
      const settled = now - openedAt > game.config.shout.ignoreFirstMs; // ignore the sound of the tap itself
      if (settled && level >= threshold) {
        aboveSince ??= now;
        if (now - aboveSince >= game.config.shout.sustainMs) game.submitClaim();
      } else {
        aboveSince = null;
      }
    }

    if (heldSince !== null) {
      const progress = Math.min(1, (now - heldSince) / holdMs);
      holdFill.style.width = percent(progress);
      if (progress >= 1) {
        heldSince = null;
        game.submitClaim();
      }
    }
  }

  // The microphone goes off the moment this screen closes, whatever the reason.
  return { el, update, destroy: () => mic.stop() };
}

// ---------- Test your shout ----------

export function testScreen({ config, callerLines, mic, settings, onDone }) {
  const rules = config.shout;
  const saved = settings.get('shoutThreshold');
  const el = html(`<main class="screen">
    <div class="test">
      <div class="test-head">
        <button class="back-btn" data-back aria-label="Back">${icons.back()}</button>
        <h1>Test your shout</h1>
      </div>
      <div class="test-caller">
        <img src="${callerImages.talking}" alt="">
        <div class="speech"><span data-bubble></span></div>
      </div>
      <div class="test-mic-ring"><button class="test-mic" data-mic aria-label="Shout now">${icons.mic(64, 2)}</button></div>
      <div class="test-card">
        <div class="result-row"><div class="tick" data-tick hidden>${icons.tick()}</div><h2 data-result>Tap the microphone, then shout BINGO!</h2></div>
        <div class="bar"><div class="bar-fill" data-fill></div><div class="bar-mark" data-mark style="left:${percent(saved)}"></div></div>
        <p>The dark line is how loud you need to be in this room.</p>
      </div>
      <p class="test-note">The microphone only turns on when you tap Call bingo.</p>
      <div class="test-buttons">
        <button class="btn btn-aqua" data-good>Sounds good</button>
        <button class="btn btn-dim" data-hold>I can't shout here, use hold to call</button>
      </div>
    </div>
  </main>`);

  const bubble = el.querySelector('[data-bubble]');
  const fill = el.querySelector('[data-fill]');
  const mark = el.querySelector('[data-mark]');
  const resultEl = el.querySelector('[data-result]');
  const tick = el.querySelector('[data-tick]');
  const micButton = el.querySelector('[data-mic]');
  const say = (group) => setText(bubble, pickOne(callerLines.shoutTest[group]));
  say('intro');

  let phase = 'idle'; // idle, listening
  let liveSince = null;
  let peak = 0;

  micButton.addEventListener('click', () => {
    if (phase === 'listening') return;
    phase = 'listening';
    liveSince = null;
    peak = 0;
    tick.hidden = true;
    resultEl.textContent = 'Listening...';
    say('listening');
    mic.start(); // inside the tap, so the phone allows it
  });

  el.querySelector('[data-back]').addEventListener('click', () => onDone('back'));
  el.querySelector('[data-good]').addEventListener('click', () => {
    settings.set('holdToCallMode', false);
    settings.set('shoutTested', true);
    onDone('good');
  });
  el.querySelector('[data-hold]').addEventListener('click', () => {
    settings.set('holdToCallMode', true);
    settings.set('shoutTested', true);
    onDone('hold');
  });

  function finish() {
    mic.stop();
    phase = 'idle';
    if (peak >= rules.minPeakToAccept) {
      const level = Math.min(rules.maxThreshold, Math.max(rules.minThreshold, peak * rules.calibrationFactor));
      settings.set('shoutThreshold', level);
      mark.style.left = percent(level);
      fill.style.width = percent(peak);
      tick.hidden = false;
      resultEl.textContent = 'Loud enough!';
      say('good');
    } else {
      fill.style.width = '0';
      resultEl.textContent = 'A bit quiet. Try again!';
      say('quiet');
    }
  }

  function update(_game, now) {
    if (phase !== 'listening') return;
    if (mic.state === 'denied' || mic.state === 'unavailable') {
      mic.stop();
      phase = 'idle';
      resultEl.textContent = 'The microphone is off';
      say('denied');
      return;
    }
    if (mic.state !== 'live') return; // still waiting for the player to allow the microphone
    liveSince ??= now;
    const level = mic.sample();
    peak = Math.max(peak, level);
    fill.style.width = percent(level);
    if (now - liveSince >= rules.testSeconds * 1000) finish();
  }

  return { el, update, destroy: () => mic.stop() };
}
