// A sheet of every wearable prize on a head, with its colour, for briefing the artwork. Dev server: /wearables-sheet.html
import prizes from '../Data/prizes.json';
import { hub } from '../src/ui/caller3d/hub.js';
import { wearableLook } from '../src/ui/prizeArt.js';

const grid = document.getElementById('grid');
for (const prize of prizes.prizes.filter((p) => p.wearable)) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = `<div class="box"></div><b>${prize.name}</b><span class="sw" style="background:${prize.wearable.colour}"></span> ${prize.wearable.colour} · ${prize.price} credits<br>${prize.tags.join(', ')}`;
  grid.append(cell);
  queueMicrotask(() => hub.mount(cell.querySelector('.box'), wearableLook(prize), { cssSize: 150 }));
}
