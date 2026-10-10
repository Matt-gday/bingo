import { hub } from './caller3d/hub.js';
import { cleanLook, defaultLook } from './caller3d/avatar.js';
import { faceSvg } from './faces.js';

// Puts a character's face into a box on the page: the animated 3D character where the phone can draw it, or the
// flat drawn face where it cannot. `who` is a regular (it has a colour and a look) or the player's look.

export function lookOf(who) {
  if (who?.look) return cleanLook(who.look);
  if (who?.colour) return cleanLook({ ...defaultLook('player'), ball: who.colour });
  return cleanLook(who ?? defaultLook('player'));
}

export function mountFace(el, who, { size = 56, mood = 'content', frameSize } = {}) {
  const colour = who?.colour ?? who?.ball ?? '#9fb4ff';
  const view = hub.mount(el, lookOf(who), { cssSize: frameSize ?? Math.round(size * 1.7) });
  if (view) {
    view.setMood(mood);
    return {
      setMood: (m) => view.setMood(m),
      setLook: (l) => view.setLook(l),
      dragStart: () => view.character.dragStart(),
      dragBy: (r) => view.character.dragBy(r),
      dragEnd: (v) => view.character.dragEnd(v),
      destroy: () => view.destroy(),
    };
  }
  // No 3D on this phone: the flat face instead
  const draw = (m) => { el.innerHTML = faceSvg(colour, m, size); };
  draw(mood);
  return { setMood: draw, setLook() {}, dragStart() {}, dragBy() {}, dragEnd() {}, destroy() {} };
}
