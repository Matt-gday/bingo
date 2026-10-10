import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectLines, allLines } from '../tools/voice-lines.mjs';

const load = (name) => JSON.parse(readFileSync(new URL(`../Data/${name}.json`, import.meta.url), 'utf8'));
const input = { callerLines: load('caller-lines'), patterns: load('patterns'), regulars: load('regulars'), sets: load('sets') };

test('every call the caller can make has a recording line', () => {
  const lines = allLines(input);
  assert.ok(lines.includes('Eight, Garden gate!'));
  assert.ok(lines.includes('Legs eleven!'));
  assert.ok(lines.includes('Eleven!'));
  assert.ok(lines.includes('Four and seven, forty-seven!'));
  assert.ok(lines.includes('Forty-five...'));
});

test('lines with placeholders are filled in, never left with braces', () => {
  const lines = allLines(input);
  assert.ok(lines.every((line) => !/[{}]/.test(line)));
  assert.ok(lines.includes("Ooh, unlucky. I haven't called forty-five yet."));
  assert.ok(lines.includes("I can't see a line there, I'm afraid."));
});

test('no line is listed twice', () => {
  const lines = allLines(input);
  assert.equal(new Set(lines).size, lines.length);
  assert.ok(Object.keys(collectLines(input)).length >= 5);
});
