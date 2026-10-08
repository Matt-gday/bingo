import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rowStartTimes, spokenRow, scrollTarget, visibleRows, rowVisibility, splitIntoRows,
} from '../src/ui/speechLogic.js';

test('words are split into rows that fit the width', () => {
  const widthOf = (text) => text.length * 10; // ten pixels a letter
  assert.deepEqual(splitIntoRows('Welcome to Bingo night everyone'.split(' '), widthOf, 120), ['Welcome to', 'Bingo night', 'everyone']);
  assert.deepEqual(splitIntoRows(['Supercalifragilistic'], widthOf, 50), ['Supercalifragilistic'], 'a word too long for a row still gets its own row');
  assert.deepEqual(splitIntoRows([], widthOf, 100), []);
});

test('rows start being spoken in proportion to their length', () => {
  const times = rowStartTimes(['aaaa', 'bb', 'cccccc'], 1200);
  assert.deepEqual(times, [0, 400, 600]);
  assert.equal(spokenRow(times, 0), 0);
  assert.equal(spokenRow(times, 450), 1);
  assert.equal(spokenRow(times, 5000), 2);
});

test('the bubble is as tall as the text needs, up to the most that fit', () => {
  assert.equal(visibleRows(1, 3), 1);
  assert.equal(visibleRows(2, 3), 2);
  assert.equal(visibleRows(3, 3), 3);
  assert.equal(visibleRows(7, 3), 3);
  assert.equal(visibleRows(0, 3), 1);
});

test('text only scrolls when there are more rows than fit, keeping the spoken row on the bottom row', () => {
  // five rows in a three-row bubble
  assert.equal(scrollTarget(0, 5, 3), 0);
  assert.equal(scrollTarget(2, 5, 3), 0, 'the third row is spoken at the bottom of the bubble, no scrolling yet');
  assert.equal(scrollTarget(3, 5, 3), 1, 'the fourth row scrolls the first one off the top');
  assert.equal(scrollTarget(4, 5, 3), 2);
  assert.equal(scrollTarget(4, 3, 3), 0, 'rows that fit never scroll');
});

test('rows fade out through the top and are hidden below the bubble', () => {
  const rowHeight = 22;
  const bubbleHeight = 66;
  assert.equal(rowVisibility(0, rowHeight, bubbleHeight), 1);
  assert.equal(rowVisibility(44, rowHeight, bubbleHeight), 1, 'the bottom row is fully shown');
  assert.ok(rowVisibility(-11, rowHeight, bubbleHeight) < 1 && rowVisibility(-11, rowHeight, bubbleHeight) > 0, 'half way off the top: fading');
  assert.equal(rowVisibility(-22, rowHeight, bubbleHeight), 0, 'gone');
  assert.equal(rowVisibility(66, rowHeight, bubbleHeight), 0, 'below the bubble: not shown, no peeking');
});
