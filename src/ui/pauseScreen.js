import { html, setText, callerImages } from './helpers.js';

// The pause cover. It shows nothing about the game, so pausing never gives extra thinking time.

export function pauseScreen(game, { onQuit, onResume }) {
  const line = game.callerLines.game.pause[0];
  const el = html(`<main class="screen tense">
    <div class="pause">
      <div class="pill-label" data-badge></div>
      <h1 data-title>Paused</h1>
      <img src="${callerImages.noPeeking}" alt="">
      <div class="pause-bubble"><span>${line}</span></div>
      <p class="pause-note" data-note>When you come back there is a 3, 2, 1 and the ring carries on from where it stopped.</p>
      <div class="count" data-count hidden></div>
      <div class="pause-buttons" data-buttons>
        <button class="btn btn-aqua" data-resume>Resume</button>
        <button class="btn btn-ghost" data-quit>Quit this game</button>
      </div>
    </div>
    <div class="confirm" data-confirm hidden>
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="Quit this game?">
        <h2>Quit this game?</h2>
        <p>Your cards and marks will be lost.</p>
        <button class="btn btn-aqua" data-keep>Keep playing</button>
        <button class="btn btn-white" data-really>Quit</button>
      </div>
    </div>
  </main>`);

  const badge = el.querySelector('[data-badge]');
  const title = el.querySelector('[data-title]');
  const note = el.querySelector('[data-note]');
  const count = el.querySelector('[data-count]');
  const buttons = el.querySelector('[data-buttons]');
  const confirmBox = el.querySelector('[data-confirm]');

  el.querySelector('[data-resume]').addEventListener('click', onResume);
  el.querySelector('[data-quit]').addEventListener('click', () => { confirmBox.hidden = false; });
  el.querySelector('[data-keep]').addEventListener('click', () => { confirmBox.hidden = true; });
  el.querySelector('[data-really]').addEventListener('click', onQuit);

  function update() {
    const resuming = game.pauseState === 'resuming';
    setText(badge, game.pauseReason === 'player' ? 'Your one pause this game' : 'Paused while you were away');
    setText(title, resuming ? 'Get ready' : 'Paused');
    count.hidden = !resuming;
    buttons.hidden = resuming;
    note.hidden = resuming;
    if (resuming) setText(count, game.resumeCount);
  }
  return { el, update };
}
