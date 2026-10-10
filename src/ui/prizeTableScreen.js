import { esc, html, icons, confetti } from './helpers.js';
import { attachCaller } from './callerStage.js';
import { faceSvg } from './faces.js';
import { popIn } from './speech.js';
import { showPrizeArt, badgeHtml, tintFor } from './prizeArt.js';
import { data, regulars as allRegulars } from '../prizeWorld.js';
import { PrizeRound } from '../engine/prizeRound.js';
import { wouldFinish, setStatus, closestSet, owns, ownedIds } from '../engine/prizes.js';
import { pickOne } from '../engine/rng.js';
import config from '../../Data/config.json';

// The prize table: six prizes on tiles, the regulars shopping beside the player, each regular's countdown ring
// on the prize they are after. Also the prize detail, the "bought it!" celebration, and (peeking only) a view with
// nothing to buy.

const possessive = (regular) => (regular?.pronoun === 'he' ? 'his' : 'her');
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));

function tagLine(prize) {
  const names = prize.tags.map((t) => data.setById.get(t)?.name ?? t);
  return names.length > 2 ? `${names.slice(0, 2).join(' · ')} +${names.length - 2}` : names.join(' · ');
}

export function prizeTableScreen({ profile, tableRegulars, speedId, lookOnly, callerLines, voice, sfx, haptics, profiles, onDone, onBack }) {
  const state = profile.prizes;
  const lines = callerLines.prizeTable;
  const covered = new Set(lookOnly ? state.covered : []); // new arrivals stay covered until the table is opened
  if (!lookOnly) state.covered = [];

  const wallets = Object.fromEntries(tableRegulars.map((r) => [r.id, profile.regulars[r.id]]));
  let dirty = true;
  const round = lookOnly ? null : new PrizeRound({
    config, data, state, regulars: tableRegulars, wallets, playerCredits: profile.credits, speedId,
    onEvent: (type, d) => { dirty = true; handle(type, d); },
  });
  const slotsOf = () => (round ? round.slots : state.table.map((id) => ({ prize: id, sold: null })));
  const credits = () => (round ? round.playerCredits : profile.credits);

  const el = html(`<main class="screen">
    <div class="ptable">
      <div class="pt-head">
        <h1>${lookOnly ? 'Peeking' : 'Prize table'}</h1>
        <div class="credits-pill small">${icons.gem(18)}<b data-credits>${credits()}</b></div>
        <button class="btn-done" data-done>${lookOnly ? 'Back' : '✓ I&#39;m done'}</button>
      </div>
      <div class="pt-caller">
        <div class="caller-small" data-caller></div>
        <div class="speech"><span data-line>${lookOnly ? 'Have a good look. You can only buy when you come back from a night.' : esc(lines.opening[0])}</span></div>
      </div>
      <div class="pt-chips" data-chips></div>
      <div class="pt-grid" data-grid></div>
    </div>
    <div class="confirm" data-overlay hidden></div>
  </main>`);
  const grid = el.querySelector('[data-grid]');
  const chipsEl = el.querySelector('[data-chips]');
  const lineEl = el.querySelector('[data-line]');
  const bubbleEl = lineEl.parentElement;
  const overlay = el.querySelector('[data-overlay]');
  const creditsEl = el.querySelector('[data-credits]');
  attachCaller(el.querySelector('[data-caller]'), { voice, mood: 'happy' });

  // ---------- the caller's running commentary ----------
  let lastSaid = performance.now(); // so the first bit of banter waits a while
  const said = new Set();
  function say(text, { force = false } = {}) {
    const now = performance.now();
    if (!force && now - lastSaid < 3200) return;
    lastSaid = now;
    lineEl.textContent = text;
    popIn(bubbleEl);
    voice?.speak(text, { recordedOnly: true });
  }

  function setNameOf(prize) {
    const tag = prize.tags.find((t) => data.setById.has(t));
    return data.setById.get(tag)?.name ?? 'prize';
  }

  function handle(type, d) {
    if (type === 'eye') {
      const prize = round.prizeAt(d.slot);
      const bot = d.bot;
      if (prize && d.finishes && !said.has(`hint-${bot.id}`)) {
        said.add(`hint-${bot.id}`);
        say(fill(lines.hint[0], { name: bot.name, set: setNameOf(prize) }));
      } else if (prize && !said.has(`watch-${bot.id}`)) {
        said.add(`watch-${bot.id}`);
        say(fill(lines.hint[2], { name: bot.name }));
      }
    } else if (type === 'sold') {
      if (d.buyer === 'player') {
        sfx?.play('mark-pop');
        haptics?.buzz(15);
      } else {
        sfx?.play('claim-whoosh');
        const bot = round.bots.find((b) => b.id === d.buyer);
        say(fill(pickOne([lines.reaction[1], lines.reaction[2]]), { name: bot.name }));
        profiles?.touch();
      }
    } else if (type === 'broken') {
      sfx?.play('too-slow');
      say(fill(lines.reaction[0], { possessive: possessive(d.bot.regular) }), { force: true });
    } else if (type === 'leave') {
      say(fill(pickOne(lines.leaving), { name: d.bot.name }));
    }
  }

  // ---------- drawing the table ----------
  const artCleanups = [];
  function render() {
    dirty = false;
    artCleanups.splice(0).forEach((c) => c());
    // the set chips: the player's three closest sets
    const near = data.sets
      .map((s) => setStatus(data, state, 'player', s.id))
      .filter((s) => s.have > 0 && !s.done)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3);
    chipsEl.innerHTML = near.map((s) => `<div class="pt-chip"><b>${esc(data.setById.get(s.setId).name)}</b><span class="bar"><i style="width:${Math.round(s.ratio * 100)}%"></i></span><small>${s.have} of ${s.target}</small></div>`).join('');

    grid.innerHTML = slotsOf().map((slot, i) => {
      if (slot.sold) {
        const buyer = slot.sold.to === 'player' ? 'you' : round.bots.find((b) => b.id === slot.sold.to)?.name ?? '';
        return `<div class="pt-tile sold"><b>Sold to ${esc(buyer)}!</b><span>A new prize is dropping in</span></div>`;
      }
      const prize = slot.prize ? data.prizes.get(slot.prize) : null;
      if (!prize) return '<div class="pt-tile empty"></div>';
      if (covered.has(prize.id)) return `<div class="pt-tile covered"><span class="mystery">?</span><b>A new prize</b><small>Open the table to see it</small></div>`;
      const price = prize.price;
      const have = owns(state, 'player', prize.id);
      const short = price - credits();
      const finishes = wouldFinish(data, state, 'player', prize.id)[0];
      const rings = round ? round.bots.filter((b) => b.status === 'eyeing' && b.target.slot === i)
        .map((b) => `<span class="ring" data-ring="${b.id}" style="--rc:${b.regular.colour}">${faceSvg(b.regular.colour, 'smug', 30)}</span>`).join('') : '';
      let button;
      if (have) button = '<span class="pt-btn have">You have this</span>';
      else if (lookOnly) button = `<span class="pt-btn price">${icons.gem(18)} ${price}</span>`;
      else if (short > 0) button = `<button class="pt-btn short" data-short="${i}">${price} · ${short} short</button>`;
      else button = `<button class="pt-btn price" data-buy="${i}">${icons.gem(18)} ${price}</button>`;
      return `<div class="pt-tile" data-tile="${i}">
        <div class="rings">${rings}</div>
        <span class="pt-pic" data-pic="${i}" style="--tint:${tintFor(prize)}"></span>
        ${finishes ? `<span class="finish-tag">Finishes ${esc(data.setById.get(finishes).name)}!</span>` : ''}
        ${prize.wearable ? '<span class="wear-tag">👒 Wearable</span>' : ''}
        <b class="pt-name">${esc(prize.name)}</b>
        <small>${esc(tagLine(prize))}</small>
        ${button}
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-pic]').forEach((pic) => {
      const prize = data.prizes.get(slotsOf()[Number(pic.dataset.pic)].prize);
      artCleanups.push(showPrizeArt(pic, prize));
    });
  }

  // ---------- buying ----------
  function buy(slot) {
    const result = round.playerBuy(slot);
    if (!result.ok) return;
    profiles.spend(profile.id, result.prize.price);
    profiles.touch();
    if (result.finished.length) showBought(result);
    else showBought(result);
    // nudge: something else that would finish a set
    const nudgeSlot = round.slots.findIndex((s, i) => round.prizeAt(i) && wouldFinish(data, state, 'player', round.prizeAt(i).id).length && round.canAfford(i));
    if (nudgeSlot >= 0) {
      const p = round.prizeAt(nudgeSlot);
      setTimeout(() => say(fill(lines.nudge[0], { prize: p.name, set: data.setById.get(wouldFinish(data, state, 'player', p.id)[0]).name })), 1800);
    }
  }

  function showBought({ prize, finished }) {
    const beaten = round.bots.filter((b) => b.beatenOn === prize.id);
    sfx?.play('win-fanfare');
    haptics?.buzz([40, 40, 80]);
    const badges = finished.map((f) => `<div class="bought-badge">${badgeHtml(data.setById.get(f.setId), f.badge)}<span><b>${esc(data.setById.get(f.setId).name)} set finished!</b><small>${f.badge === 'gold' ? 'You were first, so it is gold!' : 'A silver badge.'}</small></span></div>`).join('');
    overlay.innerHTML = `<div class="bought-box" role="dialog" aria-modal="true">
        <h2>Got it!</h2>
        <span class="pt-pic big" data-bpic style="--tint:${tintFor(prize)}"></span>
        <p class="bought-name">${esc(prize.name)}</p>
        ${prize.wearable ? '<p class="bought-wear">👒 You can wear this! Find it in My avatar.</p>' : ''}
        ${badges}
        <button class="btn btn-aqua" data-keep>Keep shopping</button>
      </div>`;
    overlay.hidden = false;
    confetti(overlay);
    const cleanup = showPrizeArt(overlay.querySelector('[data-bpic]'), prize);
    overlay.querySelector('[data-keep]').addEventListener('click', () => { overlay.hidden = true; cleanup(); overlay.innerHTML = ''; dirty = true; });
  }

  function showDetail(slot) {
    const prize = round ? round.prizeAt(slot) : data.prizes.get(slotsOf()[slot].prize);
    if (!prize) return;
    const owners = tableRegulars
      .filter((r) => !owns(state, r.id, prize.id) && (profile.regulars[r.id]?.credits ?? 0) >= prize.price)
      .map((r) => ({ r, near: closestSet(data, state, r.id) }))
      .sort((a, b) => (b.near?.ratio ?? 0) - (a.near?.ratio ?? 0));
    const sets = prize.tags.map((t) => data.setById.get(t)).filter(Boolean);
    const mine = sets.map((s) => {
      const st = setStatus(data, state, 'player', s.id);
      return `<div class="detail-set"><b>${esc(s.name)}</b><span>${st.have} of ${st.target}${owns(state, 'player', prize.id) ? '' : ` → ${Math.min(st.target, st.have + prize.price)}`}</span></div>`;
    }).join('');
    overlay.innerHTML = `<div class="bought-box detail" role="dialog" aria-modal="true">
        <span class="pt-pic big" data-dpic style="--tint:${tintFor(prize)}"></span>
        <h2>${esc(prize.name)}</h2>
        <div class="detail-tags">${sets.map((s) => `<i>${esc(s.name)}</i>`).join('')}</div>
        <div class="detail-sets">${mine}</div>
        ${owners.length ? `<p class="detail-want">Also wanted by ${owners.map((o) => `<b>${esc(o.r.name)}</b>`).join(', ')}</p>` : ''}
        <button class="btn btn-aqua" data-close>Close</button>
      </div>`;
    overlay.hidden = false;
    const cleanup = showPrizeArt(overlay.querySelector('[data-dpic]'), prize);
    const close = () => { overlay.hidden = true; cleanup(); overlay.innerHTML = ''; };
    overlay.querySelector('[data-close]').addEventListener('click', close);
  }

  grid.addEventListener('click', (event) => {
    const buyBtn = event.target.closest('[data-buy]');
    if (buyBtn && round) {
      buy(Number(buyBtn.dataset.buy));
      return;
    }
    const tile = event.target.closest('[data-tile]');
    if (tile) showDetail(Number(tile.dataset.tile));
  });
  el.querySelector('[data-done]').addEventListener('click', () => {
    if (lookOnly) return onBack();
    round.done();
    round.fastForward(); // the regulars finish in the background
    const summary = round.summary(); // before the table is tidied for next time
    round.commit();
    summary.arrivals = round.arrivals;
    profiles.touch();
    onDone(summary, state);
  });

  let last = performance.now();
  render();
  function update(_game, now) {
    const dt = Math.min(100, now - last);
    last = now;
    if (round && overlay.hidden) round.advance(dt);
    if (dirty) render();
    for (const ring of grid.querySelectorAll('[data-ring]')) {
      const bot = round.bots.find((b) => b.id === ring.dataset.ring);
      if (!bot?.target) continue;
      const p = Math.min(1, bot.target.elapsed / bot.target.total);
      ring.style.setProperty('--p', p.toFixed(3));
      ring.classList.toggle('late', p > 0.78);
    }
    if (round && overlay.hidden && now - lastSaid > 16000) say(pickOne(lines.banter), { force: true }); // a quiet moment: a bit of banter
    const c = String(credits());
    if (creditsEl.textContent !== c) creditsEl.textContent = c;
  }
  return { el, update, destroy: () => artCleanups.forEach((c) => c()) };
}

// ---------- Table closed ----------

export function tableClosedScreen({ summary, state, profile, callerLines, voice, onAgain, onHome }) {
  const prizeName = (id) => data.prizes.get(id)?.name ?? id;
  const mine = summary.player.length
    ? summary.player.map((l) => `<div class="tc-row"><b>${esc(prizeName(l.prize))}</b><span>${icons.gem(14)} ${l.price}</span></div>`).join('')
    : '<p class="empty">Nothing this time. Your credits are saved for next time.</p>';
  const regs = summary.regulars.map((r) => `<div class="tc-reg"><b>${esc(r.name)}</b><span>${r.bought.length ? r.bought.map((l) => esc(prizeName(l.prize))).join(', ') : 'bought nothing'}</span></div>`).join('');
  const el = html(`<main class="screen">
    <div class="tclosed">
      <div class="caller-big">
        <div class="caller-img" data-caller></div>
        <div class="speech"><span>${esc(callerLines.prizeTable.closing[0])}</span></div>
      </div>
      <h2>You took home</h2>
      <div class="cab-card">${mine}</div>
      <h2>The regulars</h2>
      <div class="cab-card">${regs}</div>
      <p class="tc-note">${summary.left - summary.arrivals} ${summary.left - summary.arrivals === 1 ? 'prize stays' : 'prizes stay'} on the table. ${summary.arrivals} new ${summary.arrivals === 1 ? 'prize arrives' : 'prizes arrive'} for next time.</p>
      <div class="spacer"></div>
      <button class="btn btn-aqua" data-again>Play another night</button>
      <button class="btn btn-ghost" style="align-self:center" data-home>Back to home</button>
    </div>
  </main>`);
  attachCaller(el.querySelector('[data-caller]'), { voice, mood: 'happy' });
  el.querySelector('[data-again]').addEventListener('click', onAgain);
  el.querySelector('[data-home]').addEventListener('click', onHome);
  const start = setTimeout(() => voice?.speak(callerLines.prizeTable.closing[0]), 400);
  return { el, update() {}, destroy: () => { clearTimeout(start); voice?.cancel(); } };
}
