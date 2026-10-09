// Keeps the phone's screen on while the game is open, even if nothing is touched for a long time.
// The phone gives the lock back whenever the page is hidden, so it is asked for again each time the game
// comes back, and on every tap until the first request works (some phones only allow it after a tap).

export function keepScreenOn() {
  let lock = null;
  let asking = false;

  async function request() {
    if (!('wakeLock' in navigator) || lock || asking || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch {
      lock = null; // refused for now (low battery, or not allowed yet); it will be tried again
    }
    asking = false;
  }

  request();
  document.addEventListener('visibilitychange', request);
  window.addEventListener('pageshow', request);
  for (const type of ['click', 'touchend', 'pointerup']) document.addEventListener(type, request, { capture: true, passive: true });
}
