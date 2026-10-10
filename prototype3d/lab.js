// A page for looking at every hat, pair of glasses, neck item and eye style on the characters.
// Run the game's dev server and open /avatar-lab.html
import avatar from '../Data/avatar.json';
import regulars from '../Data/regulars.json';
import { hub } from '../src/ui/caller3d/hub.js';
import { defaultLook } from '../src/ui/caller3d/avatar.js';

const lab = document.getElementById('lab');
function section(title, cells) {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  for (const { label, look, mood } of cells) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const box = document.createElement('div');
    box.className = 'box';
    cell.append(box, label);
    row.append(cell);
    queueMicrotask(() => {
      const view = hub.mount(box, look, { cssSize: 130 });
      if (view && mood) view.setMood(mood);
    });
  }
  lab.append(h, row);
}

const base = { ...defaultLook('player'), ball: '#FF8FCB' };
section('Hats', avatar.items.filter((i) => i.slot === 'hat').map((i) => ({ label: i.name, look: { ...base, hat: i.id } })));
section('Glasses', avatar.items.filter((i) => i.slot === 'glasses').map((i) => ({ label: i.name, look: { ...base, glasses: i.id } })));
section('Neckwear', avatar.items.filter((i) => i.slot === 'neck').map((i) => ({ label: i.name, look: { ...base, neck: i.id } })));
section('Eyes', avatar.eyes.map((e) => ({ label: e.name, look: { ...base, eyes: e.id } })));
section('Balls', avatar.balls.map((b) => ({ label: b.name, look: { ...base, ball: b.colour } })));
section('Moods', ['content', 'smug', 'shocked', 'sulky', 'cheer'].map((m) => ({ label: m, look: { ...base, ball: '#6FE9DD', glasses: 'round-glasses' }, mood: m })));
section('The regulars', regulars.regulars.map((r) => ({ label: r.name, look: r.look ?? { ...base, ball: r.colour } })));
