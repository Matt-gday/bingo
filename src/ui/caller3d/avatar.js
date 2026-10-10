import * as THREE from 'three';
import avatarData from '../../../Data/avatar.json';

// Builds the extras a character can wear (hats, glasses, neckwear) from the simple shapes listed in
// Data/avatar.json, so a new item only needs an entry there.

export const SLOTS = ['hat', 'glasses', 'neck'];

export function itemById(id) {
  return avatarData.items.find((item) => item.id === id) ?? null;
}

export function defaultLook(kind) {
  return { ...avatarData.defaults[kind], extras: [...(avatarData.defaults[kind].extras ?? [])] };
}

// A look is { ball, cheeks, eyes, hat, glasses, neck, neckColour?, hatColour?, glassesColour?, extras }. Anything
// missing or unknown is replaced by something safe, so a damaged saved look can never break the game.
export function cleanLook(look = {}) {
  const base = avatarData.defaults.player;
  const hex = (value, fallback) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
  const slot = (id, kind) => (id && itemById(id)?.slot === kind ? id : null);
  return {
    ball: hex(look.ball, base.ball),
    cheeks: hex(look.cheeks, base.cheeks),
    eyes: avatarData.eyes.some((e) => e.id === look.eyes) ? look.eyes : base.eyes,
    hat: slot(look.hat, 'hat'),
    glasses: slot(look.glasses, 'glasses'),
    neck: slot(look.neck, 'neck'),
    hatColour: hex(look.hatColour, null),
    glassesColour: hex(look.glassesColour, null),
    neckColour: hex(look.neckColour, null),
    extras: Array.isArray(look.extras) ? look.extras.filter((x) => x === 'headset') : [],
  };
}

const finishFor = (finish, colour) => {
  if (finish === 'matte') return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85, metalness: 0 });
  if (finish === 'metal') return new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.28, metalness: 0.85, clearcoat: 0.6 });
  return new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
};

// The bow shape the caller has always worn, scaled by `size`.
function bowGeometry() {
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.lineTo(0.52, 0.3);
  wing.quadraticCurveTo(0.62, 0, 0.52, -0.3);
  wing.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 10, curveSegments: 32 });
}

function bowGroup(material, size) {
  const group = new THREE.Group();
  const geometry = bowGeometry();
  const right = new THREE.Mesh(geometry, material);
  const left = new THREE.Mesh(geometry, material);
  left.scale.x = -1;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), material);
  knot.scale.set(1.1, 1, 0.95);
  knot.position.z = 0.1;
  group.add(left, right, knot);
  group.scale.setScalar(size);
  return group;
}

// The hanging part of a long tie: thin under the knot, widening to a pointed bottom.
function tieGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.07, 0);
  shape.lineTo(0.07, 0);
  shape.lineTo(0.2, -0.62);
  shape.lineTo(0, -0.98);
  shape.lineTo(-0.2, -0.62);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 4 });
}

function geometryFor(part) {
  const a = part.args ?? [];
  switch (part.shape) {
    case 'sphere': return new THREE.SphereGeometry(a[0] ?? 0.2, 40, 28);
    case 'hemisphere': return new THREE.SphereGeometry(a[0] ?? 1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'cylinder': return new THREE.CylinderGeometry(a[0] ?? 0.5, a[1] ?? 0.5, a[2] ?? 1, a[3] ?? 32);
    case 'cone': return new THREE.ConeGeometry(a[0] ?? 0.5, a[1] ?? 1, a[2] ?? 32);
    case 'torus': return new THREE.TorusGeometry(a[0] ?? 0.5, a[1] ?? 0.05, 16, a[2] ?? 40);
    case 'box': return new THREE.BoxGeometry(a[0] ?? 1, a[1] ?? 1, a[2] ?? 1, 1, 1, 1);
    case 'tie': return tieGeometry();
    default: return null;
  }
}

// Builds one item as a group that sits on the head. `primary` is the colour the player picked for it.
export function buildItem(item, primary) {
  const group = new THREE.Group();
  const colour = primary ?? item.colours?.[0] ?? '#ffffff';
  for (const part of item.parts) {
    const tint = part.colour === 'primary' ? colour : part.colour ?? colour;
    const material = finishFor(part.finish, tint);
    let object;
    if (part.shape === 'bow') {
      object = bowGroup(material, part.args?.[0] ?? 0.6);
    } else if (part.shape === 'headband') {
      // a band over the top of the head from ear to ear
      const [radius, tube] = part.args;
      object = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 14, 60, Math.PI), material);
      object.rotation.set(0, 0, 0);
    } else {
      const geometry = geometryFor(part);
      if (!geometry) continue;
      object = new THREE.Mesh(geometry, material);
    }
    const [px, py, pz] = part.pos ?? [0, 0, 0];
    object.position.set(px, py, pz);
    if (part.rot) object.rotation.set(...part.rot);
    if (part.scale) object.scale.multiply(new THREE.Vector3(...part.scale));
    group.add(object);
  }
  return group;
}
