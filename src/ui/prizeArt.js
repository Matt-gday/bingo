import { hub } from './caller3d/hub.js';
import { cleanLook, defaultLook } from './caller3d/avatar.js';

// Pictures of prizes and set badges. They are small WebP files made by tools/make-art.py from the artwork in
// Images/. A wearable prize with no picture yet is shown as the real 3D item on a head instead.

const base = () => import.meta.env.BASE_URL;

// A soft tinted circle sits behind each prize. The tint contrasts with the prize, so a pink prize never sits on
// a pink circle.
const CONTRAST = { pink: '#D6F7F4', purple: '#FFF1C9', aqua: '#FFE0EF', rainbow: '#E3DCFF', sparkly: '#DDE8FF', fluffy: '#E7F7E1' };
const PALETTE = ['#FFE0EF', '#D6F7F4', '#E3DCFF', '#FFF1C9', '#DDE8FF', '#E7F7E1'];

export function tintFor(prize) {
  for (const tag of prize.tags) if (CONTRAST[tag]) return CONTRAST[tag];
  let hash = 0;
  for (const ch of prize.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function prizeUrl(prize) {
  return `${base()}art/prizes/${prize.id}.webp`;
}

export function badgeUrl(setId) {
  return `${base()}art/badges/${setId}.webp`;
}

// The look that shows a wearable on a head: the item, in its colour, on the plain default avatar.
export function wearableLook(prize) {
  const { item, colour } = prize.wearable;
  const slot = { 'party-hat': 'hat', beanie: 'hat', cap: 'hat', 'top-hat': 'hat', crown: 'hat', headband: 'hat', 'round-glasses': 'glasses', sunglasses: 'glasses', 'heart-glasses': 'glasses', bow: 'neck', tie: 'neck', scarf: 'neck' }[item];
  return cleanLook({ ...defaultLook('player'), ball: '#F2E9FF', [slot]: item, [`${slot}Colour`]: colour });
}

// Fills `el` with the prize's picture. Returns a function that tidies up afterwards.
export function showPrizeArt(el, prize) {
  el.classList.add('prize-art');
  el.style.setProperty('--tint', tintFor(prize));
  let view = null;
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.src = prizeUrl(prize);
  img.addEventListener('error', () => {
    img.remove();
    if (prize.wearable) {
      // no picture yet: the real item on a head
      view = hub.mount(el, wearableLook(prize), { cssSize: 150 });
      el.classList.add('wearable-3d');
    } else {
      el.textContent = '🎁';
    }
  });
  el.append(img);
  return () => view?.destroy();
}

// A set badge, with a gold or silver glow that follows its shape, or faint if it has not been earned.
export function badgeHtml(set, state) {
  const cls = state === 'gold' ? ' gold' : state === 'silver' ? ' silver' : ' faint';
  return `<span class="set-badge${cls}"><img src="${badgeUrl(set.id)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge-fallback',textContent:'${set.id === 'dress-up' ? '👒' : '🏅'}'}))"></span>`;
}
