import { esc, html, setText, icons, patternPreview, confetti } from './helpers.js';
import { YOU_COLOUR } from './faces.js';
import { mountFace } from './characterView.js';
import { defaultLook } from './caller3d/avatar.js';
import { callerBubble } from './screens.js';

// "Tonight's game" (choose the length of the night and the speed, see who is at the table)
// and the "Stage won" screen between stages.

// ---------- Tonight's game ----------

export function tonightScreen({ config, patterns, table, chosenNight, chosenSpeed, onChooseNight, onChooseSpeed, onDeal, onBack }) {
  const patternById = (id) => patterns.patterns.find((p) => p.id === id);
  const nights = config.nights
    .map((night) => `<button class="night${night.id === chosenNight ? ' chosen' : ''}" data-night="${night.id}">
        <span class="night-text"><b>${esc(night.name)}</b><small>${esc(night.sub)}</small></span>
        <span class="night-pics">${night.stageIds.map((id) => patternPreview(patternById(id), 34, '#e4dbff')).join('')}</span>
      </button>`)
    .join('');
  const seatList = [{ name: 'You', colour: YOU_COLOUR, look: defaultLook('player') }, ...table];
  const seats = seatList
    .map((s, i) => `<div class="seat"><span class="seat-face" data-seat-face="${i}"></span><span>${esc(s.name)}</span></div>`)
    .join('');
  const speeds = config.speeds
    .map((s) => `<button class="tspeed${s.id === chosenSpeed ? ' chosen' : ''}" data-speed="${s.id}">
        <b>${esc(s.name)}</b><small>${s.creditMultiplier === 1 ? 'Normal credits' : `${s.creditMultiplier} x credits`}</small>
      </button>`)
    .join('');

  const el = html(`<main class="screen">
    <div class="tonight">
      <div class="tonight-head">
        <button class="back-btn" data-back aria-label="Back">${icons.back()}</button>
        <h1>Tonight's game</h1>
      </div>
      <h2>How long tonight?</h2>
      <div class="nights">${nights}</div>
      <h2>At the table tonight</h2>
      <div class="seats">${seats}</div>
      <h2>Calling speed</h2>
      <div class="tspeeds">${speeds}</div>
      <div class="spacer"></div>
      <button class="btn btn-aqua" data-deal>Deal my cards</button>
    </div>
  </main>`);

  const seatViews = seatList.map((who, i) => mountFace(el.querySelector(`[data-seat-face="${i}"]`), who, { size: 56 }));
  el.querySelectorAll('[data-night]').forEach((button) => {
    button.addEventListener('click', () => {
      el.querySelectorAll('[data-night]').forEach((b) => b.classList.toggle('chosen', b === button));
      onChooseNight(button.dataset.night);
    });
  });
  el.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      el.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('chosen', b === button));
      onChooseSpeed(button.dataset.speed);
    });
  });
  el.querySelector('[data-back]').addEventListener('click', onBack);
  el.querySelector('[data-deal]').addEventListener('click', onDeal);
  return { el, update() {}, destroy: () => seatViews.forEach((v) => v.destroy()) };
}

// ---------- Stage won ----------

export function stageWonScreen(game, { voice }) {
  const won = game.stageWon;
  const you = won.winner.type === 'you';
  const total = game.stages.length;
  const stageNumber = game.stageIndex + 1;
  const bot = game.bots.find((b) => b.id === won.winner.id);
  const numbers = (game.stageResults.at(-1)?.numbers ?? []).map((n) => `<div class="win-ball">${n}${icons.tick(14)}</div>`).join('');
  const faces = game.bots.map((b) => `<div class="seat" data-seat="${b.id}"><span class="seat-face"></span><span>${esc(b.name)}</span></div>`).join('');

  const el = html(`<main class="screen">
    <div class="stagewon">
      <div class="caller-big">
        <div class="caller-img" data-caller></div>
        <div class="speech"></div>
      </div>
      ${you
        ? `<h1 class="bingo-word">Bingo!</h1><div class="win-balls">${numbers}</div>`
        : `<div class="bot-win"><span class="big-face" data-big-face></span><h1>${esc(won.winner.name)} got it!</h1></div>`}
      <div class="stage-pills">
        <span class="pill-dark">${you ? `Stage ${stageNumber} of ${total} won` : `${esc(won.winner.name)} won stage ${stageNumber} of ${total}`}</span>
        <span class="pill-light">${icons.gem?.(16) ?? ''}${you
          ? `${won.credits} banked`
          : won.credits > 0 ? `+${won.credits} for getting close` : 'No credits this time'}</span>
      </div>
      ${(() => {
        const beaten = you ? game.stageResults.at(-1)?.beat?.[0] : null;
        return beaten ? `<p class="beat-line">${beaten.seconds < 1 ? 'Photo finish! ' : ''}You beat ${esc(beaten.name)} to it, by ${beaten.seconds.toFixed(1)} seconds!</p>` : '';
      })()}
      <div class="seats table-seats">${faces}</div>
      <div class="spacer"></div>
      <div class="next-card">
        <div class="next-label">Next up, on the same cards</div>
        <div class="next-row">
          <div class="next-pic">${patternPreview(won.next, 64, '#e4dbff')}</div>
          <div class="next-text"><b>${esc(won.next.name)}</b><span>${esc(won.next.instruction)}</span></div>
          <div class="next-ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="track"/><circle cx="22" cy="22" r="18" class="arc" data-arc/></svg><b data-count></b></div>
        </div>
      </div>
      <p class="foot-note">Your marks stay where they are. The caller carries on when the ring runs out.</p>
    </div>
  </main>`);

  const bubble = callerBubble(game, el, { voice, maxLines: () => 3 });
  if (you) confetti(el);
  const bigFace = !you && bot ? mountFace(el.querySelector('[data-big-face]'), bot, { size: 120, mood: 'cheer' }) : null;
  const arc = el.querySelector('[data-arc]');
  const count = el.querySelector('[data-count]');
  const circumference = 2 * Math.PI * 18;
  arc.style.strokeDasharray = `${circumference}`;
  const seatEls = new Map(game.bots.map((b) => [b.id, mountFace(el.querySelector(`[data-seat="${b.id}"] .seat-face`), b, { size: 52 })]));
  const shownMood = new Map();

  function update(_game, now) {
    bubble.sync(now);
    const left = game.stageWon?.msLeft ?? 0;
    const total = game.stageWon?.totalMs ?? 1;
    arc.style.strokeDashoffset = `${circumference * (1 - Math.max(0, left) / total)}`;
    setText(count, Math.max(1, Math.ceil(left / 1000)));
    for (const b of game.bots) {
      const mood = game.botMood(b);
      if (shownMood.get(b.id) !== mood) {
        shownMood.set(b.id, mood);
        seatEls.get(b.id).setMood(mood);
      }
    }
  }
  return { el, update, destroy: () => { bigFace?.destroy(); seatEls.forEach((face) => face.destroy()); } };
}
