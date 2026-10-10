import { esc, html, setText, setClass, setRing, updateBall, ballMarkup, icons, callerImages, patternPreview, confetti } from './helpers.js';
import { columnLetters } from '../engine/cards.js';
import { SpeechBubble } from './speech.js';
import { attachCaller, emote } from './callerStage.js';
import { mountFace } from './characterView.js';
import { mountPlayer, checkingMood, playingMood } from './playerAvatar.js';
import { shuffle } from '../engine/rng.js';
import { popIn } from './speech.js';

// Each screen function returns { el, update(game, now) }. update runs every frame
// and only changes the page when something really changed.

export function callerBubble(game, el, { voice, maxLines }) {
  const speech = new SpeechBubble(el.querySelector('.speech'), { voice, maxLines });
  attachCaller(el.querySelector('[data-caller]'), { game, voice });
  return {
    sync(now) {
      speech.update(game.bubble, now);
    },
  };
}

// ---------- Splash: one tap to wake the caller (and, on a phone, the sound) ----------

export function splashScreen({ config, callerLines, voice, onDone }) {
  const el = html(`<main class="screen splash" role="button" tabindex="0" aria-label="Tap to start">
    <div class="splash-body">
      <h1>${esc(config.gameName)}</h1>
      <div class="splash-caller" data-splash-caller>
        <span class="zzz z1">z</span><span class="zzz z2">z</span><span class="zzz z3">Z</span>
      </div>
    </div>
    <div class="buttons"><button class="btn btn-aqua splash-btn" data-splash-go>Tap to start</button></div>
  </main>`);
  const callerEl = el.querySelector('[data-splash-caller]');
  attachCaller(callerEl, { voice, mood: 'noPeeking' }); // eyes shut: he is fast asleep (given the voice so his mouth follows it)
  let woken = false;
  const wake = () => {
    if (woken) return;
    woken = true;
    el.classList.add('awake');
    emote({ face: 'excited', jump: 3.4, wobble: 4, talkMs: 0 });
    const line = callerLines.game.splash?.[0] ?? "Yay, it's bingo time!";
    // He always says this greeting, even if the player turned the sound off last time.
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      emote({ face: 'neutral' }); // a closed, smiling mouth once he has finished speaking
      voice.onProtectedFinished = previous;
      onDone();
    };
    const previous = voice.onProtectedFinished;
    voice.onProtectedFinished = done; // the greeting has finished being said: now move on
    voice.speak(line, { protect: true, force: true });
    setTimeout(done, 7000); // never get stuck here if the sound does not play
  };
  el.addEventListener('click', wake);
  el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') wake(); });
  return { el, update() {} };
}

// ---------- Start ----------

// The caller on the start screen chats away on his own with funny welcomes, and giggles if he is tapped.
function startCallerTalk(el, callerEl, { voice, config, callerLines }) {
  const lineEl = el.querySelector('[data-home-line]');
  const chat = callerLines.game.home ?? [];
  const tickles = callerLines.game.homeTickle ?? [];
  const gapMs = (config.caller?.homeLineGapSeconds ?? 3) * 1000;
  const FACES = ['happy', 'excited', 'cheer'];
  const bags = new Map();
  const nextFrom = (name, list) => {
    if (!bags.get(name)?.length) bags.set(name, shuffle([...list]));
    return bags.get(name).shift();
  };
  let timer = null;
  let tapped = 0;

  // Voice only if the phone has already allowed sound (after the first tap), never before.
  // The bubble is only there while he is talking: it pops open as he starts a line, and pops down to nothing
  // as soon as the line has been said, so the whole caller can be seen.
  const bubbleEl = lineEl.parentElement;
  const rowEl = bubbleEl.parentElement; // gets the class 'talking' while he speaks, which slides him to the left
  bubbleEl.classList.add('gone');
  let closeTimer = null;
  const say = (text, move) => {
    const ms = voice.estimateMs(text);
    clearTimeout(closeTimer);
    lineEl.textContent = text;
    bubbleEl.classList.remove('gone', 'pop-out');
    rowEl.classList.add('talking');
    popIn(bubbleEl);
    emote({ ...move, talkMs: ms });
    if (voice.on && voice.engine.ctx?.state === 'running') voice.speak(text);
    closeTimer = setTimeout(() => {
      bubbleEl.classList.add('pop-out');
      rowEl.classList.remove('talking'); // the bubble has gone, so he bounces back to the middle
    }, ms + 400);
    return ms;
  };
  const chatter = () => {
    if (!el.isConnected && timer !== 'first') return; // the start screen has gone
    if (!chat.length) return;
    const text = nextFrom('chat', chat);
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    const ms = say(text, { face, jump: 2.2, wobble: 2 });
    timer = setTimeout(chatter, ms + gapMs);
  };
  timer = 'first';
  setTimeout(() => { timer = null; chatter(); }, 600);

  callerEl.addEventListener('click', () => {
    if (!tickles.length) return;
    clearTimeout(timer);
    tapped += 1;
    const ms = say(nextFrom('tickle', tickles), { face: 'happy', jump: 2 + Math.min(tapped, 4) * 0.3, wobble: 6, spin: tapped % 3 === 0 });
    timer = setTimeout(chatter, ms + gapMs + 1500);
  });
}

export function startScreen({ config, callerLines, player, voice, micStatus, onPlay, onSetupMic, onChoosePressToCall, onSwitchPlayer, onAvatar, onSettings, onPeek, onSets, onCabinet }) {
  // The microphone card looks different once the shout has been set up: ready (aqua and pulsing),
  // press-to-call chosen, or not set up yet.
  const status = micStatus(); // 'ready', 'pressToCall' or 'none'
  const mic = {
    ready: { chip: '✓ Mic ready', chipClass: 'ok', note: 'Your mic is ready.', button: 'Recalibrate my shout', buttonClass: 'btn-ghost' },
    pressToCall: { chip: 'Press to call', chipClass: 'plain', note: 'You call bingo by pressing a button.', button: 'Set up microphone', buttonClass: 'btn-aqua' },
    none: { chip: 'Not set up yet', chipClass: 'warn', note: 'Set up your microphone so the caller can hear you.', button: 'Set up microphone', buttonClass: 'btn-aqua' },
  }[status];

  const el = html(`<main class="screen">
    <div class="start">
      <div class="home-head">
        <button class="home-me" data-me aria-label="Switch player"><span class="home-face" data-me-face></span></button>
        <div class="home-hi"><b>Hi ${esc(player.name)}!</b><span>Tap your face to switch player</span></div>
        <div class="credits-pill">${icons.gem(20)}<b>${player.credits}</b></div>
      </div>
      <div class="home-row">
        <div class="start-caller" data-start-caller role="button" aria-label="Tickle the caller"></div>
        <div class="speech home-speech"><span data-home-line></span></div>
      </div>
      <div class="shout-card" data-mic-card role="button" tabindex="0">
        <div class="mic-orb${status === 'ready' ? ' live' : status === 'none' ? ' off' : ''}">${icons.mic(40, 2.2)}</div>
        <div class="shout-card-text">
          <b>Shout BINGO to win!</b>
          <span>${mic.note}</span>
          <i class="mic-chip ${mic.chipClass}">${mic.chip}</i>
        </div>
      </div>
      <button class="btn btn-small ${mic.buttonClass}" data-setup-mic>${mic.button}</button>
      <div class="spacer"></div>
      <div class="buttons"><button class="btn btn-aqua" data-play>Play tonight</button></div>
      <div class="home-tiles">
        <button class="home-tile" data-peek><span class="tile-icon">🎁</span><b>Peek at prizes</b></button>
        <button class="home-tile" data-sets><span class="tile-icon">⭐</span><b>Sets</b></button>
        <button class="home-tile" data-cabinet><span class="tile-icon">🗄️</span><b>My cabinet</b></button>
        <button class="home-tile" data-avatar><span class="tile-icon">🎨</span><b>My avatar</b></button>
        <button class="home-tile" data-settings><span class="tile-icon">⚙️</span><b>Settings</b></button>
      </div>
    </div>
    <div class="confirm" data-mic-ask hidden>
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="Microphone not set up">
        <div class="mic-orb off ask-orb">${icons.mic(40, 2.2)}</div>
        <h2>You haven't set up your microphone</h2>
        <p>Set it up to shout BINGO to win, or play by pressing a button to call it.</p>
        <button class="btn btn-aqua" data-ask-setup>Set up microphone</button>
        <button class="btn btn-white" data-ask-press>Just press to call bingo</button>
      </div>
    </div>
  </main>`);
  const callerEl = el.querySelector('[data-start-caller]');
  attachCaller(callerEl, { voice, mood: 'happy', lively: true });
  startCallerTalk(el, callerEl, { voice, config, callerLines });

  // Microphone: the card and its button both open the setup (or the recalibration).
  el.querySelector('[data-mic-card]').addEventListener('click', () => onSetupMic(false));
  el.querySelector('[data-setup-mic]').addEventListener('click', () => onSetupMic(false));

  // Play: with no microphone setup yet the game asks what to do instead of just starting.
  const askBox = el.querySelector('[data-mic-ask]');
  el.querySelector('[data-play]').addEventListener('click', () => {
    if (status === 'none') askBox.hidden = false;
    else onPlay();
  });
  askBox.addEventListener('click', (event) => { if (event.target === askBox) askBox.hidden = true; });
  el.querySelector('[data-ask-setup]').addEventListener('click', () => onSetupMic(true));
  el.querySelector('[data-ask-press]').addEventListener('click', onChoosePressToCall);

  // Who is playing, and where to go from here.
  const meFace = mountFace(el.querySelector('[data-me-face]'), player.look, { size: 54 });
  el.querySelector('[data-me]').addEventListener('click', onSwitchPlayer);
  el.querySelector('[data-peek]').addEventListener('click', onPeek);
  el.querySelector('[data-sets]').addEventListener('click', onSets);
  el.querySelector('[data-cabinet]').addEventListener('click', onCabinet);
  el.querySelector('[data-avatar]').addEventListener('click', onAvatar);
  el.querySelector('[data-settings]').addEventListener('click', onSettings);
  return { el, update() {}, destroy: () => meFace.destroy() };
}

// ---------- The row of recent calls ----------

const SLOT_STEP = 39; // keep in step with --chip-step in style.css

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The number lifts out of the ball and shrinks as it flicks into the new pill.
function flyNumber(fromEl, toEl, text) {
  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const flyer = document.createElement('div');
  flyer.className = 'flyer';
  flyer.textContent = text;
  flyer.style.left = `${to.left + to.width / 2}px`;
  flyer.style.top = `${to.top + to.height / 2}px`;
  document.body.appendChild(flyer);
  const small = 12 / 34;
  const animation = flyer.animate(
    [
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(1)`, color: '#ffffff' },
      { transform: `translate(-50%, -50%) translate(0, 0) scale(${small})`, color: '#2b1b6b' },
    ],
    { duration: 520, easing: 'cubic-bezier(0.35, 0.9, 0.4, 1)', fill: 'forwards' },
  );
  animation.onfinish = () => flyer.remove();
  animation.oncancel = () => flyer.remove();
}

// Four fixed slots, newest on the left. A new pill lands in the left slot, the others slide
// right, and the one on the right zips off the screen.
function recentPills(game, container, ballEl) {
  const pills = new Map(); // number -> element
  let ready = false;

  return function sync() {
    const wanted = game.recentCalls; // newest first
    const animate = ready && !prefersReducedMotion();

    // Pills that have dropped out of the last four zip off to the right.
    for (const [number, pill] of pills) {
      if (wanted.includes(number)) continue;
      pills.delete(number);
      if (animate) {
        pill.classList.add('leaving');
        setTimeout(() => pill.remove(), 500);
      } else {
        pill.remove();
      }
    }

    wanted.forEach((number, slot) => {
      let pill = pills.get(number);
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'chip';
        pill.textContent = `${game.letterOf(number)} ${number}`;
        pill.style.setProperty('--slot', slot);
        pill.__slot = slot;
        if (animate) pill.classList.add('arrive');
        container.appendChild(pill);
        pills.set(number, pill);
        if (animate) {
          void pill.offsetWidth;
          pill.classList.add('go');
          flyNumber(ballEl, pill, `${game.letterOf(number)} ${number}`);
          setTimeout(() => pill.classList.remove('arrive', 'go'), 900);
        }
      } else if (pill.__slot !== slot) {
        pill.__slot = slot;
        pill.style.setProperty('--slot', slot);
      }
    });
    ready = true;
  };
}

// ---------- Play ----------

export function playScreen(game, { voice, mic, settings }) {
  const letters = columnLetters(game.config).map((l) => `<div>${l}</div>`).join('');
  const cardMarkup = (cardIndex) => `<div class="card" data-card="${cardIndex}">${game.cards[cardIndex].grid
    .map((row, r) => row.map((n, c) => (n === 0
      ? `<div class="sq free">FREE</div>`
      : `<button class="sq" data-r="${r}" data-c="${c}" aria-pressed="false">${n}</button>`)).join('')).join('')}</div>`;

  const el = html(`<main class="screen">
    <div class="play">
      <div class="play-top">
        ${ballMarkup()}
        <div class="caller-row">
          <div class="caller-btn"><div class="caller-small" data-caller></div></div>
          <div class="speech"></div>
        </div>
        <button class="pause-btn" data-pause aria-label="Pause game">${icons.pause()}</button>
      </div>
      <div class="target-row">
        <div class="target-pill">${patternPreview(game.pattern)}<span data-target></span></div>
        <div class="recent" data-recent></div>
      </div>
      <div class="letters">${letters}</div>
      ${game.cards.map((_, i) => cardMarkup(i)).join('')}
      <div class="toast" data-toast hidden></div>
      <div class="play-bottom">
        ${game.bots.length ? `<div class="table-pill" data-table>${game.bots.map((b) => `<div class="seat" data-seat="${b.id}"><span class="seat-face"></span><b>${esc(b.name)}</b><span class="togo"></span></div>`).join('')}</div>` : ''}
        <div class="call-row">
          <span class="you-face" data-you></span>
          <button class="btn btn-aqua call-bingo" data-call>${icons.mic()}Call bingo!</button>
          <div class="sit-banner" data-sit hidden>
            <div class="top"><span>Sitting out</span><span class="dots" data-dots></span></div>
            <div class="why" data-why></div>
          </div>
        </div>
      </div>
    </div>
  </main>`);

  const ballWrap = el.querySelector('.ball-wrap');
  ballWrap.classList.add('tappable');
  ballWrap.setAttribute('role', 'button');
  ballWrap.setAttribute('aria-label', 'Next number');
  ballWrap.addEventListener('click', () => game.skipCall());
  // Up to three rows in the header bubble, four in the smaller type used for the welcome.
  const bubble = callerBubble(game, el, { voice, maxLines: () => (el.classList.contains('intro') ? 4 : 3) });
  const cardEls = [...el.querySelectorAll('.card')];
  const targetEl = el.querySelector('[data-target]');
  const recentEl = el.querySelector('[data-recent]');
  const toastEl = el.querySelector('[data-toast]');
  const callButton = el.querySelector('[data-call]');
  const sitEl = el.querySelector('[data-sit]');
  const dotsEl = el.querySelector('[data-dots]');
  const whyEl = el.querySelector('[data-why]');
  const squares = [...el.querySelectorAll('button.sq')];

  el.addEventListener('click', (event) => {
    const square = event.target.closest('button.sq');
    if (square) {
      const card = Number(square.closest('.card').dataset.card);
      game.tapSquare(card, Number(square.dataset.r), Number(square.dataset.c));
    }
  });
  callButton.addEventListener('click', () => {
    if (!game.canClaim) return;
    // The microphone has to be asked for inside the tap, or the phone will not allow it.
    if (!settings.get('holdToCallMode') && !mic.blocked) mic.start();
    game.openShout();
  });
  const pauseButton = el.querySelector('[data-pause]');
  pauseButton.addEventListener('click', () => game.pauseByPlayer());

  targetEl.textContent = `Stage ${game.stageIndex + 1} of ${game.stages.length}: ${game.pattern.name.toLowerCase()}`;
  const dotCount = game.config.falseCall.sitOutCalls;
  dotsEl.innerHTML = '<i></i>'.repeat(dotCount);

  const states = new Map();
  const syncRecent = recentPills(game, recentEl, ballWrap.querySelector('.ball'));
  let lastLocked = 0;

  // Before the first number the caller is big at the top. When the first number drops he shrinks back
  // to his usual place, and the ball and the caller glide there instead of jumping.
  const callerButton = el.querySelector('.caller-btn');
  const speechEl = el.querySelector('.speech');
  let inIntro = game.phase === 'intro';
  el.classList.toggle('intro', inIntro);

  function leaveIntro() {
    inIntro = false;
    const glide = [ballWrap, callerButton];
    const first = glide.map((node) => node.getBoundingClientRect());
    el.classList.remove('intro');
    if (prefersReducedMotion()) return;
    glide.forEach((node, i) => {
      const from = first[i];
      const to = node.getBoundingClientRect();
      node.animate(
        [
          { transformOrigin: 'top left', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
          { transformOrigin: 'top left', transform: 'none' },
        ],
        { duration: 500, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' },
      );
    });
    speechEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }

  // The regulars: a face that shows their mood, and how many squares they still need. A magenta tag marks
  // anyone who is one away.
  const seatEls = new Map(game.bots.map((b) => [b.id, el.querySelector(`[data-seat="${b.id}"]`)]));
  const seatShown = new Map();
  const seatFaces = new Map(game.bots.map((b) => [b.id, mountFace(seatEls.get(b.id).querySelector('.seat-face'), b, { size: 46 })]));
  function syncTable() {
    for (const b of game.bots) {
      const seat = seatEls.get(b.id);
      const mood = game.botMood(b);
      const toGo = game.botToGo(b);
      const needs = toGo === 1 ? game.botNeeds(b) : [];
      const shouting = b.claim?.kind === 'bingo';
      const key = `${mood}|${toGo}|${needs.join(',')}|${shouting}`;
      if (seatShown.get(b.id) === key) continue;
      seatShown.set(b.id, key);
      seatFaces.get(b.id).setMood(mood);
      seat.classList.toggle('shouting', shouting);
      const tag = seat.querySelector('.togo');
      // Two or more away: "3 to go". One away: the numbers that would finish it, in magenta.
      if (toGo === 1 && needs.length) {
        const shown = needs.slice(0, 3).map((n) => `<i>${n}</i>`).join('');
        tag.innerHTML = shown + (needs.length > 3 ? `<i class="more">+${needs.length - 3}</i>` : '');
        tag.className = 'togo need';
      } else {
        tag.textContent = toGo === 0 ? 'Bingo!' : `${toGo} to go`;
        tag.className = `togo${toGo === 1 ? ' one' : ''}`;
      }
    }
  }

  const youFace = mountPlayer(el.querySelector('[data-you]'), settings, { size: 64 });
  let youMood = 'content';

  function update(_game, now) {
    if (game.bots.length) syncTable();
    const mood = playingMood(game);
    if (mood !== youMood) {
      youMood = mood;
      youFace.setMood(mood);
    }
    if (inIntro && game.phase !== 'intro') leaveIntro();
    callButton.disabled = game.phase === 'intro'; // nothing to call before the first number
    updateBall(ballWrap, game);
    bubble.sync(now);
    pauseButton.disabled = !game.canPause;
    setClass(pauseButton, 'used', game.pausesLeft === 0); // only when a pause limit is set

    syncRecent();
    const notice = game.notice;
    toastEl.hidden = !notice;
    if (notice) setText(toastEl, notice.text);

    const justLocked = game.marks.length !== lastLocked;
    lastLocked = game.marks.length;
    for (const square of squares) {
      const card = Number(square.closest('.card').dataset.card);
      const row = Number(square.dataset.r);
      const col = Number(square.dataset.c);
      const state = game.squareState(card, row, col);
      const before = states.get(square);
      if (state !== before) {
        states.set(square, state);
        square.classList.toggle('locked', state === 'locked');
        square.classList.toggle('pending', state === 'pending');
        square.setAttribute('aria-pressed', String(state !== 'empty'));
        const number = game.cards[card].grid[row][col];
        square.setAttribute('aria-label', state === 'pending' ? `${number}, placed this call, tap to take it back` : String(number));
        if (before !== undefined && state === 'pending') {
          square.classList.remove('just-marked');
          void square.offsetWidth;
          square.classList.add('just-marked');
        }
        if (before === 'pending' && state === 'locked' && justLocked) {
          square.classList.remove('just-locked');
          void square.offsetWidth;
          square.classList.add('just-locked');
        }
      }
    }

    const out = game.sittingOut;
    for (const card of cardEls) setClass(card, 'faded', out);
    callButton.hidden = out;
    sitEl.hidden = !out;
    if (out) {
      [...dotsEl.children].forEach((dot, i) => setClass(dot, 'on', i < game.sitOut));
      setText(whyEl, game.falseCall?.short ?? '');
    }
  }
  return { el, update, destroy: () => { seatFaces.forEach((face) => face.destroy()); youFace.destroy(); } };
}

// ---------- Checking (the whole check, including a failed one, is on this one screen) ----------

function discRow(items, root) {
  root.classList.toggle('many', items.length > 6);
  root.hidden = items.length === 0;
  root.innerHTML = items
    .map((item, i) => `<div class="disc" data-n="${item.number}" style="--i:${i}">${item.number}</div>`)
    .join('');
}

function paintDiscs(root, order, revealed, currentIndex) {
  const statusOf = new Map();
  (order ?? []).forEach((item, i) => {
    if (revealed[i]) statusOf.set(item.number, revealed[i]);
    else if (i === currentIndex) statusOf.set(item.number, 'current');
  });
  for (const disc of root.children) {
    const status = statusOf.get(Number(disc.dataset.n)) ?? 'waiting';
    if (disc.__status === status) continue;
    disc.__status = status;
    disc.className = `disc ${status === 'waiting' ? '' : status}`;
    disc.querySelector('.tick-badge, .cross-badge')?.remove();
    if (status === 'ok') disc.insertAdjacentHTML('beforeend', `<div class="tick-badge">${icons.tick()}</div>`);
    if (status === 'bad') disc.insertAdjacentHTML('beforeend', `<div class="cross-badge">${icons.cross()}</div>`);
  }
}

export function checkingScreen(game, { voice, settings }) {
  const dotCount = game.config.falseCall.sitOutCalls;
  const el = html(`<main class="screen tense">
    <div class="check-page">
      <div class="check-head">
        <div class="check-head-text">
          <div class="pill-label">The caller has your card</div>
          <h1>Checking</h1>
        </div>
        <span class="you-face check-you" data-you></span>
      </div>
      <div class="check-body">
        <div class="discs"></div>
        <div class="caller-big">
          <div class="caller-img" data-caller></div>
          <div class="speech"></div>
        </div>
        <div class="live-ball-card waiting" data-live>
          ${ballMarkup()}
          <div>
            <div class="title">The next number is already out</div>
            <div class="sub"><span class="dots" data-dots>${'<i></i>'.repeat(dotCount)}</span><span data-sit></span></div>
          </div>
        </div>
      </div>
      <div class="check-foot">
        <p class="foot-note" data-note>The game is paused while your card is checked.</p>
        <button class="btn btn-aqua back-cards" data-back hidden>Back to my cards</button>
      </div>
    </div>
  </main>`);
  const discs = el.querySelector('.discs');
  discRow(game.checking.evaluation.items, discs);
  const bubble = callerBubble(game, el, { voice, maxLines: () => 3 });
  const youFace = mountPlayer(el.querySelector('[data-you]'), settings, { size: 96 });
  let youMood = 'content';
  const live = el.querySelector('[data-live]');
  const note = el.querySelector('[data-note]');
  const back = el.querySelector('[data-back]');
  const ballWrap = el.querySelector('.ball-wrap');
  const dots = [...el.querySelectorAll('[data-dots] i')];
  const sitText = el.querySelector('[data-sit]');
  back.addEventListener('click', () => game.backToCards());

  function update(_game, now) {
    const c = game.checking;
    const mood = checkingMood(game);
    if (mood !== youMood) {
      youMood = mood;
      youFace.setMood(mood);
    }
    if (c) {
      paintDiscs(discs, c.evaluation.order, c.revealed, c.stage === 'waiting' ? c.index : -1);
      setClass(discs, 'final', game.isFinalReveal);
      const failed = c.stage === 'failed';
      // Once the caller has finished, the next number starts and appears underneath.
      const restarted = game.restartedAfterFalseCall;
      // The card's space is kept from the start (it is only invisible), so nothing moves when it arrives.
      if (restarted && live.classList.contains('waiting')) {
        live.classList.remove('waiting');
        live.classList.add('arrived');
      }
      back.hidden = !restarted;
      note.hidden = failed;
      if (restarted) {
        updateBall(ballWrap, game);
        dots.forEach((dot, i) => setClass(dot, 'on', i < game.sitOut));
        setText(sitText, game.sitOut > 0 ? `Sitting out ${game.sitOut} ${game.sitOut === 1 ? 'call' : 'calls'}` : 'Back in the game');
      }
    }
    bubble.sync(now);
  }
  return { el, update, destroy: () => youFace.destroy() };
}

// ---------- Result ----------

export function resultScreen(game, { onAgain, onChange, onPrizes, player }) {
  const result = game.result;
  const won = result.outcome === 'win';
  const drawn = result.outcome === 'drawn';
  const spamming = result.outcome === 'tooManyWrong';
  const lastWinner = result.stages.at(-1)?.winner;
  const winnerBot = game.bots.find((b) => b.id === lastWinner?.id);
  const finalName = result.stages.at(-1)?.pattern.name ?? game.pattern.name;
  const title = spamming ? 'Night over' : won ? (result.stages.length > 1 ? `${finalName}!` : 'BINGO!') : drawn ? 'No winner tonight' : `${esc(lastWinner?.name ?? 'Someone')} called it`;
  const last = result.stages.at(-1);
  const progress = last?.progress;
  const sub = spamming ? 'Too many wrong numbers on your cards.' : won ? '' : drawn
    ? 'All 75 numbers were called, and nobody got there.'
    : progress ? `You were ${progress.total - progress.have} ${progress.total - progress.have === 1 ? 'number' : 'numbers'} from ${esc(last.pattern.spoken)}.` : '';
  const bubbleText = spamming ? game.callerLines.game.tooManyWrong[0] : won ? 'What a night that was!' : drawn ? 'Every ball is out, and nobody got there. Better luck next time!' : 'Better luck next time.';
  const beaten = result.stages.at(-1)?.beat?.[0];
  const beatLine = won && beaten
    ? `<p class="beat-line">${beaten.seconds < 1 ? 'Photo finish! ' : ''}You beat ${esc(beaten.name)} to it, by ${beaten.seconds.toFixed(1)} seconds!</p>` : '';
  const rows = result.stages.map((r) => {
    const you = r.winner.type === 'you';
    const note = you ? 'You won it' : `${esc(r.winner.name)} won it${r.progress ? `. You had ${r.progress.have} of ${r.progress.total}` : ''}`;
    return `<div class="result-row"><span class="result-pic">${patternPreview(r.pattern, 40, '#e4dbff')}</span><span class="result-text"><b>${esc(r.pattern.name)}</b><small>${note}</small></span><b class="result-num">${r.credits}</b></div>`;
  }).join('');
  const lines = spamming ? `<div class="stage-rows result-card"><div class="stage-row total"><span>Credits won tonight</span><span class="who"></span><b>${icons.gem(18)} 0</b></div></div>` : `<div class="stage-rows result-card">${rows}
        ${result.forPlaying ? `<div class="stage-row"><span>For playing</span><span class="who"></span><b>${result.forPlaying}</b></div>` : ''}
        <div class="stage-row"><span>${esc(game.speed.name)} speed</span><span class="who"></span><b>× ${result.multiplier}</b></div>
        ${result.falseCalls ? `<div class="stage-row minus"><span>${result.falseCalls} false ${result.falseCalls === 1 ? 'call' : 'calls'}</span><span class="who"></span><b>less ${result.falseCalls === 1 ? 'a quarter' : `${Math.round(result.penalty * 100)}%`}</b></div>` : ''}
        <div class="stage-row total"><span>Credits won tonight</span><span class="who"></span><b>${icons.gem(18)} ${result.total}</b></div>
      </div>`;
  const regs = game.bots.map((b) => `<div class="reg-pill"><span class="reg-face" data-reg="${b.id}"></span><span><b>${esc(b.name)}</b><small>earned ${result.regularEarnings[b.id] ?? 0}</small></span></div>`).join('');
  const el = html(`<main class="screen">
    <div class="result night-result">
      <div class="caller-big">
        <div class="caller-img" data-result-caller></div>
        <div class="speech"><span>${bubbleText}</span></div>
      </div>
      <h1>${title}</h1>
      ${sub ? `<p class="tagline">${sub}</p>` : ''}
      ${beatLine}
      ${lines}
      <div class="reg-pills">${regs}</div>
      <p class="total-line">You now have ${icons.gem(16)} <b>${player?.credits ?? result.total}</b></p>
      <div class="spacer"></div>
      <div class="buttons">
        ${spamming ? '' : '<button class="btn btn-aqua" data-prizes>To the prize table</button>'}
        <button class="btn ${spamming ? 'btn-aqua' : 'btn-ghost'}" ${spamming ? '' : 'style="align-self:center"'} data-again>Play another night</button>
        ${spamming ? '<button class="btn btn-ghost" style="align-self:center" data-change>Back to home</button>' : ''}
      </div>
    </div>
  </main>`);
  const regFaces = game.bots.map((b) => mountFace(el.querySelector(`[data-reg="${b.id}"]`), b, { size: 40, mood: lastWinner?.id === b.id ? 'cheer' : won ? 'sulky' : 'content' }));
  el.querySelector('[data-again]').addEventListener('click', onAgain);
  el.querySelector('[data-prizes]')?.addEventListener('click', onPrizes);
  el.querySelector('[data-change]')?.addEventListener('click', onChange);
  if (won) confetti(el);
  attachCaller(el.querySelector('[data-result-caller]'), { mood: won ? 'cheer' : 'smile', jump: won });
  return { el, update() {}, destroy: () => regFaces.forEach((f) => f.destroy()) };
}
