import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './style.css';

import config from '../Data/config.json';
import patterns from '../Data/patterns.json';
import callerLines from '../Data/caller-lines.json';
import { Game } from './engine/game.js';
import { createSettings } from './settings.js';
import { Mic } from './audio/mic.js';
import { Voice } from './audio/voice.js';
import {
  startScreen, playScreen, checkingScreen, falseCallScreen, resultScreen,
} from './ui/screens.js';
import { shoutScreen, testScreen } from './ui/shoutScreens.js';
import { pauseScreen } from './ui/pauseScreen.js';

const root = document.getElementById('app');
document.title = config.gameName;

// Phase 2 still plays one line. Later phases will let the player pick the night's length.
const STAGES = ['line'];

const settings = createSettings(config);
const mic = new Mic(config);
const voice = new Voice(config, settings);
voice.loadClips(`${import.meta.env.BASE_URL}audio/caller/`);

if (!config.speeds.some((s) => s.id === settings.get('speedId'))) settings.set('speedId', config.speeds[0].id);

let game = null;
let current = null; // { name, el, update, destroy }
let playAfterTest = false;

function show(name, build) {
  current?.destroy?.();
  current = { name, ...build() };
  root.replaceChildren(current.el);
  window.scrollTo(0, 0);
}

function showStart() {
  game = null;
  voice.cancel();
  show('start', () => startScreen({
    config,
    chosenSpeed: settings.get('speedId'),
    voice,
    onChoose: (id) => settings.set('speedId', id),
    onPlay: () => {
      if (settings.get('shoutTested')) startGame();
      else showTest(true);
    },
    onTest: () => showTest(false),
  }));
}

function showTest(thenPlay) {
  playAfterTest = thenPlay;
  show('test', () => testScreen({
    config,
    callerLines,
    mic,
    settings,
    onDone: (result) => {
      if (result !== 'back' && playAfterTest) startGame();
      else showStart();
    },
  }));
}

function startGame() {
  // Release microphone capture before starting output, while still in the tap.
  current?.destroy?.();
  current = null;
  let starting = true;
  game = new Game({
    config, patterns, callerLines, speedId: settings.get('speedId'), stageIds: STAGES,
  });
  game.on((type, data) => {
    if (type === 'say') {
      if (starting) return; // start() emits both a greeting and the first number
      voice.speak(data.spoken ?? data.text);
    } else if (type === 'pause') {
      voice.cancel();
    }
  });
  game.start();
  starting = false;
  voice.speak(game.bubble.text); // real speech directly inside the Play tap
  if (import.meta.env.DEV) window.__game = game; // for testing in the browser console only
}

// The screen on show follows what the game says the player should be looking at.
function sync() {
  if (!game) return;
  const wanted = game.pauseState
    ? 'pause'
    : { cards: 'play', shout: 'shout', checking: 'checking', falseCall: 'falseCall', result: 'result' }[game.screen];
  if (current?.name === wanted) return;
  const builders = {
    play: () => playScreen(game, { voice, mic, settings }),
    shout: () => shoutScreen(game, { mic, settings }),
    checking: () => checkingScreen(game),
    falseCall: () => falseCallScreen(game),
    result: () => resultScreen(game, { onAgain: startGame, onChange: showStart }),
    pause: () => pauseScreen(game, {
      onQuit: showStart,
      onResume: () => game.resume(),
    }),
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
  }
  current?.update(game, now);
  requestAnimationFrame(frame);
}

// Switching apps, a phone call or locking the screen covers the game, so nobody can study
// the cards while the clock is stopped. It does not use up the player's one pause.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game?.autoPause();
});
window.addEventListener('pagehide', () => game?.autoPause());

showStart();
requestAnimationFrame(frame);
