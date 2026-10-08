import { shuffle } from './engine/rng.js';

// Picks the welcome line for each game. The lines are shuffled and played one after another, and only
// reshuffled once every line has been used, so the intro never feels the same. Where it got to is
// remembered on this device, so starting a new game carries on through the list instead of restarting it.

export function createIntroPicker(lines, settings, rng = Math.random) {
  const KEY = 'introBag';

  function refill(avoid) {
    let bag = shuffle(lines.map((_, i) => i), rng);
    // Do not start the new round with the line that ended the last one.
    if (bag.length > 1 && bag[0] === avoid) bag = [...bag.slice(1), bag[0]];
    return bag;
  }

  return {
    next() {
      if (!lines.length) return null;
      let bag = (settings.get(KEY) ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < lines.length);
      if (!bag.length) bag = refill(settings.get('introLast'));
      const index = bag[0];
      settings.set(KEY, bag.slice(1));
      settings.set('introLast', index);
      return lines[index];
    },
  };
}
