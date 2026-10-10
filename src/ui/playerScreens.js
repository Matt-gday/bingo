import avatarData from '../../Data/avatar.json';
import { esc, html, icons } from './helpers.js';
import { attachCaller } from './callerStage.js';
import { mountFace } from './characterView.js';
import { cleanLook, defaultLook, itemById } from './caller3d/avatar.js';
import { soundCard } from './soundCard.js';

// Everything about who is playing: the welcome screen, the avatar creator (new player and "change my face"),
// the four rules, and settings.

// ---------- Who is playing ----------

export function welcomeScreen({ profiles, onPick, onNew }) {
  const tiles = profiles.list()
    .map((p) => `<button class="player-tile" data-player="${p.id}">
        <span class="tile-face" data-face="${p.id}"></span>
        <b>${esc(p.name)}</b>
        <span class="tile-credits">${icons.gem(16)} ${p.credits}</span>
      </button>`)
    .join('');
  const el = html(`<main class="screen">
    <div class="welcome">
      <h1 class="welcome-title">Solo Bingo</h1>
      <div class="caller-big">
        <div class="caller-img" data-caller></div>
        <div class="speech"><span>Evening! Who's playing tonight?</span></div>
      </div>
      <div class="player-tiles">
        ${tiles}
        <button class="player-tile new" data-new><span class="plus">+</span><b>New player</b></button>
      </div>
    </div>
  </main>`);
  attachCaller(el.querySelector('[data-caller]'), { mood: 'happy' });
  const faces = profiles.list().map((p) => mountFace(el.querySelector(`[data-face="${p.id}"]`), p.look, { size: 70 }));
  el.querySelectorAll('[data-player]').forEach((button) => button.addEventListener('click', () => onPick(button.dataset.player)));
  el.querySelector('[data-new]').addEventListener('click', onNew);
  return { el, update() {}, destroy: () => faces.forEach((f) => f.destroy()) };
}

// ---------- The avatar creator ----------

const TABS = [
  ['colour', 'Colour'],
  ['face', 'Face'],
  ['hat', 'Hat'],
  ['glasses', 'Glasses'],
  ['neck', 'Neck'],
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// `mode` is 'new' (asks for a name and starts the game) or 'edit' (change my face). `owned` lists the items the
// player has (null = all of them, for now).
export function avatarScreen({ mode, name = '', look, owned = null, onSave, onBack }) {
  let current = cleanLook(look ?? defaultLook('player'));
  let tab = 'colour';
  const isNew = mode === 'new';
  const has = (item) => !owned || owned.includes(item.id);

  const el = html(`<main class="screen">
    <div class="avatar-page">
      <div class="tonight-head">
        ${onBack ? `<button class="back-btn" data-back aria-label="Back">${icons.back()}</button>` : ''}
        <h1>${isNew ? 'New player' : 'My avatar'}</h1>
        <button class="dice" data-random aria-label="Surprise me">🎲</button>
      </div>
      <div class="avatar-preview" data-preview></div>
      <label class="name-field">Your name
        <input type="text" data-name maxlength="14" value="${esc(name)}" placeholder="Type your name" autocomplete="off" autocapitalize="words" enterkeyhint="done">
      </label>
      <div class="avatar-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="avatar-options" data-options></div>
      <div class="spacer"></div>
      <button class="btn btn-aqua" data-save>${isNew ? "Let's play!" : 'Save'}</button>
    </div>
  </main>`);

  const preview = mountFace(el.querySelector('[data-preview]'), current, { size: 150, mood: 'content', frameSize: 360 }); // open eyes, so every eye style can be seen
  const optionsEl = el.querySelector('[data-options]');
  const nameInput = el.querySelector('[data-name]');

  const swatch = (colour, chosen, attrs) => `<button class="swatch${chosen ? ' chosen' : ''}" style="background:${colour}" ${attrs} aria-label="${colour}"></button>`;
  const chip = (label, chosen, attrs) => `<button class="chip-btn${chosen ? ' chosen' : ''}" ${attrs}>${esc(label)}</button>`;

  function slotOptions(slot) {
    const items = avatarData.items.filter((i) => i.slot === slot && has(i));
    const picked = itemById(current[slot]);
    const colours = picked
      ? `<div class="swatches">${picked.colours.map((c) => swatch(c, (current[`${slot}Colour`] ?? picked.colours[0]).toLowerCase() === c.toLowerCase(), `data-colour="${slot}:${c}"`)).join('')}</div>`
      : '';
    return `<div class="chips">${chip('None', !current[slot], `data-item="${slot}:"`)}${items.map((i) => chip(i.name, current[slot] === i.id, `data-item="${slot}:${i.id}"`)).join('')}</div>${colours}`;
  }

  function render() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'colour') {
      optionsEl.innerHTML = `<p class="opt-label">Ball colour</p><div class="swatches">${avatarData.balls.map((b) => swatch(b.colour, current.ball.toLowerCase() === b.colour.toLowerCase(), `data-ball="${b.colour}"`)).join('')}</div>
        <p class="opt-label">Cheeks</p><div class="swatches">${avatarData.cheeks.map((c) => swatch(c, current.cheeks.toLowerCase() === c.toLowerCase(), `data-cheeks="${c}"`)).join('')}</div>`;
    } else if (tab === 'face') {
      optionsEl.innerHTML = `<p class="opt-label">Eyes</p><div class="chips">${avatarData.eyes.map((e) => chip(e.name, current.eyes === e.id, `data-eyes="${e.id}"`)).join('')}</div>`;
    } else {
      optionsEl.innerHTML = slotOptions(tab);
    }
  }

  function change(patch) {
    current = cleanLook({ ...current, ...patch });
    preview.setLook(current);
    render();
  }

  optionsEl.addEventListener('click', (event) => {
    const t = event.target.closest('button');
    if (!t) return;
    if (t.dataset.ball) change({ ball: t.dataset.ball });
    else if (t.dataset.cheeks) change({ cheeks: t.dataset.cheeks });
    else if (t.dataset.eyes) change({ eyes: t.dataset.eyes });
    else if (t.dataset.item !== undefined) {
      const [slot, id] = t.dataset.item.split(':');
      change({ [slot]: id || null, [`${slot}Colour`]: null });
    } else if (t.dataset.colour) {
      const [slot, colour] = t.dataset.colour.split(':');
      change({ [`${slot}Colour`]: colour });
    }
  });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  el.querySelector('[data-random]').addEventListener('click', () => {
    const pick = (slot) => (Math.random() < 0.6 ? randomItem(avatarData.items.filter((i) => i.slot === slot && has(i)))?.id ?? null : null);
    const hat = pick('hat');
    const glasses = pick('glasses');
    const neck = pick('neck');
    change({
      ball: randomItem(avatarData.balls).colour,
      cheeks: randomItem(avatarData.cheeks),
      eyes: randomItem(avatarData.eyes).id,
      hat, glasses, neck,
      hatColour: hat ? randomItem(itemById(hat).colours) : null,
      glassesColour: glasses ? randomItem(itemById(glasses).colours) : null,
      neckColour: neck ? randomItem(itemById(neck).colours) : null,
    });
  });
  // Drag or swipe the avatar to turn it. A quick flick keeps it spinning; left alone, it hops and turns back to
  // face the front. A simple tap still makes it cheer.
  const previewEl = el.querySelector('[data-preview]');
  let drag = null;
  previewEl.addEventListener('pointerdown', (event) => {
    previewEl.setPointerCapture?.(event.pointerId);
    drag = { x: event.clientX, lastX: event.clientX, lastT: performance.now(), vel: 0, moved: 0 };
    preview.dragStart();
  });
  previewEl.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const now = performance.now();
    const dx = event.clientX - drag.lastX;
    const dt = Math.max(1, now - drag.lastT) / 1000;
    drag.vel = drag.vel * 0.6 + (dx / dt) * 0.4; // pixels a second, smoothed
    drag.moved += Math.abs(dx);
    drag.lastX = event.clientX;
    drag.lastT = now;
    preview.dragBy(dx * 0.016);
  });
  const release = () => {
    if (!drag) return;
    const tapped = drag.moved < 6;
    const speed = performance.now() - drag.lastT > 90 ? 0 : drag.vel * 0.016; // holding still before letting go: no flick
    preview.dragEnd(speed);
    drag = null;
    if (tapped) {
      preview.setMood('cheer');
      setTimeout(() => preview.setMood('content'), 1400);
    }
  };
  previewEl.addEventListener('pointerup', release);
  previewEl.addEventListener('pointercancel', release);
  // The Enter / Done key on the keyboard just puts the keyboard away.
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      nameInput.blur();
    }
  });
  el.querySelector('[data-save]').addEventListener('click', () => onSave({ name: nameInput.value, look: current }));
  el.querySelector('[data-back]')?.addEventListener('click', onBack);
  render();
  return { el, update() {}, destroy: () => preview.destroy() };
}

// ---------- How to play ----------

export function howToPlayScreen({ onDone, voice, callerLines, again = false }) {
  const intro = callerLines?.game?.howTo?.[0] ?? 'Four quick rules before we start.';
  const rules = [
    ['Two cards, one mark', 'Each call, mark one square on either card. Nothing is marked for you.'],
    ['Beat the ring', 'Move your mark while the ring runs. When it closes, the mark locks for good.'],
    ['Shout it', 'Think you have it? Tap Call bingo, then shout BINGO out loud.'],
    ['Be sure', 'I check every number. A wrong card means you sit out two calls.'],
  ];
  const el = html(`<main class="screen">
    <div class="howto">
      <div class="caller-big">
        <div class="caller-img" data-caller></div>
        <div class="speech"><span>${esc(intro)}</span></div>
      </div>
      ${rules.map(([title, text], i) => `<div class="rule-card"><span class="rule-num">${i + 1}</span><div><b>${title}</b><span>${text}</span></div></div>`).join('')}
      <div class="spacer"></div>
      <button class="btn btn-aqua" data-done>${again ? 'Back' : 'Got it!'}</button>
    </div>
  </main>`);
  attachCaller(el.querySelector('[data-caller]'), { voice, mood: 'happy' });
  // He says it as the screen opens (the bubble stays up the whole time), then waits for "Got it!".
  const start = setTimeout(() => voice?.speak(intro), 450);
  el.querySelector('[data-done]').addEventListener('click', onDone);
  return { el, update() {}, destroy: () => { clearTimeout(start); voice?.cancel(); } };
}

// ---------- Settings ----------

export function settingsScreen({ config, settings, profiles, voice, sfx, music, haptics, onBack, onTestShout, onHowTo, onSwitch, onEdit, onReset }) {
  const sound = soundCard({ voice, settings, sfx, music, haptics });
  const speeds = config.speeds
    .map((s) => `<button data-speed="${s.id}">${esc(s.name)}</button>`)
    .join('');
  const el = html(`<main class="screen">
    <div class="settings">
      <div class="tonight-head">
        <button class="back-btn" data-back aria-label="Back">${icons.back()}</button>
        <h1>Settings</h1>
      </div>
      <h2>Sound</h2>
      <div class="set-card sound-sheet" data-sound></div>
      <h2>Game</h2>
      <div class="set-card">
        <div class="set-row column"><span>Usual speed</span><div class="segmented" data-speeds>${speeds}</div></div>
        <div class="set-row"><span>Shout level</span><button class="mini-btn" data-test>Test again</button></div>
        <div class="set-row"><span>Hold to call, no shouting</span><button class="switch" role="switch" data-hold><i></i></button></div>
      </div>
      <h2>Players and help</h2>
      <div class="set-card">
        <button class="set-row link" data-howto><span>How to play</span><i>›</i></button>
        <button class="set-row link" data-switch><span>Switch or add a player</span><i>›</i></button>
        <button class="set-row link" data-edit><span>Change my name or face</span><i>›</i></button>
        <button class="set-row link" data-reset><span>Start my progress again</span><i>›</i></button>
      </div>
    </div>
    <div class="confirm" data-confirm hidden>
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="Start again?">
        <h2>Start your progress again?</h2>
        <p>Your credits and results go back to zero. Your name and avatar stay.</p>
        <button class="btn btn-aqua" data-keep>Keep my progress</button>
        <button class="btn btn-white" data-really>Start again</button>
      </div>
    </div>
  </main>`);
  el.querySelector('[data-sound]').append(sound.el);
  const speedButtons = [...el.querySelectorAll('[data-speed]')];
  const hold = el.querySelector('[data-hold]');
  const confirmBox = el.querySelector('[data-confirm]');
  function show() {
    speedButtons.forEach((b) => b.classList.toggle('on', b.dataset.speed === settings.get('speedId')));
    const on = !!settings.get('holdToCallMode');
    hold.classList.toggle('on', on);
    hold.setAttribute('aria-checked', String(on));
    sound.update();
  }
  speedButtons.forEach((b) => b.addEventListener('click', () => { settings.set('speedId', b.dataset.speed); show(); }));
  hold.addEventListener('click', () => { settings.set('holdToCallMode', !settings.get('holdToCallMode')); settings.set('shoutTested', true); show(); });
  el.querySelector('[data-back]').addEventListener('click', onBack);
  el.querySelector('[data-test]').addEventListener('click', onTestShout);
  el.querySelector('[data-howto]').addEventListener('click', onHowTo);
  el.querySelector('[data-switch]').addEventListener('click', onSwitch);
  el.querySelector('[data-edit]').addEventListener('click', onEdit);
  el.querySelector('[data-reset]').addEventListener('click', () => { confirmBox.hidden = false; });
  el.querySelector('[data-keep]').addEventListener('click', () => { confirmBox.hidden = true; });
  el.querySelector('[data-really]').addEventListener('click', () => { confirmBox.hidden = true; onReset(); });
  show();
  return { el, update() {} };
}
