import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './style.css';
import './glossy.css';

import config from '../Data/config.json';
import patterns from '../Data/patterns.json';
import callerLines from '../Data/caller-lines.json';
import { Game } from './engine/game.js';
import { createSettings } from './settings.js';
import { Mic } from './audio/mic.js';
import { Voice } from './audio/voice.js';
import { AudioEngine } from './audio/engine.js';
import { Sfx } from './audio/sfx.js';
import { Music } from './audio/music.js';
import { configureCaller } from './ui/callerStage.js';
import { keepScreenOn } from './wakeLock.js';
import { Haptics } from './audio/haptics.js';
import { attachGameSounds } from './audio/gameSounds.js';
import { createIntroPicker } from './introLines.js';
import {
  splashScreen, startScreen, playScreen, checkingScreen, resultScreen,
} from './ui/screens.js';
import { shoutScreen, testScreen } from './ui/shoutScreens.js';
import { pauseScreen } from './ui/pauseScreen.js';

const root = document.getElementById('app');
document.title = config.gameName;

// How things appear comes from Data/config.json, so it can be tuned in one place.
const motion = document.documentElement.style;
motion.setProperty('--screen-ms', `${config.animation.screenMs}ms`);
motion.setProperty('--slide', `${config.animation.slidePx}px`);
motion.setProperty('--pop-ms', `${config.animation.popMs}ms`);
motion.setProperty('--stagger-ms', `${config.animation.staggerMs}ms`);

// Phase 2 still plays one line. Later phases will let the player pick the night's length.
const STAGES = ['line'];

const settings = createSettings(config);
const mic = new Mic(config);
const engine = new AudioEngine(); // one audio system shared by the voice, the sound effects and the music
const voice = new Voice(config, settings, engine);
const sfx = new Sfx(engine, settings);
const music = new Music(engine, settings);
const haptics = new Haptics(settings);
keepScreenOn();
configureCaller(config);
const introPicker = createIntroPicker(callerLines.game.intro, settings);
const audioBase = `${import.meta.env.BASE_URL}audio/`;
// Get the audio ready as the page loads. Until the player's first tap the phone keeps it silent, but music
// that is already loaded and waiting starts the moment that first tap wakes the audio up.
engine.ensure();
voice.loadClips(`${audioBase}caller/`);
sfx.loadList(`${audioBase}sfx/`);
music.loadList(`${audioBase}music/`);

// Phones only allow sound to start from a tap, so the first tap anywhere switches the audio on.
let audioUnlocked = false;
function unlockAudio() {
  const ctx = engine.ensure(); // also wakes the audio up again if the phone put it to sleep
  if (!ctx) return;
  if (!audioUnlocked) {
    audioUnlocked = true;
    sfx.preload();
    // The moment the phone lets the audio run, start the music that is waiting.
    ctx.addEventListener?.('statechange', () => music.sync());
  }
  try {
    // A tiny silent sound played inside the tap: some phones only wake the audio up for this.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);
  } catch {
    // Fine: resume() below is the main way.
  }
  Promise.resolve(ctx.resume?.()).then(() => music.sync()).catch(() => {});
  // Check again shortly after, in case the phone was slow to wake the audio.
  for (const ms of [250, 800, 2000]) setTimeout(() => music.sync(), ms);
}
const unlockEvents = ['click', 'touchend', 'pointerup', 'keydown'];
for (const type of unlockEvents) document.addEventListener(type, unlockAudio, { capture: true, passive: true });

// A soft tap sound and a tiny buzz for ordinary buttons (the squares, the ball and the call buttons have their own).
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled || button.classList.contains('sq')) return;
  if (button.matches('[data-call], [data-hold], [data-mic], [data-mute]')) return;
  sfx.play('button-tap');
  haptics.buzz(5);
});

// Which music belongs with which screen. The music only plays if the player has turned it on.
// (null means no music: the microphone screens, because music makes the phone's microphone crackle)
const MUSIC_FOR = {
  splash: 'home', start: 'home', test: null, play: 'play-loop', shout: null, checking: 'play-loop', pause: 'play-loop', result: 'home',
};

if (!config.speeds.some((s) => s.id === settings.get('speedId'))) settings.set('speedId', config.speeds[0].id);

let game = null;
let current = null; // { name, el, update, destroy }
let playAfterTest = false;

// Phones report the page height late and differently each time it opens (browser bars, home-screen app), which
// left a dark strip at the bottom. Measure it again a few times and whenever it changes.
function measureHeight() {
  const h = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
measureHeight();
for (const ms of [100, 400, 1000, 2500]) setTimeout(measureHeight, ms);
for (const type of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(type, measureHeight);
window.visualViewport?.addEventListener('resize', measureHeight);

function show(name, build) {
  current?.destroy?.();
  current = { name, ...build() };
  root.replaceChildren(current.el);
  window.scrollTo(0, 0);
  // Anything the screen does not cover takes the colour of the bottom of its gradient, so no dark strip shows.
  document.documentElement.style.background = current.el.classList.contains('tense') ? '#7a2a96' : '#c257d9';
  music.play(name in MUSIC_FOR ? MUSIC_FOR[name] : 'home');
}

// The very first screen: a tap here is what lets a phone play sound, so the music and voice work from the start.
function showSplash() {
  show('splash', () => splashScreen({ config, callerLines, voice, onDone: showStart }));
}

function showStart() {
  game = null;
  voice.cancel();
  show('start', () => startScreen({
    config,
    callerLines,
    chosenSpeed: settings.get('speedId'),
    voice,
    settings,
    sfx,
    music,
    haptics,
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
  voice.onProtectedFinished = () => game?.lineFinished();
  // Release microphone capture before starting output, while still in the tap.
  current?.destroy?.();
  current = null;
  let starting = true;
  game = new Game({
    config, patterns, callerLines, speedId: settings.get('speedId'), stageIds: STAGES,
    introLine: introPicker.next(), // a different welcome each game, using every line before any repeats
  });
  attachGameSounds(game, { sfx, haptics, music });
  game.on((type, data) => {
    if (type === 'say') {
      if (starting) return; // start() emits both a greeting and the first number
      // The false-call line and the "Here we go!" count-in are left to finish.
      voice.speak(data.spoken ?? data.text, { protect: data.kind === 'falseCall' || data.kind === 'introCountdown' });
      if (data.kind === 'introCountdown' && !voice.on) game.lineFinished({ silent: true }); // no voice, nothing to wait for
    } else if (type === 'falseCall') {
      // With the voice off there is no line to wait for, so give the player a moment to read it.
      if (!voice.on) game.lineFinished({ silent: true });
    } else if (type === 'pause') {
      voice.cancel();
      // The player's own pause gets the caller's "No peeking!". Leaving the app does not talk.
      if (game.pauseReason === 'player') voice.speak(callerLines.game.pause[0]);
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
    : { cards: 'play', shout: 'shout', checking: 'checking', result: 'result' }[game.screen];
  if (current?.name === wanted) return;
  const builders = {
    play: () => playScreen(game, { voice, mic, settings }),
    shout: () => shoutScreen(game, { mic, settings }),
    checking: () => checkingScreen(game, { voice }),
    result: () => resultScreen(game, { onAgain: startGame, onChange: showStart }),
    pause: () => pauseScreen(game, {
      onQuit: showStart,
      onResume: () => game.resume(),
      voice, settings, sfx, music, haptics,
    }),
  };
  show(wanted, builders[wanted]);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); // always schedule the next frame first, so one error can never freeze the whole game
  const dt = now - last;
  last = now;
  try {
    if (game) {
      game.advance(dt);
      sync();
    }
    current?.update(game, now);
  } catch (error) {
    console.error(error);
  }
}

// Switching apps, a phone call or locking the screen covers the game, so nobody can study
// the cards while the clock is stopped. It does not use up the player's one pause.
function setLockScreenState(state) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

// When the phone locks or the game is switched away, all sound stops too (music, effects and the caller).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game?.autoPause();
    voice.cancel();
    engine.suspend();
    setLockScreenState('paused');
  } else {
    engine.resume();
    setLockScreenState('playing');
  }
});
window.addEventListener('pagehide', () => {
  game?.autoPause();
  engine.suspend();
});

// The lock screen shows the game's name, and its play and pause buttons work.
if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: config.gameName,
    artist: 'Bingo night',
    artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    game?.autoPause(); // keep the cards covered and the numbers stopped while the sound is stopped
    engine.suspend();
    setLockScreenState('paused');
  });
  navigator.mediaSession.setActionHandler('play', () => {
    engine.resume();
    setLockScreenState('playing');
  });
}

showSplash();
requestAnimationFrame(frame);
