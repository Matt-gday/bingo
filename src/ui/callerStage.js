import { Caller3D } from './caller3d/caller.js';
import { callerImages } from './helpers.js';

// The animated caller. There is one of him, drawn on one canvas, and each screen asks for him to be placed in
// its own spot. He follows the game's mood for the line being said (smile, cheer, wince), jumps for good news,
// shakes for bad news, looks at the ball when a number is called, and his mouth follows his real voice.

const EXPRESSION_FOR = { talking: 'talking', smile: 'happy', cheer: 'cheer', wince: 'wince', noPeeking: 'shut', worried: 'worried' };
// Where he can look: [turn, tilt]. Because he is drawn turned a little to the side, a turn of about +0.25
// faces the player. The number ball is to his left on the game screen and the cards are below him.
const LOOK_BALL = [-0.42, 0.0];
const LOOK_CARDS = [0.22, 0.32];
const LOOK_YOU = [0.18, 0.02];
const LOOK_AROUND = [[0.5, -0.18], [-0.2, -0.12], [0.4, 0.15], [0.05, -0.2], [-0.3, 0.12]];

// Settings from Data/config.json (caller section), with sensible fallbacks.
let settings = { idleMinSeconds: 2.2, idleMaxSeconds: 5.5, happyHopPower: 1.9, cheerJumpPower: 3.6, seasons: [] };
let heartEyes = false;
let nextIdle = 0;

// Called once at start-up with the game's config. Works out whether a special day is on.
export function configureCaller(config, today = new Date()) {
  settings = { ...settings, ...(config.caller ?? {}) };
  const wanted = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('season');
  heartEyes = false;
  for (const season of settings.seasons ?? []) {
    const day = new Date(today.getFullYear(), season.month - 1, season.day);
    const apart = Math.abs((today - day) / 86400000);
    if (wanted ? wanted === season.id : apart <= (season.daysEitherSide ?? 0)) {
      if (season.heartEyes) heartEyes = true;
    }
  }
  if (caller) caller.heartEyes(heartEyes);
}

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
    caller.heartEyes(heartEyes);
  } catch {
    failed = true; // no 3D on this phone: the screens show the flat pictures instead
  }
  return caller;
}

function idleGap() {
  return (settings.idleMinSeconds + Math.random() * (settings.idleMaxSeconds - settings.idleMinSeconds)) * 1000;
}

// Now and then, with nothing else going on, he looks somewhere else or gives a little hop.
function idle(now) {
  if (now < nextIdle || now < lookUntil) return;
  nextIdle = now + idleGap();
  const roll = Math.random();
  if (roll < 0.25) caller.look(...LOOK_YOU);
  else if (roll < 0.45) caller.look(...(follow?.game ? LOOK_CARDS : LOOK_YOU));
  else if (roll < 0.6 && follow?.game) caller.look(...LOOK_BALL);
  else caller.look(...LOOK_AROUND[Math.floor(Math.random() * LOOK_AROUND.length)]);
  if (Math.random() < 0.18 && caller.expressionName !== 'shut' && caller.expressionName !== 'wince') caller.jump(1.3);
}

function react(mood, kind) {
  const expression = EXPRESSION_FOR[mood] ?? 'talking';
  caller.setExpression(expression);
  if (mood === 'cheer') caller.jump(settings.cheerJumpPower);
  if (mood === 'smile' && kind !== 'call') caller.jump(settings.happyHopPower); // a happy little hop
  if (mood === 'wince') caller.shake();
  if (kind === 'call') {
    caller.look(...LOOK_BALL);
    lookUntil = performance.now() + 1500;
    nextIdle = performance.now() + 1500 + idleGap();
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
    if (caller.expressionName !== 'shut') idle(now);
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
    if (jump) caller.jump(settings.cheerJumpPower);
  } else {
    caller.setExpression(EXPRESSION_FOR[game.bubble.mood] ?? 'talking');
    if (game.phase === 'calling' || game.phase === 'locking') caller.look(...LOOK_CARDS);
  }
  if (!started) {
    started = true;
    requestAnimationFrame(frame);
  }
}
