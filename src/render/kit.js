import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as A from './assets.js';

// Gebäude aus Kenney-Bauteilen. Ein Bauteil-Feld ist 1x1, Wände stehen an der +x-Kante.
// Die Vorderseite (Tür) zeigt nach +z, wie bei den bisherigen Modellen.
const SIDE = { px: 0, nz: Math.PI / 2, nx: Math.PI, pz: -Math.PI / 2 };

function part(key, x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const m = A.model(`town/${key}`);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.scale.setScalar(s);
  return m;
}

// Nachts leuchtendes Fensterlicht vor einem Fenster-Bauteil
let glowMat = null;
export function setGlowMaterial(m) { glowMat = m; }
const glowGeo = new THREE.PlaneGeometry(0.28, 0.32).rotateY(Math.PI / 2);

function wallPiece(key, x, y, z, ry) {
  const g = new THREE.Group();
  g.add(part(key));
  if (glowMat && key.includes('window')) {
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0.515, 0.55, 0);
    g.add(glow);
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

function nature(key, x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const m = A.model(`nature/${key}`);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.scale.setScalar(s);
  return m;
}

// Haus aus Zellen entlang x; floors: Wandschlüssel je Stockwerk
function house({ width = 1, floors, door, window, roof, roofColor = 'red', chimney = false, ridgeAlongX = true }) {
  const g = new THREE.Group();
  const cells = Array.from({ length: width }, (_, i) => i - (width - 1) / 2);
  floors.forEach((wall, f) => {
    const y = f;
    cells.forEach((cx, i) => {
      const front = f === 0 && i === Math.floor((width - 1) / 2) ? door : window;
      g.add(wallPiece(front, cx, y, 0, SIDE.pz));
      g.add(wallPiece(f === 0 ? wall : window, cx, y, 0, SIDE.nz));
      if (i === 0) g.add(wallPiece(width === 1 ? window : wall, cx, y, 0, SIDE.nx));
      if (i === cells.length - 1) g.add(wallPiece(f === 0 && width > 1 ? window : wall, cx, y, 0, SIDE.px));
    });
  });
  const top = floors.length;
  cells.forEach((cx) => {
    const r = part(roof, cx, top, 0, ridgeAlongX ? 0 : Math.PI / 2);
    r.traverse((o) => { if (o.isMesh) o.material = A.roofMaterial(roofColor, o.material); });
    g.add(r);
  });
  if (chimney) g.add(part('chimney', cells.at(-1), top - 0.2, -0.15, 0));
  return g;
}

// Maßstab: ein Bauteil-Feld (1) entspricht 0,72 Spielfeldern
export const S = 0.72;

function scaled(inner) {
  const g = new THREE.Group();
  inner.scale.setScalar(S);
  g.add(inner);
  return g;
}

export function kitBuilding(type, level) {
  const stone = 'wall', wood = 'wall-wood';
  const up = (n) => Math.min(n, level);
  let inner;
  const extras = [];
  switch (type) {
    case 'warehouse':
      inner = house({
        width: 2, floors: level >= 2 ? [stone, wood] : [stone],
        door: 'wall-door', window: 'wall-window-shutters', roof: level >= 3 ? 'roof-high-gable' : 'roof-gable',
      });
      extras.push(part('stall-red', 0.95, 0, 0.1, 0, 0.7), nature('log_stack', -1.0, 0, 0.3, 0, 0.9));
      break;
    case 'house':
      inner = house({
        floors: level >= 2 ? [stone, wood] : [stone], door: 'wall-door', window: 'wall-window-shutters',
        roof: level >= 3 ? 'roof-high-gable' : 'roof-gable', chimney: true,
      });
      break;
    case 'builderhut':
      inner = house({ floors: [wood].concat(up(2) >= 2 ? [wood] : []), door: 'wall-wood-door', window: 'wall-wood-window-small', roof: 'roof-point', roofColor: 'brown' });
      extras.push(part('planks', 0.75, 0, 0.3, 0.3, 0.5));
      break;
    case 'woodcutter':
      inner = house({ floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'thatch' });
      extras.push(nature('log_stackLarge', 0.75, 0, 0, Math.PI / 2, 0.9), nature('stump_round', -0.7, 0, 0.55, 0, 1));
      break;
    case 'quarry':
      inner = house({ floors: [stone], door: 'wall-door', window: 'wall-window-small', roof: 'roof-point', roofColor: 'brown' });
      extras.push(nature('rock_smallA', 0.75, 0, 0.3, 0, 1.2), nature('rock_smallB', 0.8, 0, -0.1, 1, 1));
      break;
    case 'gatherer':
      inner = house({ floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-small', roof: 'roof-point', roofColor: 'thatch' });
      extras.push(nature('plant_bushDetailed', 0.75, 0, 0.35, 0, 1));
      break;
    case 'fisher':
      inner = house({ floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-small', roof: 'roof-gable', roofColor: 'brown' });
      extras.push(part('planks', 0.72, 0.02, 0.1, 0, 0.45));
      break;
    case 'sawmill':
      inner = house({ width: 2, floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'brown' });
      extras.push(nature('log_stackLarge', -1.15, 0, 0.35, Math.PI / 2, 0.9), part('planks', 1.15, 0, 0.3, 0, 0.6));
      break;
    case 'toolmaker':
      inner = house({ floors: [stone], door: 'wall-door', window: 'wall-window-small', roof: 'roof-gable', roofColor: 'red', chimney: true });
      break;
    case 'oremine':
    case 'coalmine':
      inner = house({ floors: [stone], door: 'wall-door', window: 'wall-window-small', roof: 'roof-point', roofColor: 'brown' });
      extras.push(nature('rock_tallA', -0.8, 0, -0.45, 0.6, 1.3), nature('rock_largeB', 0.85, 0, -0.35, 2, 0.9), part('cart', 0.85, 0, 0.45, Math.PI / 2, 0.55));
      break;
    case 'smelter':
      inner = house({ floors: [stone], door: 'wall-door', window: 'wall-window-small', roof: 'roof-point', roofColor: 'red', chimney: true });
      extras.push(nature('rock_smallA', 0.8, 0, 0.35, 0, 1.1), nature('log_stack', -0.85, 0, 0.3, 0, 0.8));
      break;
    case 'market':
      inner = house({ floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'red' });
      extras.push(part('stall-red', 0.75, 0, 1.0, 0, 0.6), part('stall-red', -0.75, 0, 1.0, 0, 0.6));
      break;
    case 'townhall':
      inner = house({
        width: 2, floors: [stone, stone, wood], door: 'wall-door', window: 'wall-window-shutters', roof: 'roof-high-gable', roofColor: 'red',
      });
      extras.push(part('stall-red', 1.25, 0, 0.75, 0, 0.45));
      break;
    case 'tavern':
      inner = house({ width: 2, floors: [stone, wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'brown', chimney: true });
      extras.push(nature('log_stack', 1.2, 0, 0.45, 0, 0.6), part('planks', -1.2, 0, 0.5, 0.3, 0.45));
      break;
    case 'chapel': {
      inner = house({ floors: [stone, stone], door: 'wall-door', window: 'wall-window-small', roof: 'roof-high-gable', roofColor: 'brown' });
      // Glockenturm hinten
      const bell = house({ floors: [stone, stone, stone], door: stone, window: 'wall-window-small', roof: 'roof-point', roofColor: 'red' });
      bell.scale.setScalar(0.55);
      bell.position.set(0, 0, -0.75);
      inner.add(bell);
      break;
    }
    case 'tower':
      inner = house({ floors: [stone, stone].concat(level >= 2 ? [stone] : []).concat(level >= 3 ? [wood] : []), door: 'wall-door', window: 'wall-window-small', roof: 'roof-point', roofColor: 'red' });
      break;
    case 'sheepfarm':
      inner = house({ floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'thatch' });
      break;
    case 'farm':
      inner = house({ width: 2, floors: [wood], door: 'wall-wood-door', window: 'wall-wood-window-shutters', roof: 'roof-gable', roofColor: 'thatch' });
      break;
    case 'mill':
      inner = house({ floors: [stone, stone].concat(level >= 3 ? [wood] : []), door: 'wall-door', window: 'wall-window-small', roof: 'roof-point', roofColor: 'brown' });
      break;
    case 'bakery':
      inner = house({ floors: [stone], door: 'wall-door', window: 'wall-window-shutters', roof: 'roof-gable', chimney: true });
      break;
    default:
      return null;
  }
  if (level >= 2 && !['warehouse', 'house', 'mill', 'tower', 'townhall', 'tavern'].includes(type)) {
    const annex = house({ floors: ['wall-wood'], door: 'wall-wood', window: 'wall-wood', roof: 'roof-point', roofColor: 'brown' });
    annex.scale.setScalar(0.6);
    annex.position.set(-0.85, 0, -0.3);
    inner.add(annex);
  }
  const parts = scaled(inner);
  for (const e of extras) {
    e.position.multiplyScalar(S);
    e.scale.multiplyScalar(S);
    parts.add(e);
  }
  const g = mergeStatic(parts);
  if (type === 'mill') {
    const blades = new THREE.Group();
    const sails = A.model('town/windmill');
    sails.rotation.y = Math.PI / 2;
    sails.scale.setScalar(0.42);
    blades.add(sails);
    blades.position.set(0, (2 + (level >= 3 ? 1 : 0)) * S - 0.25, 0.55 * S);
    g.add(blades);
    g.userData.blades = blades;
  }
  return g;
}

// Fasst alle unbewegten Teile eines Gebäudes zu einem Mesh je Material zusammen (weniger Zeichenaufrufe)
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = material.transparent !== true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

export function kitCart() {
  const cart = A.model('town/cart');
  cart.scale.setScalar(0.55);
  return cart;
}
