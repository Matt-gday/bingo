import { Caller3D } from './caller.js';

const caller = new Caller3D(document.getElementById('stage'), { size: 440 });
const status = document.getElementById('status');
const say = (text) => { status.textContent = text; };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let last = performance.now();
function frame(now) {
  caller.update((now - last) / 1000);
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const follow = document.getElementById('follow');

// ---- expression buttons ----
const expressions = [
  ['neutral', 'Neutral'], ['talking', 'Talking'], ['happy', 'Happy'], ['cheer', 'Cheer'],
  ['excited', 'Excited'], ['wince', 'Wince'], ['worried', 'Worried'], ['shut', 'Eyes shut'],
];
const expressionBox = document.getElementById('expressions');
for (const [id, label] of expressions) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { caller.setExpression(id); say(`Expression: ${label}`); });
  expressionBox.appendChild(b);
}

// ---- where he looks ----
const looks = [['Centre', 0, 0], ['Left', -0.45, 0], ['Right', 0.45, 0], ['Down at the cards', 0, 0.32], ['Up at the ball', 0.35, -0.3]];
const lookBox = document.getElementById('looks');
for (const [label, yaw, pitch] of looks) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { follow.checked = false; caller.look(yaw, pitch); say(`Looking: ${label}`); });
  lookBox.appendChild(b);
}

// ---- things he does ----
document.getElementById('blink').addEventListener('click', () => caller.blink());
document.getElementById('jump').addEventListener('click', () => {
  caller.setExpression('cheer');
  caller.jump();
  setTimeout(() => caller.setExpression('neutral'), 1200);
});
document.getElementById('shake').addEventListener('click', () => {
  caller.setExpression('wince');
  caller.shake();
  setTimeout(() => caller.setExpression('neutral'), 1300);
});

const talk = document.getElementById('talk');
talk.addEventListener('change', () => {
  caller.talk(talk.checked);
  caller.setExpression(talk.checked ? 'talking' : 'neutral');
});

// ---- follow the pointer ----
document.addEventListener('pointermove', (event) => {
  if (!follow.checked) return;
  const box = document.getElementById('stage').getBoundingClientRect();
  const x = (event.clientX - (box.left + box.width / 2)) / 400;
  const y = (event.clientY - (box.top + box.height / 2)) / 400;
  caller.look(Math.max(-0.6, Math.min(0.6, x * 0.9)), Math.max(-0.4, Math.min(0.4, y * 0.6)));
});

// ---- the look of the material ----
document.getElementById('style').addEventListener('change', (event) => caller.setStyle(event.target.value));
document.getElementById('gloss').addEventListener('input', (event) => caller.setGloss(Number(event.target.value)));

// ---- a short show of everything ----
async function demo() {
  const button = document.getElementById('demo');
  button.disabled = true;
  follow.checked = false;
  say('Hello! He looks at you and starts talking...');
  caller.look(0, 0);
  caller.setExpression('talking');
  caller.talk(true);
  await sleep(2600);
  say('He looks down at the cards while you mark...');
  caller.look(0, 0.3);
  await sleep(1400);
  say('A number! He looks up at the ball.');
  caller.look(0.35, -0.28);
  await sleep(1500);
  caller.talk(false);
  caller.look(0, 0);
  caller.setExpression('neutral');
  await sleep(700);
  say('You won! Cheering and jumping.');
  caller.setExpression('cheer');
  caller.jump(4);
  await sleep(900);
  caller.jump(3.2);
  await sleep(1400);
  say('A false call: wince.');
  caller.setExpression('wince');
  caller.shake();
  await sleep(1700);
  say('Pause: eyes shut, no peeking!');
  caller.setExpression('shut');
  await sleep(1800);
  say('Back to normal.');
  caller.setExpression('neutral');
  button.disabled = false;
}
document.getElementById('demo').addEventListener('click', demo);
say('Try the buttons, or press "Show me everything".');
