import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './style.css';

import config from '../Data/config.json';
import patterns from '../Data/patterns.json';
import callerLines from '../Data/caller-lines.json';
import { Game } from './engine/game.js';
import {
  startScreen, playScreen, shoutScreen, checkingScreen, falseCallScreen, resultScreen,
} from './ui/screens.js';

const root = document.getElementById('app');
document.title = config.gameName;

// Phase 1 plays one line. Later phases will let the player pick the night's length.
const STAGES = ['line'];

function remembered(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Saving is a convenience here, so it is fine if the browser says no.
  }
}

let speedId = remembered('speed', 'steady');
if (!config.speeds.some((s) => s.id === speedId)) speedId = config.speeds[0].id;

let game = null;
let current = null; // { name, el, update }

function show(name, build) {
  current = { name, ...build() };
  root.replaceChildren(current.el);
  window.scrollTo(0, 0);
}

function showStart() {
  game = null;
  show('start', () => startScreen({
    config,
    chosenSpeed: speedId,
    onChoose: (id) => {
      speedId = id;
      remember('speed', id);
    },
    onPlay: startGame,
  }));
}

function startGame() {
  game = new Game({ config, patterns, callerLines, speedId, stageIds: STAGES });
  game.start();
  current = null;
  if (import.meta.env.DEV) window.__game = game; // for testing in the browser console only
}

// The screen on show follows what the game says the player should be looking at.
function sync() {
  if (!game) return;
  const wanted = { cards: 'play', shout: 'shout', checking: 'checking', falseCall: 'falseCall', result: 'result' }[game.screen];
  if (current?.name === wanted) return;
  const builders = {
    play: () => playScreen(game),
    shout: () => shoutScreen(game),
    checking: () => checkingScreen(game),
    falseCall: () => falseCallScreen(game),
    result: () => resultScreen(game, { onAgain: startGame, onChange: showStart }),
  };
  show(wanted, builders[wanted]);
}

let last = performance.now();
function frame(now) {
  const dt = now - last;
  last = now;
  if (game) {
    game.advance(dt);
    sync();
    current?.update(game, now);
  }
  requestAnimationFrame(frame);
}

showStart();
requestAnimationFrame(frame);
