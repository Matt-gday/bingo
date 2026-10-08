// Draws the caller's face (eyes, brows, cheeks, mouth) onto a canvas, from a handful of numbers.
// Because it is drawn from numbers rather than from fixed pictures, one expression can melt into another.

export const EXPRESSIONS = {
  // eyeHappy: 0 round open eyes ... 1 happy closed arcs   | eyeSquint: squeezed tight
  // browRaise: -1 low ... 1 high    | browTilt: -1 worried (inner ends up) ... 1 cross (inner ends down)
  // mouthSmile: -1 frown ... 1 big smile | mouthWidth | blush
  neutral: { eyeHappy: 0, eyeSquint: 0, browRaise: 0.1, browTilt: 0, mouthSmile: 0.55, mouthWidth: 1, blush: 0.9, mouthOpenBase: 0 },
  talking: { eyeHappy: 0, eyeSquint: 0, browRaise: 0.35, browTilt: 0, mouthSmile: 0.6, mouthWidth: 1, blush: 1, mouthOpenBase: 0.15 },
  happy: { eyeHappy: 1, eyeSquint: 0, browRaise: 0.4, browTilt: 0, mouthSmile: 1, mouthWidth: 1.1, blush: 1, mouthOpenBase: 0.45 },
  cheer: { eyeHappy: 1, eyeSquint: 0, browRaise: 0.7, browTilt: 0, mouthSmile: 1, mouthWidth: 1.35, blush: 1.1, mouthOpenBase: 0.85 },
  wince: { eyeHappy: 0.1, eyeSquint: 1, browRaise: 0.3, browTilt: -0.9, mouthSmile: -0.8, mouthWidth: 1.1, blush: 0.7, mouthOpenBase: 0 },
  worried: { eyeHappy: 0, eyeSquint: 0.2, browRaise: 0.5, browTilt: -1, mouthSmile: -0.4, mouthWidth: 0.85, blush: 0.7, mouthOpenBase: 0.05 },
  shut: { eyeHappy: 0.85, eyeSquint: 0.2, browRaise: -0.1, browTilt: 0, mouthSmile: 0.3, mouthWidth: 0.85, blush: 0.9, mouthOpenBase: 0 },
  excited: { eyeHappy: 0, eyeSquint: 0, browRaise: 0.9, browTilt: 0, mouthSmile: 0.9, mouthWidth: 1.2, blush: 1.1, mouthOpenBase: 0.55 },
};

const INK = '#2c1b82';
const INK_LIGHT = '#4a36b8';

function lerp(a, b, t) { return a + (b - a) * t; }

export function blendExpressions(from, to, t) {
  const out = {};
  for (const key of Object.keys(to)) out[key] = lerp(from[key] ?? to[key], to[key], t);
  return out;
}

// The face covers about 103 degrees across and 92 degrees up and down of the ball, so these turn angles
// (in radians, from the middle of the face) into places on the picture.
export const FACE_SPAN = { yaw: 1.8, pitch: 1.6 };

export function drawFace(ctx, W, H, p) {
  const X = (yaw) => W * (0.5 + yaw / FACE_SPAN.yaw);
  const Y = (pitch) => H * (0.5 - pitch / FACE_SPAN.pitch);
  const unit = W / FACE_SPAN.yaw; // pixels per radian
  ctx.clearRect(0, 0, W, H);

  // ---- cheeks ----
  for (const side of [-1, 1]) {
    const cx = X(side * 0.74);
    const cy = Y(-0.2);
    const rx = unit * 0.25 * p.blush;
    const ry = unit * 0.18 * p.blush;
    if (rx < 1) continue;
    const g = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.25, 1, cx, cy, rx);
    g.addColorStop(0, 'rgba(255, 170, 205, 0.98)');
    g.addColorStop(0.75, 'rgba(255, 140, 190, 0.88)');
    g.addColorStop(1, 'rgba(255, 140, 190, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // a glossy glint on each cheek
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.32, cy - ry * 0.45, rx * 0.22, ry * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- eyes ----
  const open = Math.max(0.04, p.eyeOpen ?? 1);
  for (const side of [-1, 1]) {
    const cx = X(side * 0.46) + (p.pupilX ?? 0) * unit * 0.05;
    const cy = Y(0.1) + (p.pupilY ?? 0) * unit * -0.05;
    const w = unit * 0.4;
    const h = unit * 0.54 * open * (1 - p.eyeSquint * 0.5) * (1 - p.eyeHappy * 0.6);
    const arcAmount = Math.max(p.eyeHappy, p.eyeSquint * 0.9);

    // round eye (fades out as the eye turns into a happy arc)
    // The round eye and the arc/chevron take turns: each is gone before the other is fully there, so a ghost
    // of the old eyes never lingers while one expression turns into another.
    const roundAlpha = Math.min(1, Math.max(0, 1 - (arcAmount - 0.05) / 0.3));
    if (roundAlpha > 0.02 && h > 2) {
      ctx.save();
      ctx.globalAlpha = roundAlpha;
      const g = ctx.createLinearGradient(cx, cy - h, cx, cy + h);
      g.addColorStop(0, '#4a37b5');
      g.addColorStop(0.55, '#2a1a82');
      g.addColorStop(1, '#1b0f5e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // glossy highlights
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.14, cy - h * 0.22, w * 0.17, h * 0.15, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + w * 0.17, cy + h * 0.2, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 140, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.33, w * 0.28, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // happy arc, or squeezed-shut chevron ("> <") when wincing
    const arcAlpha = Math.min(1, Math.max(0, (arcAmount - 0.25) / 0.3));
    if (arcAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = arcAlpha;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = unit * 0.07;
      const squeezed = p.eyeSquint > p.eyeHappy;
      ctx.beginPath();
      if (squeezed) {
        const toward = -side; // the point of the chevron aims at the nose
        const reach = w * 0.52;
        ctx.moveTo(cx - toward * reach, cy - w * 0.36);
        ctx.lineTo(cx + toward * reach * 0.75, cy + w * 0.02);
        ctx.lineTo(cx - toward * reach, cy + w * 0.4);
      } else {
        ctx.moveTo(cx - w * 0.52, cy + h * 0.05 + w * 0.12);
        ctx.quadraticCurveTo(cx, cy - w * 0.42, cx + w * 0.52, cy + h * 0.05 + w * 0.12);
      }
      ctx.stroke();
      if (!squeezed) {
        ctx.strokeStyle = INK_LIGHT;
        ctx.lineWidth = unit * 0.016;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.3, cy - w * 0.12);
        ctx.quadraticCurveTo(cx - w * 0.05, cy - w * 0.3, cx + w * 0.25, cy - w * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // brows
    const by = Y(0.1) - unit * (0.4 + p.browRaise * 0.12);
    const inner = side * -1; // direction towards the nose
    const tilt = p.browTilt * unit * 0.07;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = unit * 0.06;
    ctx.beginPath();
    const bx = X(side * 0.46);
    ctx.moveTo(bx - inner * w * 0.5, by + tilt * 0.4);
    ctx.quadraticCurveTo(bx, by - unit * 0.06, bx + inner * w * 0.5, by - tilt);
    ctx.stroke();
    ctx.restore();
  }

  // ---- mouth ----
  const mx = X(0);
  const my = Y(-0.16);
  const mw = unit * 0.27 * p.mouthWidth;
  const openAmount = Math.min(1, Math.max(0, p.mouthOpen ?? 0));
  const smile = p.mouthSmile;
  if (openAmount > 0.06) {
    const top = my - unit * 0.03 * (1 - smile * 0.3);
    const depth = unit * (0.07 + openAmount * 0.23);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mx - mw, top - smile * unit * 0.02);
    ctx.quadraticCurveTo(mx, top + unit * 0.02 - smile * unit * 0.03, mx + mw, top - smile * unit * 0.02);
    ctx.quadraticCurveTo(mx + mw * 0.9, top + depth * 1.2, mx, top + depth * 1.3);
    ctx.quadraticCurveTo(mx - mw * 0.9, top + depth * 1.2, mx - mw, top - smile * unit * 0.02);
    ctx.closePath();
    const g = ctx.createLinearGradient(mx, top, mx, top + depth * 1.3);
    g.addColorStop(0, '#7a0f2a');
    g.addColorStop(1, '#c1243f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#ff7f95';
    ctx.beginPath();
    ctx.ellipse(mx, top + depth * 1.3, mw * 0.7, depth * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = unit * 0.012;
    ctx.lineCap = 'round';
  } else {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = unit * 0.04;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (smile < -0.3) {
      // a wobbly grimace
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = mx - mw * 0.9 + (mw * 1.8 * i) / steps;
        const y = my + (i % 2 ? -1 : 1) * unit * 0.028;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineJoin = 'round';
    } else {
      ctx.moveTo(mx - mw * 0.8, my - smile * unit * 0.05);
      ctx.quadraticCurveTo(mx, my + smile * unit * 0.13 + unit * 0.01, mx + mw * 0.8, my - smile * unit * 0.05);
    }
    ctx.stroke();
    ctx.restore();
  }
}
