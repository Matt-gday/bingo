import {
  rowStartTimes, spokenRow, scrollTarget, visibleRows, rowVisibility, splitIntoRows,
} from './speechLogic.js';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The caller's speech bubble. It is as tall as its text needs (up to `maxLines`). Longer text scrolls up as the
// caller speaks, with the spoken rows fading and blurring away through the top of the bubble.
// The bubble sits in a row that is already tall enough, so its size changing never moves anything around it.
export class SpeechBubble {
  constructor(el, { voice, maxLines = () => 3 }) {
    this.el = el;
    this.voice = voice;
    this.maxLines = maxLines;
    el.innerHTML = '<div class="speech-window"><div class="speech-lines"></div></div>';
    this.windowEl = el.querySelector('.speech-window');
    this.linesEl = el.querySelector('.speech-lines');
    this.current = null; // the line of speech now showing (the game's bubble object)
    this.rowEls = [];
    this.offset = 0;
    this.lastTime = 0;
  }

  begin(bubble, now) {
    this.current = bubble;
    const text = bubble.text ?? '';
    const style = getComputedStyle(this.el);
    this.rowHeight = parseFloat(style.lineHeight) || 22;
    const width = this.el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    // Work out where the rows break, using the real font.
    const canvas = (SpeechBubble.canvas ??= document.createElement('canvas')).getContext('2d');
    canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const rows = splitIntoRows(text.split(/\s+/).filter(Boolean), (piece) => canvas.measureText(piece).width, Math.max(40, width));
    this.rows = rows.length ? rows : [''];

    this.linesEl.innerHTML = '';
    this.rowEls = this.rows.map((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'speech-line';
      rowEl.style.height = `${this.rowHeight}px`;
      rowEl.textContent = row;
      this.linesEl.appendChild(rowEl);
      return rowEl;
    });

    this.visible = visibleRows(this.rows.length, this.maxLines());
    this.windowEl.style.height = `${this.visible * this.rowHeight}px`;

    // How long the caller takes: the length of the recording, or an estimate, or reading time with no voice.
    const spoken = bubble.spoken ?? text;
    const words = text.split(/\s+/).filter(Boolean).length;
    this.durationMs = this.voice?.on ? this.voice.estimateMs(spoken) : Math.max(900, words * 230);
    this.startTimes = rowStartTimes(this.rows, this.durationMs);
    this.startedAt = now;
    this.offset = 0;
    this.reduce = prefersReducedMotion();
    this.paint(0);
  }

  update(bubble, now) {
    if (!bubble) return;
    if (bubble !== this.current) this.begin(bubble, now);
    const elapsed = now - this.startedAt;
    const spoken = spokenRow(this.startTimes, elapsed);
    const target = scrollTarget(spoken, this.rows.length, this.visible);
    const dt = Math.min(100, Math.max(0, now - (this.lastTime || now)));
    this.lastTime = now;
    // Glide towards the target (a smooth ease), or jump there with reduced motion.
    this.offset = this.reduce ? target : this.offset + (target - this.offset) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - this.offset) < 0.002) this.offset = target;
    this.paint(this.offset);
  }

  paint(offset) {
    const height = this.visible * this.rowHeight;
    this.rowEls.forEach((rowEl, i) => {
      const y = (i - offset) * this.rowHeight;
      const visibility = rowVisibility(y, this.rowHeight, height);
      rowEl.style.transform = `translateY(${y.toFixed(1)}px)`;
      rowEl.style.opacity = visibility.toFixed(3);
      rowEl.style.filter = this.reduce || visibility >= 1 ? 'none' : `blur(${((1 - visibility) * 4.5).toFixed(2)}px)`;
    });
  }
}
