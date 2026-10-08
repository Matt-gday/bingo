// The rules for the caller's speech bubble, kept apart from the page so they can be tested.
//
// A line of speech is split into rows. If the rows fit in the bubble it simply shows them. If there are
// more rows than fit, the text scrolls up as the caller speaks: the row being spoken sits on the bottom row of
// the bubble, and rows that have been spoken fade and blur away through the top.

// When each row starts being spoken, in milliseconds, in proportion to how long the row is.
export function rowStartTimes(rows, durationMs) {
  const total = rows.reduce((n, row) => n + row.length, 0) || 1;
  let soFar = 0;
  return rows.map((row) => {
    const start = (soFar / total) * durationMs;
    soFar += row.length;
    return start;
  });
}

// The row being spoken after `elapsedMs`.
export function spokenRow(startTimes, elapsedMs) {
  let spoken = 0;
  for (let i = 0; i < startTimes.length; i++) if (elapsedMs >= startTimes[i]) spoken = i;
  return spoken;
}

// How many rows the text has scrolled up (0 means the first row is at the top of the bubble).
export function scrollTarget(spoken, rowCount, maxLines) {
  if (rowCount <= maxLines) return 0;
  return Math.min(rowCount - maxLines, Math.max(0, spoken - (maxLines - 1)));
}

// How many rows the bubble is tall: as many as the text needs, up to the most that fit.
export function visibleRows(rowCount, maxLines) {
  return Math.max(1, Math.min(rowCount, maxLines));
}

// How visible a row is, from 0 to 1, given where its top edge is (y, measured down from the top of the
// bubble) and the row height. Rows leaving through the top fade out; rows below the bubble are hidden.
export function rowVisibility(y, rowHeight, bubbleHeight) {
  if (y >= bubbleHeight - 0.5) return 0;
  return Math.min(1, Math.max(0, (y + rowHeight) / (rowHeight * 0.95)));
}

// Split words into rows using a function that says how wide a piece of text is.
export function splitIntoRows(words, widthOf, maxWidth) {
  const rows = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (current && widthOf(attempt) > maxWidth) {
      rows.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) rows.push(current);
  return rows;
}
