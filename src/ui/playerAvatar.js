import { mountFace } from './characterView.js';
import { defaultLook } from './caller3d/avatar.js';

// The player's own avatar, shown during the game. Its look is the one kept in the settings (until profiles
// arrive), or the plain default.

export function playerLook(settings) {
  return settings.get('avatarLook') ?? defaultLook('player');
}

export function mountPlayer(el, settings, { size = 64, mood = 'content' } = {}) {
  return mountFace(el, playerLook(settings), { size, mood });
}

// How the player's avatar feels while the card is being checked: easy at first, tense as the numbers go by,
// wide-eyed on the last one, then delighted or wincing.
export function checkingMood(game) {
  const c = game.checking;
  if (!c) return 'content';
  if (game.phase === 'won') return 'cheer';
  if (c.stage === 'failed') return 'wince';
  if (game.isFinalReveal) return 'shocked';
  const total = c.evaluation.order.length;
  return total > 1 && c.index / (total - 1) >= 0.4 ? 'worried' : 'content';
}

// How the player's avatar feels on the cards: pleased when a mark is down, nervous when a regular is one
// square from winning, sulky while sitting out.
export function playingMood(game) {
  if (game.sittingOut) return 'sulky';
  if (game.pending) return 'happy';
  if (game.bots.some((b) => game.botToGo(b) === 1)) return 'worried';
  return 'content';
}
