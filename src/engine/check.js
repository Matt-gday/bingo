import { shuffle } from './rng.js';
import { candidateSquareSets } from './patterns.js';
import { isFreeSquare } from './cards.js';

// Works out what the caller finds when the player claims bingo.
//
// A mark is valid when its number has been called AND it was the first mark made
// for that number (a number on both cards only counts once).
//
// A marks list holds { card, row, col, number, seq }, where seq says the order the marks were made in.

export function evaluateClaim({ cards, marks, called, pattern, config }) {
  const calledSet = new Set(called);

  const firstSeqForNumber = new Map();
  for (const mark of marks) {
    const best = firstSeqForNumber.get(mark.number);
    if (best === undefined || mark.seq < best) firstSeqForNumber.set(mark.number, mark.seq);
  }

  const markAt = new Map(marks.map((m) => [`${m.card}:${m.row},${m.col}`, m]));

  // Look at every way the pattern could be completed, on every card.
  const options = [];
  const completeOptions = [];
  cards.forEach((card, cardIndex) => {
    for (const squares of candidateSquareSets(pattern)) {
      const items = [];
      let allMarked = true;
      for (const [row, col] of squares) {
        if (isFreeSquare(row, col, config)) continue;
        const mark = markAt.get(`${cardIndex}:${row},${col}`);
        if (!mark) {
          allMarked = false;
          break;
        }
        const number = card.grid[row][col];
        let problem = null;
        if (!calledSet.has(number)) problem = 'notCalled';
        else if (firstSeqForNumber.get(number) !== mark.seq) problem = 'usedOnOtherCard';
        items.push({ card: cardIndex, row, col, number, problem });
      }
      options.push({ allMarked, items });
      if (allMarked) completeOptions.push({ card: cardIndex, items });
    }
  });

  if (completeOptions.length === 0) return { result: 'noPattern', items: [], order: [], failItem: null, reason: null };

  const goodCount = (option) => option.items.filter((i) => !i.problem).length;
  const winner = completeOptions.find((option) => goodCount(option) === option.items.length);
  const chosen = winner
    ?? shuffle(completeOptions).sort((a, b) => goodCount(b) - goodCount(a))[0];

  // Reveal in random order, and stop at the first bad number.
  const order = shuffle(chosen.items);
  const failAt = order.findIndex((item) => item.problem);
  const reveals = failAt === -1 ? order : order.slice(0, failAt + 1);

  return {
    result: failAt === -1 ? 'win' : 'fail',
    card: chosen.card,
    // Every number in the pattern, in card order (for showing them in a row).
    items: [...chosen.items],
    // The numbers in the order they will be checked.
    order: reveals,
    failItem: failAt === -1 ? null : order[failAt],
    reason: failAt === -1 ? null : order[failAt].problem,
  };
}
