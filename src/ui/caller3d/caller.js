import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EXPRESSIONS, blendExpressions, drawFace, FACE_SPAN } from './face.js';
import { buildItem, itemById, cleanLook, defaultLook } from './avatar.js';

// A 3D version of the bingo caller, drawn live in the browser. Everything is built from simple shapes and a
// face that is drawn from numbers, so there are no picture or model files to load.

const PURPLE = 0x7b4cf0;
const GREY = 0x3c3a47;

const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

function glossy(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });
}

export class Caller3D {
  // `shared` is { renderer, environment } from the character hub: many characters can then be drawn with one
  // WebGL renderer. Without it, the character makes (and draws with) a renderer of its own.
  constructor(canvas, { size = 420, shared = null, look = null, distance = 5.8 * 1.5, cameraY = -0.14 } = {}) {
    this.canvas = canvas;
    this.ownRenderer = !shared;
    if (shared) {
      this.renderer = shared.renderer;
    } else {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(size, size, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.92;
    }

    this.scene = new THREE.Scene();
    if (shared) {
      this.scene.environment = shared.environment;
    } else {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    this.scene.environmentIntensity = 0.7;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, cameraY, distance); // the caller's picture is 50% bigger than his box, so jumps are never cut off

    this.buildLights();
    this.buildCharacter();
    this.buildShadow();

    // ---- the state the animation moves towards ----
    this.expressionName = 'neutral';
    this.face = { ...EXPRESSIONS.neutral };
    this.target = { ...EXPRESSIONS.neutral };
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.roll = 0;
    this.rollVel = 0;
    this.jumpY = 0;
    this.jumpVel = 0;
    this.squash = 0; // positive = squashed flat, negative = stretched tall
    this.squashVel = 0;
    this.talking = false;
    this.spinT = 1; // 1 = not spinning
    this.spinAngle = 0;
    this.spinDir = 1;
    this.spinSeconds = 0.9;
    this.lid = 0; // how far his eyelids rest over his eyes (0 wide open ... 1 shut)
    this.heart = 0; // how much his eyes are love hearts
    this.heartTarget = 0;
    this.talkLevel = 0;
    this.talkTarget = 0;
    this.nextSyllable = 0;
    this.externalMouth = null; // set to 0..1 to drive the mouth from real audio
    this.blinkLeft = 0;
    this.nextBlink = 1.5;
    this.time = 0;
    this.lastDrawn = '';
    this.outfit = defaultLook('caller'); // the current look (not called 'look', which is the method that turns his head)
    this.setLook(look ?? this.outfit);
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff5ff, 0x8a72e8, 0.32));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-3.2, 4.2, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc5b3ff, 1.4);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc9b5ff, 0.7);
    fill.position.set(4, -2, 3);
    this.scene.add(fill);
  }

  buildCharacter() {
    this.root = new THREE.Group(); // moves up and down, squashes and stretches
    this.head = new THREE.Group(); // turns, tilts and nods
    this.root.add(this.head);
    this.scene.add(this.root);

    // The ball
    this.ballMaterial = glossy(0xf2e9ff, { sheen: 1, sheenColor: new THREE.Color(0xb79cff), sheenRoughness: 0.5, envMapIntensity: 1.3 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.ballMaterial);
    this.head.add(this.ball);

    // The face: a patch of the ball with the drawn face on it
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 1024;
    this.faceCanvas.height = Math.round(1024 * (FACE_SPAN.pitch / FACE_SPAN.yaw));
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    this.faceTexture.anisotropy = 4;
    this.faceMaterial = new THREE.MeshStandardMaterial({
      map: this.faceTexture, transparent: true, roughness: 0.28, metalness: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const patch = new THREE.SphereGeometry(1.004, 72, 48, Math.PI / 2 - FACE_SPAN.yaw / 2, FACE_SPAN.yaw, Math.PI / 2 - FACE_SPAN.pitch / 2, FACE_SPAN.pitch);
    this.head.add(new THREE.Mesh(patch, this.faceMaterial));

    // What the character wears (hat, glasses, neckwear) is rebuilt whenever the look changes.
    this.wardrobe = new THREE.Group();
    this.head.add(this.wardrobe);

    // Headset (the caller only): band over the top, ear cup on one side, microphone boom down to the mouth
    this.purpleMaterial = glossy(PURPLE, { roughness: 0.2 });
    this.headset = new THREE.Group();
    this.head.add(this.headset);
    this.greyMaterial = glossy(GREY, { roughness: 0.3 });
    const bandPoints = [];
    for (let a = 0.12; a <= 2.3; a += 0.17) {
      bandPoints.push(new THREE.Vector3(1.075 * Math.cos(a), 1.075 * Math.sin(a), -0.34 * Math.sin(a) * 1.075 + 0.02));
    }
    this.headset.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bandPoints), 80, 0.045, 14), this.greyMaterial));

    const cup = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 48), this.greyMaterial);
    housing.rotation.z = Math.PI / 2;
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 32), this.purpleMaterial);
    pad.scale.set(0.45, 1, 0.82);
    pad.position.x = 0.12;
    cup.add(housing, pad);
    cup.position.set(1.04, 0.02, -0.02);
    this.headset.add(cup);

    const boom = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.06, -0.2, 0.08),
      new THREE.Vector3(1.1, -0.42, 0.45),
      new THREE.Vector3(0.82, -0.56, 0.85),
      new THREE.Vector3(0.46, -0.52, 1.02),
    ]);
    this.headset.add(new THREE.Mesh(new THREE.TubeGeometry(boom, 50, 0.04, 12), this.greyMaterial));
    this.micMaterial = glossy(0x3b3a45, { roughness: 0.5, clearcoat: 0.4 });
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.12, 28, 20), this.micMaterial);
    mic.scale.set(1.5, 1, 1.1);
    mic.position.set(0.42, -0.52, 1.03);
    mic.rotation.y = 0.5;
    this.headset.add(mic);
  }

  buildShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
    grad.addColorStop(0, 'rgba(25, 10, 70, 0.55)');
    grad.addColorStop(0.6, 'rgba(25, 10, 70, 0.18)');
    grad.addColorStop(1, 'rgba(25, 10, 70, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -1.32;
    this.scene.add(this.shadow);
  }

  // ---- what the character looks like ----

  // Applies a look: ball colour, cheeks, eye style, and what they wear. Safe to call at any time.
  setLook(rawLook) {
    const look = cleanLook(rawLook);
    this.outfit = look;
    const ball = new THREE.Color(look.ball);
    this.ballMaterial.color.copy(ball);
    const hsl = {};
    ball.getHSL(hsl);
    this.ballMaterial.sheenColor = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.3), Math.max(0.45, hsl.l - 0.2));
    this.headset.visible = look.extras.includes('headset');
    for (const child of [...this.wardrobe.children]) {
      this.wardrobe.remove(child);
      child.traverse((node) => {
        node.geometry?.dispose?.();
        node.material?.dispose?.();
      });
    }
    for (const slot of ['hat', 'glasses', 'neck']) {
      const item = itemById(look[slot]);
      if (!item) continue;
      this.wardrobe.add(buildItem(item, look[`${slot}Colour`]));
    }
    this.lastDrawn = '';
    this.paintFace();
  }

  // ---- things the game can ask for ----
  setExpression(name) {
    if (!EXPRESSIONS[name]) return;
    this.expressionName = name;
    this.target = { ...EXPRESSIONS[name] };
  }

  look(yaw, pitch) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }

  talk(on) {
    this.talking = on;
    if (!on) this.talkTarget = 0;
  }

  spin(seconds = 0.9) {
    if (this.spinT < 1) return;
    this.spinT = 0;
    this.spinSeconds = seconds;
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.jump(2.2);
  }

  setLid(amount) {
    this.lid = amount;
  }

  // a little sideways wobble, like a giggle
  wobble(power = 3) {
    this.rollVel += (Math.random() < 0.5 ? -1 : 1) * power;
  }

  // Love-heart eyes for Valentine's Day.
  heartEyes(on) {
    this.heartTarget = on ? 1 : 0;
  }

  blink() {
    this.blinkLeft = 0.17;
  }

  jump(power = 3.4) {
    this.jumpVel = power;
  }

  shake() {
    this.rollVel = 7;
  }

  setStyle(style) {
    const matte = style === 'matte';
    this.ballMaterial.clearcoat = matte ? 0 : 1;
    this.ballMaterial.roughness = matte ? 0.65 : 0.22;
    this.purpleMaterial.clearcoat = matte ? 0 : 1;
    this.purpleMaterial.roughness = matte ? 0.6 : 0.2;
    this.greyMaterial.clearcoat = matte ? 0 : 1;
    this.scene.environmentIntensity = matte ? 0.4 : 0.85;
    this.ballMaterial.envMapIntensity = matte ? 0.5 : 1.1;
  }

  setGloss(amount) {
    this.ballMaterial.roughness = 0.5 - amount * 0.38;
    this.ballMaterial.clearcoat = amount;
    this.purpleMaterial.clearcoat = amount;
    this.purpleMaterial.roughness = 0.5 - amount * 0.32;
  }

  // ---- the animation, once a frame ----
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const t = this.time;

    // blinking
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink();
      this.nextBlink = Math.random() < 0.2 ? 0.28 : 2.2 + Math.random() * 3; // now and then a quick double blink
    }
    if (this.blinkLeft > 0) this.blinkLeft -= dt;
    const blinkAmount = this.blinkLeft > 0 ? Math.sin((this.blinkLeft / 0.17) * Math.PI) : 0;

    // talking: little syllables, or the real loudness of the voice if the game supplies it
    if (this.talking) {
      this.nextSyllable -= dt;
      if (this.nextSyllable <= 0) {
        this.talkTarget = Math.random() < 0.22 ? 0.05 : 0.3 + Math.random() * 0.7;
        this.nextSyllable = 0.07 + Math.random() * 0.1;
      }
    }
    const mouthGoal = this.externalMouth ?? this.talkTarget;
    this.talkLevel = damp(this.talkLevel, mouthGoal, 34, dt); // quick, so the mouth closes between words

    this.heart = damp(this.heart, this.heartTarget, 6, dt);

    // the face moves towards the wanted expression
    for (const key of Object.keys(this.target)) this.face[key] = damp(this.face[key], this.target[key], 12, dt);
    const faceNow = {
      ...this.face,
      eyeOpen: (1 - this.lid) * (1 - blinkAmount * 0.95),
      eyeHeart: this.heart * (1 - blinkAmount * 0.9) * (1 + Math.sin(t * 5) * 0.06),
      // while speaking, the mouth rests nearly closed between sounds so each word is shaped clearly
      mouthOpen: Math.min(1, this.face.mouthOpenBase * (this.talking || this.externalMouth !== null ? 0.12 : 1) + this.talkLevel),
      pupilX: this.lookYaw * 1.2,
      pupilY: this.lookPitch * -1.2,
    };
    this.paintFace(faceNow);

    // a full turn all the way round, with a little hop
    if (this.spinT < 1) {
      this.spinT = Math.min(1, this.spinT + dt / this.spinSeconds);
      const e = this.spinT * this.spinT * (3 - 2 * this.spinT);
      this.spinAngle = e * Math.PI * 2 * this.spinDir;
      if (this.spinT >= 1) this.spinAngle = 0;
    }

    // head: follows where it is asked to look, with a little life of its own
    this.lookYaw = damp(this.lookYaw, this.targetYaw, 7, dt);
    this.lookPitch = damp(this.lookPitch, this.targetPitch, 7, dt);
    this.rollVel += (-this.roll * 70 - this.rollVel * 7) * dt; // a spring, for a wobble after a shake
    this.roll += this.rollVel * dt;
    const talkNod = this.talking ? Math.sin(t * 7.5) * 0.02 * this.talkLevel : 0;
    this.head.rotation.y = -0.06 + this.lookYaw + this.spinAngle + Math.sin(t * 0.7) * 0.025;
    this.head.rotation.x = this.lookPitch + Math.sin(t * 1.1) * 0.015 + talkNod;
    this.head.rotation.z = this.roll + Math.sin(t * 0.9) * 0.012;

    // jumping, squashing and stretching
    this.jumpVel -= 11 * dt;
    this.jumpY += this.jumpVel * dt;
    if (this.jumpY <= 0) {
      if (this.jumpVel < -1.2) this.squashVel = this.jumpVel * -1.1; // landing squashes him flat
      this.jumpY = 0;
      this.jumpVel = 0;
    }
    this.squashVel += (-this.squash * 150 - this.squashVel * 9) * dt;
    this.squash += this.squashVel * dt;
    const airborne = this.jumpY > 0 ? Math.min(0.18, this.jumpVel * 0.03) : 0;
    const breathe = Math.sin(t * 2.1) * 0.012;
    const sy = 1 + breathe + airborne - this.squash * 0.2;
    const sxz = 1 - breathe * 0.5 - airborne * 0.5 + this.squash * 0.12;
    this.root.scale.set(sxz, sy, sxz);
    this.root.position.y = Math.sin(t * 1.7) * 0.02 + this.jumpY + (sy - 1) * 1 - 0.02;
    const shadowScale = 1 - Math.min(0.5, this.jumpY * 0.25);
    this.shadow.scale.setScalar(shadowScale);
    this.shadow.material.opacity = 0.5 + shadowScale * 0.5;

    if (this.ownRenderer) this.renderer.render(this.scene, this.camera);
  }

  // Draws this character with the shared renderer, which the caller of this has already sized.
  renderShared() {
    this.renderer.render(this.scene, this.camera);
  }

  paintFace(params = { ...this.face, eyeOpen: 1, mouthOpen: this.face.mouthOpenBase, pupilX: 0, pupilY: 0 }) {
    // only redraw when something visibly changed
    const key = `${this.outfit.eyes}${this.outfit.cheeks}${this.outfit.ball}|${Object.values(params).map((v) => Math.round(v * 120)).join(',')}`;
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;
    drawFace(this.faceCtx, this.faceCanvas.width, this.faceCanvas.height, params, { cheeks: this.outfit.cheeks, eyes: this.outfit.eyes, ball: this.outfit.ball });
    this.faceTexture.needsUpdate = true;
  }
}

export { EXPRESSIONS, blendExpressions };
