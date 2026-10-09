import { icons } from './helpers.js';

// The sound switches (caller's voice, sound effects, music, buzz). One card is used on the pause screen and in
// the sound sheet on the home screen. Each switch takes effect at once and is remembered on this device.

export function soundCard({ voice, settings, sfx, music, haptics, greetOnVoice = false }) {
  const rows = [
    { key: 'voiceOn', label: "Caller's voice", show: voice.supported, change: () => { voice.setOn(settings.get('voiceOn')); if (greetOnVoice && voice.on) voice.speak('Eyes down, everyone!'); } },
    { key: 'sfxOn', label: 'Sound effects', show: true, change: () => sfx.play('mark-pop') },
    { key: 'musicOn', label: 'Music', show: true, change: () => music.sync() },
    { key: 'hapticsOn', label: 'Buzz', show: haptics.supported, change: () => haptics.buzz(30) },
  ].filter((row) => row.show);

  const el = document.createElement('div');
  el.className = 'sound-card';
  el.innerHTML = `<div class="sound-title">${icons.speaker(18)} Sound</div>${rows
    .map((row) => `<div class="sound-row"><span>${row.label}</span>
      <button class="switch" role="switch" data-key="${row.key}" aria-label="${row.label}"><i></i></button></div>`)
    .join('')}`;

  const buttons = new Map(rows.map((row) => [row.key, el.querySelector(`[data-key="${row.key}"]`)]));
  function update() {
    for (const row of rows) {
      const on = !!settings.get(row.key);
      const button = buttons.get(row.key);
      button.setAttribute('aria-checked', String(on));
      button.classList.toggle('on', on);
    }
  }
  for (const row of rows) {
    buttons.get(row.key).addEventListener('click', () => {
      settings.set(row.key, !settings.get(row.key));
      row.change();
      update();
    });
  }
  update();
  return { el, update };
}
