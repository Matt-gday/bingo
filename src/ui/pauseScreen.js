import { html, setText, callerImages, icons } from './helpers.js';

// The pause cover. It shows nothing about the game, so pausing never gives extra thinking time.
// It is also where the sound settings live while a game is on.

export function pauseScreen(game, { onQuit, onResume, voice, settings, sfx, music, haptics }) {
  const line = game.callerLines.game.pause[0];

  // The sound switches. Each one takes effect straight away and is remembered on this device.
  const switches = [
    { key: 'voiceOn', label: "Caller's voice", show: voice.supported, change: () => voice.setOn(settings.get('voiceOn')) },
    { key: 'sfxOn', label: 'Sound effects', show: true, change: () => sfx.play('mark-pop') },
    { key: 'musicOn', label: 'Music', show: true, change: () => music.sync() },
    { key: 'hapticsOn', label: 'Buzz', show: haptics.supported, change: () => haptics.buzz(30) },
  ].filter((row) => row.show);

  const rows = switches
    .map((row) => `<div class="sound-row"><span>${row.label}</span>
      <button class="switch" role="switch" data-key="${row.key}" aria-label="${row.label}"><i></i></button></div>`)
    .join('');

  const el = html(`<main class="screen tense">
    <div class="pause">
      <div class="pill-label" data-badge></div>
      <h1 data-title>Paused</h1>
      <img src="${callerImages.noPeeking}" alt="">
      <div class="pause-bubble"><span>${line}</span></div>
      <div class="sound-card" data-sound>
        <div class="sound-title">${icons.speaker(18)} Sound</div>
        ${rows}
      </div>
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
  const soundCard = el.querySelector('[data-sound]');
  const confirmBox = el.querySelector('[data-confirm]');

  const switchEls = new Map(switches.map((row) => [row.key, el.querySelector(`[data-key="${row.key}"]`)]));
  for (const row of switches) {
    switchEls.get(row.key).addEventListener('click', () => {
      settings.set(row.key, !settings.get(row.key));
      row.change();
    });
  }

  el.querySelector('[data-resume]').addEventListener('click', onResume);
  el.querySelector('[data-quit]').addEventListener('click', () => { confirmBox.hidden = false; });
  el.querySelector('[data-keep]').addEventListener('click', () => { confirmBox.hidden = true; });
  el.querySelector('[data-really]').addEventListener('click', onQuit);

  function update() {
    const resuming = game.pauseState === 'resuming';
    // With a pause limit set in Data/config.json the badge says so; with no limit it just says Paused.
    const limited = game.config.pause.pausesPerGame !== null && game.config.pause.pausesPerGame !== undefined;
    setText(badge, game.pauseReason === 'player'
      ? (limited ? `Your ${game.config.pause.pausesPerGame === 1 ? 'one pause' : 'pause'} this game` : 'Game paused')
      : 'Paused while you were away');
    setText(title, resuming ? 'Get ready' : 'Paused');
    count.hidden = !resuming;
    buttons.hidden = resuming;
    note.hidden = resuming;
    soundCard.hidden = resuming;
    for (const row of switches) {
      const on = !!settings.get(row.key);
      const button = switchEls.get(row.key);
      button.setAttribute('aria-checked', String(on));
      button.classList.toggle('on', on);
    }
    if (resuming) setText(count, game.resumeCount);
  }
  return { el, update };
}
