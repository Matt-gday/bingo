import { esc, html, icons } from './helpers.js';
import { attachCaller } from './callerStage.js';
import { mountFace } from './characterView.js';
import { showPrizeArt, badgeHtml } from './prizeArt.js';
import { data, cabinetOf, whoIsAhead, regulars, owners, regularLook } from '../prizeWorld.js';

// The calm screens of the prize round: who wants what, a cabinet (the player's or a regular's), and the sets.

const pct = (ratio) => `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;

// ---------- Who wants what ----------

export function whoWantsWhatScreen({ profile, tableRegulars, callerLines, voice, onOpenTable, onCabinet, onBack }) {
  const list = owners(profile, tableRegulars);
  const opening = callerLines.prizeTable.opening[0];
  const cards = list.map((o) => {
    const set = o.closest ? data.setById.get(o.closest.setId) : null;
    const line = set
      ? `${esc(set.name)} set, ${o.closest.have} of ${o.closest.target}`
      : o.you ? 'No set started yet. Any prize you buy starts one.'
        : o.regular?.collects?.length ? `Not started a set yet. Likes ${o.regular.collects.slice(0, 2).map((c) => data.setById.get(c)?.name ?? c).join(' and ')}.`
          : 'No set. Buys whatever takes their fancy.';
    return `<button class="who-card${o.you ? ' you' : ''}" data-owner="${o.id}">
        <span class="who-face" data-face="${o.id}"></span>
        <span class="who-text">
          <span class="who-top"><b>${esc(o.name)}</b><span class="who-credits">${icons.gem(18)} ${o.credits}</span></span>
          <small>${line}</small>
          ${set ? `<span class="bar"><i style="width:${pct(o.closest.ratio)}"></i></span>` : ''}
        </span>
        <span class="chev">›</span>
      </button>`;
  }).join('');
  const el = html(`<main class="screen">
    <div class="who">
      <div class="caller-big">
        <div class="caller-img" data-caller></div>
        <div class="speech"><span>${esc(opening)}</span></div>
      </div>
      <p class="who-hint">Tap anyone to see everything they have and want.</p>
      ${cards}
      <div class="spacer"></div>
      <button class="btn btn-aqua" data-open>Open the prize table</button>
    </div>
  </main>`);
  attachCaller(el.querySelector('[data-caller]'), { voice, mood: 'happy' });
  const faces = list.map((o) => mountFace(el.querySelector(`[data-face="${o.id}"]`), o.you ? profile.look : o, { size: 54 }));
  el.querySelectorAll('[data-owner]').forEach((b) => b.addEventListener('click', () => onCabinet(b.dataset.owner)));
  el.querySelector('[data-open]').addEventListener('click', onOpenTable);
  const start = setTimeout(() => voice?.speak(opening), 500);
  return { el, update() {}, destroy: () => { clearTimeout(start); voice?.cancel(); faces.forEach((f) => f.destroy()); } };
}

// ---------- A cabinet ----------

export function cabinetScreen({ profile, ownerId, onBack }) {
  const you = ownerId === 'player';
  const regular = regulars.find((r) => r.id === ownerId);
  const cab = cabinetOf(profile, ownerId);
  const name = you ? profile.name : regular.name;
  const credits = you ? profile.credits : profile.regulars[ownerId]?.credits ?? 0;
  const progress = cab.progress.length
    ? cab.progress.map((s) => `<div class="work-row"><span><b>${esc(data.setById.get(s.setId).name)}</b><i>${s.have} of ${s.target}</i></span><span class="bar"><i style="width:${pct(s.ratio)}"></i></span></div>`).join('')
    : `<p class="empty">${you ? 'No set started yet. Buy a prize to begin one.' : 'Not working towards a set yet.'}</p>`;
  const finished = cab.finished.length
    ? cab.finished.map((f) => `<span class="finished-chip">${badgeHtml(f.set, f.badge)}<b>${esc(f.set.name)}</b></span>`).join('')
    : '<p class="empty">None yet.</p>';
  const prizes = cab.prizes.length
    ? cab.prizes.map((p) => `<div class="cab-prize"><span class="prize-pic" data-art="${p.id}"></span><b>${esc(p.name)}</b></div>`).join('')
    : '<p class="empty">Nothing yet.</p>';
  const el = html(`<main class="screen">
    <div class="cabinet">
      <div class="tonight-head">
        <button class="back-btn" data-back aria-label="Back">${icons.back()}</button>
        <h1>${you ? 'My cabinet' : `${esc(name)}'s cabinet`}</h1>
        <div class="credits-pill small">${icons.gem(18)}<b>${credits}</b></div>
      </div>
      <div class="cab-me">
        <span class="who-face big" data-face></span>
        <div><b>${esc(name)}</b><span class="cred-pill">Street cred ${cab.cred}</span></div>
      </div>
      ${regular ? `<p class="shop-style">${esc(regular.shopping?.style ?? '')}</p>` : ''}
      <h2>Working towards</h2>
      <div class="cab-card">${progress}</div>
      <h2>Finished sets</h2>
      <div class="finished-row">${finished}</div>
      <h2>Prizes won</h2>
      <div class="cab-prizes">${prizes}</div>
    </div>
  </main>`);
  const face = mountFace(el.querySelector('[data-face]'), you ? profile.look : { ...regular, look: regularLook(regular, profile.prizes) }, { size: 72 });
  const cleanups = [];
  el.querySelectorAll('[data-art]').forEach((slot) => cleanups.push(showPrizeArt(slot, data.prizes.get(slot.dataset.art))));
  el.querySelector('[data-back]').addEventListener('click', onBack);
  return { el, update() {}, destroy: () => { face.destroy(); cleanups.forEach((c) => c()); } };
}

// ---------- The sets ----------

const TABS = [['thing', 'Things'], ['colour', 'Colours'], ['feel', 'Feels']];

export function setsScreen({ profile, onBack }) {
  const state = profile.prizes;
  let tab = 'thing';
  const el = html(`<main class="screen">
    <div class="sets-page">
      <div class="tonight-head">
        <button class="back-btn" data-back aria-label="Back">${icons.back()}</button>
        <h1>Sets</h1>
      </div>
      <div class="avatar-tabs">${TABS.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="sets-list" data-list></div>
    </div>
  </main>`);
  const listEl = el.querySelector('[data-list]');
  function render() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    listEl.innerHTML = data.sets.filter((s) => s.family === tab).map((s) => {
      const have = (state.owned.player ?? []).map((id) => data.prizes.get(id)).filter((p) => p?.tags.includes(s.id)).reduce((a, p) => a + p.price, 0);
      const done = have >= s.target;
      const order = state.finishers[s.id] ?? [];
      const badge = done ? (order.indexOf('player') === 0 ? 'gold' : 'silver') : null;
      const ahead = have === 0 ? whoIsAhead(profile, s.id) : null;
      return `<div class="set-line">
        ${badgeHtml(s, badge)}
        <span class="set-text"><b>${esc(s.name)}</b>
          <small>${done ? 'Finished!' : have > 0 ? `${have} of ${s.target}` : ahead ? `Not started. ${esc(ahead.name)} is ahead.` : `Not started. ${s.prizeCount} prizes.`}</small>
          <span class="bar"><i style="width:${pct(have / s.target)}"></i></span>
        </span>
      </div>`;
    }).join('');
  }
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  el.querySelector('[data-back]').addEventListener('click', onBack);
  render();
  return { el, update() {} };
}
