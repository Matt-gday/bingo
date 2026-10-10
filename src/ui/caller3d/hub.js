import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Caller3D } from './caller.js';

// Draws many small characters (the regulars at the table, the player) with ONE WebGL renderer. Each character
// lives in its own scene; every frame the visible ones are drawn one after another and copied onto the small
// canvas on the page. One renderer keeps the phone's graphics memory and battery use down.

const MOOD_TO_EXPRESSION = {
  content: 'neutral', smug: 'smug', shocked: 'shocked', sulky: 'sulky', cheer: 'cheer', happy: 'happy', worried: 'worried', talking: 'talking',
};

export class CharacterHub {
  constructor({ renderSize = 256 } = {}) {
    this.renderSize = renderSize;
    this.views = new Set();
    this.running = false;
    this.last = 0;
    this.renderer = null;
    this.environment = null;
    this.failed = false;
  }

  // Creates the renderer the first time it is needed. Returns false if this phone cannot do it.
  ensureRenderer() {
    if (this.renderer) return true;
    if (this.failed) return false;
    try {
      const canvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.renderSize, this.renderSize, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.92;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  // Puts a character into `el` (an empty box that the page sizes). Returns a handle, or null if there is no 3D.
  mount(el, look, { cssSize = 64, distance = 7.8, cameraY = 0.24 } = {}) {
    if (!this.ensureRenderer()) return null;
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    canvas.className = 'character-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    el.appendChild(canvas);
    const character = new Caller3D(null, { shared: { renderer: this.renderer, environment: this.environment }, look, distance, cameraY });
    character.setExpression('neutral');
    const view = {
      el, canvas, ctx: canvas.getContext('2d'), character, mood: 'content',
      nextGlance: 1 + Math.random() * 3,
      setMood: (mood) => {
        if (view.mood === mood) return;
        view.mood = mood;
        character.setExpression(MOOD_TO_EXPRESSION[mood] ?? 'neutral');
        if (mood === 'cheer') character.jump(2.6);
        if (mood === 'shocked') character.jump(1.2);
        if (mood === 'sulky') character.shake();
      },
      setLook: (next) => character.setLook(next),
      destroy: () => {
        this.views.delete(view);
        canvas.remove();
      },
    };
    this.views.add(view);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame((t) => this.frame(t));
    }
    return view;
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    for (const view of this.views) {
      if (!view.canvas.isConnected) {
        view.orphaned = (view.orphaned ?? 0) + dt; // built but not on the page yet, or gone: forget it after a moment
        if (view.orphaned > 1.5) this.views.delete(view);
        continue;
      }
      view.orphaned = 0;
      try {
        view.nextGlance -= dt;
        if (view.nextGlance <= 0) {
          view.nextGlance = 1.5 + Math.random() * 3.5;
          view.character.look((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.3);
        }
        view.character.update(dt);
        view.character.renderShared();
        const { ctx, canvas } = view;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.renderer.domElement, 0, 0, this.renderSize, this.renderSize, 0, 0, canvas.width, canvas.height);
      } catch {
        // one character must never stop the others
      }
    }
  }
}

export const hub = new CharacterHub();
