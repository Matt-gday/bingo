import { shuffle, pickSome } from './rng.js';

// A card is a 5 x 5 grid of numbers, grid[row][col]. The free centre square is 0.

const SIZE = 5;
const CENTRE = 2;

export function columnLetters(config) {
  return Object.keys(config.cards.columns);
}

export function letterFor(number, config) {
  for (const [letter, [low, high]] of Object.entries(config.cards.columns)) {
    if (number >= low && number <= high) return letter;
  }
  return '';
}

export function isFreeSquare(row, col, config) {
  return config.cards.freeCentre && row === CENTRE && col === CENTRE;
}

function rangeOf(low, high) {
  const out = [];
  for (let n = low; n <= high; n++) out.push(n);
  return out;
}

// How many numbers a column holds (the middle column has one fewer when the centre is free).
function slotsInColumn(colIndex, config) {
  return config.cards.freeCentre && colIndex === CENTRE ? SIZE - 1 : SIZE;
}

function placeColumn(numbers, colIndex, grid, config) {
  const shuffled = shuffle(numbers);
  let next = 0;
  for (let row = 0; row < SIZE; row++) {
    if (isFreeSquare(row, colIndex, config)) {
      grid[row][colIndex] = 0;
    } else {
      grid[row][colIndex] = shuffled[next++];
    }
  }
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function randomCard(config) {
  const grid = emptyGrid();
  Object.values(config.cards.columns).forEach(([low, high], colIndex) => {
    const chosen = pickSome(rangeOf(low, high), slotsInColumn(colIndex, config));
    placeColumn(chosen, colIndex, grid, config);
  });
  return grid;
}

// A card that shares exactly `sharedCount` numbers with `base`.
function cardSharing(base, sharedCount, config) {
  const baseNumbers = base.flat().filter((n) => n !== 0);
  const shared = new Set(pickSome(baseNumbers, sharedCount));
  const grid = emptyGrid();
  Object.values(config.cards.columns).forEach(([low, high], colIndex) => {
    const slots = slotsInColumn(colIndex, config);
    const baseInColumn = base.map((row) => row[colIndex]).filter((n) => n !== 0);
    const keep = baseInColumn.filter((n) => shared.has(n));
    const fresh = pickSome(
      rangeOf(low, high).filter((n) => !baseInColumn.includes(n)),
      slots - keep.length,
    );
    placeColumn([...keep, ...fresh], colIndex, grid, config);
  });
  return grid;
}

// Deal the player's cards. Later cards share some numbers with the first,
// because shared numbers are what make the player choose which card to back.
export function dealCards(config) {
  const count = config.cards.playerCards;
  const first = randomCard(config);
  const cards = [first];
  // Every game the cards share a different number of numbers (for example 7 to 12), so the choice of
  // which card to back comes up more or less often.
  const fewest = config.cards.sharedNumbersBetweenPlayerCards;
  const most = fewest + (config.cards.extraSharedNumbersMax ?? 0);
  const shared = fewest + Math.floor(Math.random() * (most - fewest + 1));
  for (let i = 1; i < count; i++) {
    cards.push(cardSharing(first, shared, config));
  }
  return cards.map((grid) => ({ grid }));
}

export function cardNumbers(card) {
  return card.grid.flat().filter((n) => n !== 0);
}
