// Turns a pattern from Data/patterns.json into the possible sets of squares
// that would complete it on one card. A square is [row, col].

const SIZE = 5;

export function allLines() {
  const lines = [];
  for (let r = 0; r < SIZE; r++) lines.push(Array.from({ length: SIZE }, (_, c) => [r, c]));
  for (let c = 0; c < SIZE; c++) lines.push(Array.from({ length: SIZE }, (_, r) => [r, c]));
  lines.push(Array.from({ length: SIZE }, (_, i) => [i, i]));
  lines.push(Array.from({ length: SIZE }, (_, i) => [i, SIZE - 1 - i]));
  return lines;
}

function combinations(items, count) {
  if (count === 0) return [[]];
  if (items.length < count) return [];
  const [first, ...rest] = items;
  return [
    ...combinations(rest, count - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, count),
  ];
}

function squaresOfGrid(grid) {
  const squares = [];
  grid.forEach((row, r) => row.forEach((on, c) => on && squares.push([r, c])));
  return squares;
}

// Join several lines into one list of squares, with no square counted twice, in reading order.
function mergeSquares(lists) {
  const seen = new Set();
  const out = [];
  for (const [r, c] of lists.flat()) {
    const key = `${r},${c}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([r, c]);
    }
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function candidateSquareSets(pattern) {
  switch (pattern.rule) {
    case 'lines':
      return combinations(allLines(), pattern.count).map(mergeSquares);
    case 'all':
      return [mergeSquares(allLines().slice(0, SIZE))];
    case 'grid':
      return [squaresOfGrid(pattern.grid)];
    case 'anyOf':
      return pattern.grids.map(squaresOfGrid);
    default:
      throw new Error(`Unknown pattern rule: ${pattern.rule}`);
  }
}
