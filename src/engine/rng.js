// Small random helpers. Every function takes an optional `rng` (a function that
// returns a number from 0 up to but not including 1) so tests can use a fixed one.

export function shuffle(items, rng = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickSome(items, count, rng = Math.random) {
  return shuffle(items, rng).slice(0, count);
}

export function pickOne(items, rng = Math.random) {
  return items[Math.floor(rng() * items.length)];
}

// A repeatable random number generator, used only by the tests.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
