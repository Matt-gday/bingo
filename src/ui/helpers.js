import talking from '../../Images/characters/caller-talking.png';
import smile from '../../Images/characters/caller-smile.png';
import cheer from '../../Images/characters/caller-cheer.png';
import wince from '../../Images/characters/caller-wince.png';
import noPeeking from '../../Images/characters/caller-no-peeking.png';

export const callerImages = { talking, smile, cheer, wince, noPeeking };

export const RING_RADIUS = 45;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Build an element from an HTML string.
export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

// Only touch the page when a value has really changed, because this runs every frame.
export function setText(el, value) {
  const text = String(value);
  if (el.__text !== text) {
    el.__text = text;
    el.textContent = text;
  }
}

export function setClass(el, name, on) {
  if (el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on);
}

export const icons = {
  mic: (size = 22, stroke = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"></path></svg>`,
  lock: (size = 34) => `<svg class="lock-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>`,
  tick: (size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#1A1446" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`,
  cross: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#1A1446" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`,
  back: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg>`,
};

// A ball with the timer ring around it.
export function ballMarkup() {
  return `<div class="ball-wrap">
    <svg class="ring" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="${RING_RADIUS}" stroke="#fff" stroke-opacity="0.3" stroke-width="6"></circle>
      <circle class="ring-left" cx="48" cy="48" r="${RING_RADIUS}" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="rotate(-90 48 48)"></circle>
    </svg>
    <div class="ball"><div class="letter"></div><div class="num"></div>${icons.lock()}</div>
  </div>`;
}

// The ring empties clockwise from the top as time runs out.
export function setRing(circle, progress, length = RING_LENGTH) {
  const remaining = Math.max(0, 1 - progress) * length;
  const dash = `${remaining.toFixed(1)} ${length.toFixed(1)}`;
  if (circle.__dash !== dash) {
    circle.__dash = dash;
    circle.setAttribute('stroke-dasharray', dash);
    circle.setAttribute('stroke-dashoffset', (-(length - remaining)).toFixed(1));
  }
}

// Keeps a ball showing the current number, with its ring.
export function updateBall(wrap, game) {
  const ball = wrap.querySelector('.ball');
  const number = game.currentNumber;
  const key = `${number}`;
  if (ball.__key !== key) {
    const first = ball.__key === undefined;
    ball.__key = key;
    setText(ball.querySelector('.letter'), game.letterOf(number));
    setText(ball.querySelector('.num'), number);
    if (!first) {
      ball.classList.remove('pop');
      void ball.offsetWidth; // restart the little bounce
      ball.classList.add('pop');
    }
  }
  setClass(ball, 'locked', game.phase === 'locking');
  setRing(wrap.querySelector('.ring-left'), game.callProgress);
}

// A tiny picture of the pattern being played, built from Data/patterns.json.
export function patternPreview(pattern) {
  let cells;
  if (pattern.rule === 'lines') cells = [2, 0, 4, 1, 3].slice(0, pattern.count).flatMap((r) => [0, 1, 2, 3, 4].map((c) => [r, c]));
  else if (pattern.rule === 'all') cells = Array.from({ length: 25 }, (_, i) => [Math.floor(i / 5), i % 5]);
  else {
    const grid = pattern.rule === 'anyOf' ? pattern.grids[0] : pattern.grid;
    cells = grid.flatMap((row, r) => row.map((on, c) => (on ? [r, c] : null)).filter(Boolean));
  }
  const on = new Set(cells.map(([r, c]) => `${r},${c}`));
  const size = 40 / 5;
  let rects = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      rects += `<rect x="${c * size + 0.6}" y="${r * size + 0.6}" width="${size - 1.2}" height="${size - 1.2}" rx="1.2" fill="${on.has(`${r},${c}`) ? '#6A3DF0' : '#fff'}"></rect>`;
    }
  }
  return `<svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true" style="flex-shrink:0">${rects}</svg>`;
}

export function confetti(container) {
  const colours = ['#2EE6D6', '#FF8FCB', '#FFD84A', '#6A3DF0', '#4ADE80', '#fff'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < 46; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colours[i % colours.length];
    piece.style.animationDuration = `${2.2 + Math.random() * 2.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    layer.appendChild(piece);
  }
  container.prepend(layer);
}
