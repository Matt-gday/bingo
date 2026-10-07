import { esc, html, setText, setClass, setRing, updateBall, ballMarkup, icons, callerImages, patternPreview, confetti } from './helpers.js';
import { columnLetters } from '../engine/cards.js';

// Each screen function returns { el, update(game, now) }. update runs every frame
// and only changes the page when something really changed.

function callerBubble(game, el) {
  return {
    img: el.querySelector('[data-caller]'),
    text: el.querySelector('[data-bubble]'),
    sync() {
      const src = callerImages[game.bubble.mood] ?? callerImages.talking;
      if (this.img.__src !== src) {
        this.img.__src = src;
        this.img.src = src;
      }
      setText(this.text, game.bubble.text);
    },
  };
}

// ---------- Start ----------

export function startScreen({ config, chosenSpeed, onPlay, onChoose }) {
  const speeds = config.speeds
    .map((s) => `<button class="speed${s.id === chosenSpeed ? ' chosen' : ''}" data-speed="${s.id}">
        <span>${esc(s.name)}</span><small>${s.secondsPerCall} seconds a call · ${s.creditMultiplier}x credits</small>
      </button>`)
    .join('');
  const el = html(`<main class="screen">
    <div class="start">
      <img class="start-caller" src="${callerImages.smile}" alt="">
      <h1>${esc(config.gameName)}</h1>
      <p class="tagline">Eyes down! Mark your own cards and call bingo when you think you have a line.</p>
      <div class="speeds">${speeds}</div>
      <div class="spacer"></div>
      <div class="buttons"><button class="btn btn-aqua" data-play>Play</button></div>
    </div>
  </main>`);
  el.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      el.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('chosen', b === button));
      onChoose(button.dataset.speed);
    });
  });
  el.querySelector('[data-play]').addEventListener('click', onPlay);
  return { el, update() {} };
}

// ---------- Play ----------

export function playScreen(game) {
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
          <img class="caller-small" data-caller alt="">
          <div class="speech"><span data-bubble></span></div>
        </div>
      </div>
      <div class="target-row">
        <div class="target-pill">${patternPreview(game.pattern)}<span data-target></span></div>
        <div class="recent" data-recent></div>
      </div>
      <div class="letters">${letters}</div>
      ${game.cards.map((_, i) => cardMarkup(i)).join('')}
      <div class="play-bottom">
        <button class="btn btn-aqua call-bingo" data-call>${icons.mic()}Call bingo!</button>
        <div class="sit-banner" data-sit hidden>
          <div class="top"><span>Sitting out</span><span class="dots" data-dots></span></div>
          <div class="why" data-why></div>
        </div>
      </div>
    </div>
  </main>`);

  const ballWrap = el.querySelector('.ball-wrap');
  const bubble = callerBubble(game, el);
  const cardEls = [...el.querySelectorAll('.card')];
  const targetEl = el.querySelector('[data-target]');
  const recentEl = el.querySelector('[data-recent]');
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
  callButton.addEventListener('click', () => game.openShout());

  targetEl.textContent = `Stage ${game.stageIndex + 1} of ${game.stages.length}: ${game.pattern.name.toLowerCase()}`;
  const dotCount = game.config.falseCall.sitOutCalls;
  dotsEl.innerHTML = '<i></i>'.repeat(dotCount);

  const states = new Map();
  let lastRecent = '';
  let lastLocked = 0;

  function update() {
    updateBall(ballWrap, game);
    bubble.sync();

    const recent = game.recentCalls.map((n) => `${game.letterOf(n)} ${n}`);
    const recentKey = recent.join('|');
    if (recentKey !== lastRecent) {
      lastRecent = recentKey;
      recentEl.innerHTML = recent.map((r) => `<div class="chip">${r}</div>`).join('');
    }

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
  return { el, update };
}

// ---------- Shout (hold to call) ----------

export function shoutScreen(game) {
  const R = 108;
  const length = 2 * Math.PI * R;
  const holdMs = game.config.shout.holdToCallSeconds * 1000;
  const el = html(`<main class="screen tense">
    <div class="shout">
      <div class="top">
        <div class="badge">Hold to call</div>
        <p class="hint">Call before the next number is called.</p>
      </div>
      <div class="middle">
        <div class="mic-rings">
          <svg viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <circle cx="110" cy="110" r="${R}" stroke="#fff" stroke-opacity="0.18" stroke-width="3"></circle>
            <circle class="shout-ring" cx="110" cy="110" r="${R}" stroke="#fff" stroke-width="5" stroke-linecap="round" transform="rotate(-90 110 110)"></circle>
          </svg>
          <div class="mic-mid"><div class="mic-core">${icons.mic(52, 2)}</div></div>
        </div>
        <h1><span class="small">Call</span><span class="big">BINGO!</span></h1>
      </div>
      <div class="bottom">
        <button class="btn btn-white hold-btn" data-hold><div class="fill"></div><span data-hold-label>Hold to call bingo</span></button>
        <button class="btn btn-ghost" data-back>${icons.back()}Back to my cards</button>
      </div>
    </div>
  </main>`);

  const ring = el.querySelector('.shout-ring');
  const fill = el.querySelector('.fill');
  const label = el.querySelector('[data-hold-label]');
  const holdButton = el.querySelector('[data-hold]');
  let heldSince = null;

  const begin = (now) => {
    if (heldSince === null) heldSince = now ?? performance.now();
  };
  const release = () => {
    heldSince = null;
    fill.style.width = '0';
    setText(label, 'Hold to call bingo');
  };

  holdButton.addEventListener('pointerdown', (event) => {
    holdButton.setPointerCapture?.(event.pointerId);
    begin();
  });
  holdButton.addEventListener('pointerup', release);
  holdButton.addEventListener('pointercancel', release);
  holdButton.addEventListener('contextmenu', (event) => event.preventDefault());
  holdButton.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) begin();
  });
  holdButton.addEventListener('keyup', release);
  el.querySelector('[data-back]').addEventListener('click', () => game.closeShout());

  function update(_game, now) {
    setRing(ring, game.callProgress, length);
    if (heldSince !== null) {
      const progress = Math.min(1, (now - heldSince) / holdMs);
      fill.style.width = `${progress * 100}%`;
      setText(label, 'Keep holding...');
      if (progress >= 1) {
        heldSince = null;
        game.submitClaim();
      }
    }
  }
  return { el, update };
}

// ---------- Checking ----------

function discRow(game, root, mode) {
  // mode 'checking' reads game.checking, mode 'falseCall' reads game.falseCall.
  const source = mode === 'checking' ? game.checking.evaluation : game.falseCall;
  const items = source.items;
  root.classList.toggle('many', items.length > 6);
  root.innerHTML = items
    .map((item) => `<div class="disc" data-n="${item.number}">${item.number}</div>`)
    .join('');
}

function paintDiscs(root, order, revealed, currentIndex) {
  const statusOf = new Map();
  order.forEach((item, i) => {
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

export function checkingScreen(game) {
  const el = html(`<main class="screen tense">
    <div style="display:flex;flex-direction:column;gap:32px;flex:1;padding-top:40px">
      <div class="check-head">
        <div class="pill-label">The caller has your card</div>
        <h1>Checking</h1>
      </div>
      <div class="discs"></div>
      <div class="caller-big">
        <img data-caller alt="">
        <div class="speech"><span data-bubble></span></div>
      </div>
      <p class="foot-note">The game is paused while your card is checked.</p>
    </div>
  </main>`);
  const discs = el.querySelector('.discs');
  discRow(game, discs, 'checking');
  const bubble = callerBubble(game, el);
  function update() {
    const c = game.checking;
    if (c) {
      paintDiscs(discs, c.evaluation.order, c.revealed, c.stage === 'waiting' ? c.index : -1);
      setClass(discs, 'final', game.isFinalReveal);
    }
    bubble.sync();
  }
  return { el, update };
}

// ---------- False call ----------

export function falseCallScreen(game) {
  const fc = game.falseCall;
  const dotCount = game.config.falseCall.sitOutCalls;
  const el = html(`<main class="screen tense">
    <div style="display:flex;flex-direction:column;gap:26px;flex:1;padding-top:28px">
      <div class="check-head">
        <div class="pill-label">False call</div>
        <h1 class="small">${esc(fc.headline)}</h1>
      </div>
      <div class="discs"></div>
      <div class="caller-big wince">
        <img src="${callerImages.wince}" alt="">
        <div class="speech"><span>${esc(fc.text)}</span></div>
      </div>
      <div class="live-ball-card">
        ${ballMarkup()}
        <div>
          <div class="title">The next number is already out</div>
          <div class="sub"><span class="dots" data-dots>${'<i></i>'.repeat(dotCount)}</span><span data-sit></span></div>
        </div>
      </div>
      <button class="btn btn-aqua" style="margin-top:auto;height:64px;font-size:24px" data-back>Back to my cards</button>
    </div>
  </main>`);
  const discs = el.querySelector('.discs');
  if (fc.items.length) {
    discRow({ falseCall: fc }, discs, 'falseCall');
    const revealed = fc.order.map((item) => (item.problem ? 'bad' : 'ok'));
    paintDiscs(discs, fc.order, revealed, -1);
  }
  const ballWrap = el.querySelector('.ball-wrap');
  const dots = [...el.querySelectorAll('[data-dots] i')];
  const sitText = el.querySelector('[data-sit]');
  el.querySelector('[data-back]').addEventListener('click', () => game.backToCards());
  function update() {
    updateBall(ballWrap, game);
    dots.forEach((dot, i) => setClass(dot, 'on', i < game.sitOut));
    setText(sitText, game.sitOut > 0 ? `Sitting out ${game.sitOut} ${game.sitOut === 1 ? 'call' : 'calls'}` : 'Back in the game');
  }
  return { el, update };
}

// ---------- Result ----------

export function resultScreen(game, { onAgain, onChange }) {
  const won = game.result.outcome === 'win';
  const el = html(`<main class="screen">
    <div class="result">
      <img class="caller-hero" src="${won ? callerImages.cheer : callerImages.smile}" alt="">
      <h1>${won ? 'BINGO!' : 'No winner tonight'}</h1>
      <p class="tagline">${won
        ? `You won with ${esc(game.pattern.spoken)}.`
        : 'All 75 numbers were called, and nobody got there.'}</p>
      <div class="stats">
        <div class="stat"><b>${game.called.length}</b>numbers called</div>
        <div class="stat"><b>${game.falseCalls}</b>false ${game.falseCalls === 1 ? 'call' : 'calls'}</div>
      </div>
      <div class="spacer"></div>
      <div class="buttons">
        <button class="btn btn-aqua" data-again>Play again</button>
        <button class="btn btn-ghost" style="align-self:center" data-change>Change speed</button>
      </div>
    </div>
  </main>`);
  el.querySelector('[data-again]').addEventListener('click', onAgain);
  el.querySelector('[data-change]').addEventListener('click', onChange);
  if (won) confetti(el);
  return { el, update() {} };
}
