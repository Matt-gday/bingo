import { pickOne } from './rng.js';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy'];

export function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function numberInWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
}

// What the caller says for a number, for example "Eight, Garden gate!" or "Four and seven, forty-seven!".
// A nickname that already contains the number ("Legs eleven") is said on its own; any other nickname
// has the number read first, so the player always hears which number it is.
// With nicknames off (Quick speed) he just says the number.
export function callText(number, callerLines, useNicknames) {
  const nickname = callerLines.nicknames[String(number)];
  const full = numberInWords(number);
  if (useNicknames && nickname) {
    return nickname.toLowerCase().includes(full) ? `${nickname}!` : `${capital(full)}, ${nickname}!`;
  }
  if (!useNicknames || number < 10) return `${capital(full)}!`;
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  const digits = ones === 0 ? `${ONES[tens]} oh` : `${ONES[tens]} and ${ONES[ones]}`;
  return `${capital(digits)}, ${full}!`;
}

// Fill in {placeholders} in one of the caller's lines.
export function fillLine(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

export function sayLine(callerLines, group, values, rng = Math.random) {
  const lines = callerLines.game[group];
  return fillLine(pickOne(lines, rng), values);
}
