import { Caller3D } from './caller3d/caller.js';
import { callerImages } from './helpers.js';

// The animated caller. There is one of him, drawn on one canvas, and each screen asks for him to be placed in
// its own spot. He follows the game's mood for the line being said (smile, cheer, wince), jumps for good news,
// shakes for bad news, looks at the ball when a number is called, and his mouth follows his real voice.

const EXPRESSION_FOR = { talking: 'talking', smile: 'happy', cheer: 'cheer', wince: 'wince', noPeeking: 'shut', worried: 'worried' };
const LOOK_BALL = [0.34, -0.26]; // up and to the side, where the ball is
const LOOK_CARDS = [0, 0.22]; // down at his cards
const LOOK_YOU = [0, 0];

let caller = null;
let failed = false;
let slot = null; // where he is now
let follow = null; // { game, voice, fixedMood, engine }
let lastBubble = null;
let lastText = '';
let lastTime = 0;
let lookUntil = 0;
let quietUntil = 0;
let started = false;
const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (canvas) canvas.className = 'caller-canvas';

function build() {
  if (caller || failed || !canvas) return caller;
  try {
    caller = new Caller3D(canvas, { size: 320 });
  } catch {
    failed = true; // no 3D on this phone: the screens show the flat pictures instead
  }
  return caller;
}

function react(mood, kind) {
  const expression = EXPRESSION_FOR[mood] ?? 'talking';
  caller.setExpression(expression);
  if (mood === 'cheer') caller.jump(3.6);
  if (mood === 'wince') caller.shake();
  if (kind === 'call') {
    caller.look(...LOOK_BALL);
    lookUntil = performance.now() + 1500;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!caller || !slot || !slot.isConnected) return;
  const dt = (now - (lastTime || now)) / 1000;
  lastTime = now;
  try {
    if (follow?.game) {
      const bubble = follow.game.bubble;
      if (bubble !== lastBubble) {
        lastBubble = bubble;
        if (bubble.text && bubble.text !== lastText) {
          lastText = bubble.text;
          react(bubble.mood, follow.game.phase === 'calling' && bubble.mood === 'talking' ? 'call' : 'line');
          quietUntil = now + 2500; // with the voice off he still moves his mouth for a moment
        } else if (!bubble.text) {
          caller.setExpression('neutral');
        }
      }
      if (lookUntil && now > lookUntil) {
        lookUntil = 0;
        caller.look(...(follow.game.phase === 'calling' ? LOOK_CARDS : LOOK_YOU));
      }
    }
    // the mouth: follows the real loudness of a recording, or flaps along if it is the phone's voice
    const voice = follow?.voice;
    const clip = voice?.handle;
    const speaking = !!voice?.speaking || (follow?.game && now < quietUntil && !voice?.on);
    caller.externalMouth = clip ? Math.min(1, follow.engine.level() * 1.3) : null;
    caller.talk(!!speaking && !clip);
    caller.update(dt);
  } catch {
    // never let the picture stop the game
  }
}

// Put the caller in `el` (an empty box that the page sizes). Options:
//   game, voice, engine: let the game's mood and his voice drive him;
//   mood: a fixed mood instead (for the start, pause and result screens);
//   jump: bounce once when he arrives.
export function attachCaller(el, { game = null, voice = null, engine = null, mood = 'smile', jump = false } = {}) {
  build();
  if (!caller) {
    el.innerHTML = `<img src="${callerImages[game?.bubble?.mood ?? mood] ?? callerImages.smile}" alt="">`;
    return;
  }
  el.appendChild(canvas);
  slot = el;
  follow = { game, voice, engine: engine ?? voice?.engine };
  lastBubble = null;
  lastText = '';
  lookUntil = 0;
  caller.look(...LOOK_YOU);
  if (!game) {
    caller.setExpression(EXPRESSION_FOR[mood] ?? 'happy');
    if (jump) caller.jump(3.6);
  } else {
    caller.setExpression(EXPRESSION_FOR[game.bubble.mood] ?? 'talking');
    if (game.phase === 'calling' || game.phase === 'locking') caller.look(...LOOK_CARDS);
  }
  if (!started) {
    started = true;
    requestAnimationFrame(frame);
  }
}
