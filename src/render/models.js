import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS } from '../config.js';
import * as A from './assets.js';
import { kitBuilding, S, setGlowMaterial } from './kit.js';

const matCache = new Map();
export function mat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    matCache.set(color, m);
  }
  return m;
}

const C = {
  plaster: '#ece0c4', timber: '#8a5a32', darkWood: '#5b3a1e', roofRed: '#b3472f',
  thatch: '#c9a24a', stone: '#a29f96', skin: '#f0c39b', foundation: '#8f8a80',
};

export const ITEM_COLORS = {
  wood: '#8a5a32', stone: '#a29f96', food: '#c6283c', grain: '#e3c25a', flour: '#f4f1e8', bread: '#b8743a', planks: '#d9b07a', tools: '#6f7680', ore: '#b0684a', coal: '#2e2b29', iron: '#8d949c',
};
export const JOB_COLORS = {
  null: '#7a6a55', Träger: '#b5782f', Bauarbeiter: '#9b3b2a', Bauer: '#6b8f3a', Müller: '#d8d2c4', Bäcker: '#f0ebe0', Holzfäller: '#3f7d3a', Steinmetz: '#6f7378', Sammler: '#a8467a', Fischer: '#2f69b0', Säger: '#9a6a3a', Werkzeugmacher: '#4f4a46', Schäfer: '#7a8a4a', Bergmann: '#5a5048', Schmelzer: '#7a3a2a', Händler: '#3f6fb0',
};
const HAT_COLORS = {
  null: '#c9a24a', Träger: '#6b4a1e', Bauarbeiter: '#e8c440', Bauer: '#e8d27a', Müller: '#ffffff', Bäcker: '#ffffff', Holzfäller: '#2c5a28', Steinmetz: '#4a4d52', Sammler: '#d8c070', Fischer: '#e0d4b0', Säger: '#c9a77a', Werkzeugmacher: '#2e2a28', Schäfer: '#c9b27a', Bergmann: '#e8c440', Schmelzer: '#3a3634', Händler: '#a0703f',
};

const shared = (g) => { g.userData.shared = true; return g; };

// Gemeinsames Fenstermaterial; nachts lässt die Tag/Nacht-Steuerung es leuchten
export const windowMat = new THREE.MeshBasicMaterial({ color: '#ffc56b', transparent: true, opacity: 0, depthWrite: false });
setGlowMaterial(windowMat);
function windowBox(x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.02), windowMat);
  m.position.set(x, y, z);
  return m;
}

export const geoms = {
  trunk: shared(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 5).translate(0, 0.2, 0)),
  pine: shared(mergeGeometries([
    new THREE.ConeGeometry(0.38, 0.6, 6).translate(0, 0.6, 0),
    new THREE.ConeGeometry(0.28, 0.5, 6).translate(0, 0.95, 0),
  ])),
  round: shared(new THREE.IcosahedronGeometry(0.34, 0).translate(0, 0.68, 0)),
  rock: shared(new THREE.DodecahedronGeometry(0.32, 0).translate(0, 0.15, 0)),
  bush: shared(new THREE.IcosahedronGeometry(0.24, 0).translate(0, 0.2, 0)),
  berry: shared(new THREE.IcosahedronGeometry(0.05, 0)),
  ring: shared(new THREE.RingGeometry(0.18, 0.26, 16).rotateX(-Math.PI / 2)),
};

// Dreiecksprisma, First entlang x, Grundfläche 1x1, Höhe 1
const roofGeom = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.5, 0);
  g.scale(1, 1 / 1.5, 1 / Math.sqrt(3));
  return shared(g);
})();

function mesh(geom, color) {
  const m = new THREE.Mesh(geom, mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color);
  m.position.set(x, y + h / 2, z);
  return m;
}

function cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color);
  m.position.set(x, y + h / 2, z);
  return m;
}

function roof(w, d, h, color, y) {
  const m = mesh(roofGeom, color);
  m.scale.set(w, h, d);
  m.position.y = y;
  return m;
}

function hut(w, d, wallH, roofH, wallColor, roofColor) {
  const g = new THREE.Group();
  g.add(box(w, wallH, d, wallColor));
  g.add(roof(w + 0.14, d + 0.18, roofH, roofColor, wallH));
  g.add(box(0.16, 0.26, 0.02, C.darkWood, 0, 0, d / 2 + 0.005));
  if (w >= 0.6) g.add(windowBox(w / 2 - 0.16, wallH * 0.55, d / 2 + 0.006));
  // Fachwerk-Balken an den Ecken
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(box(0.05, wallH, 0.05, C.timber, (sx * w) / 2, 0, (sz * d) / 2));
  return g;
}

function foundation(w, d) {
  return box(w, 0.4, d, C.foundation, 0, -0.35, 0);
}

function logPile(x, z) {
  const g = new THREE.Group();
  const positions = [[-0.08, 0.05], [0.08, 0.05], [0, 0.15]];
  for (const [px, py] of positions) {
    const log = cyl(0.06, 0.06, 0.4, 6, C.timber);
    log.rotation.x = Math.PI / 2;
    log.position.set(px, py, 0);
    g.add(log);
  }
  g.position.set(x, 0, z);
  return g;
}

const ROOF = { townhall: C.roofRed, oremine: '#6d6a64', coalmine: '#6d6a64', smelter: C.roofRed, market: C.roofRed, tower: C.roofRed, sheepfarm: C.thatch, warehouse: C.roofRed, builderhut: '#7a5230', farm: C.thatch, mill: '#8a5a32', bakery: C.roofRed, woodcutter: C.thatch, quarry: '#6d6a64', gatherer: C.thatch, fisher: '#5d7d95', house: C.roofRed };
const LEVEL_FLAG = [null, '#3f6fb0', '#e6b34a'];

function annex(x, z, roofColor) {
  const g = hut(0.38, 0.36, 0.3, 0.22, '#d9c7a0', roofColor);
  g.position.set(x, 0, z);
  return g;
}

function flag(color) {
  const g = new THREE.Group();
  g.add(box(0.025, 0.95, 0.025, C.darkWood));
  g.add(box(0.02, 0.14, 0.22, color, 0, 0.78, 0.11));
  g.position.set(-0.46, 0, 0.42);
  return g;
}

function scaffold() {
  const g = new THREE.Group();
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(box(0.04, 1.05, 0.04, '#b08a5a', sx * 0.56, 0, sz * 0.5));
  for (const y of [0.4, 0.8]) {
    for (const sz of [-1, 1]) g.add(box(1.14, 0.03, 0.03, '#b08a5a', 0, y, sz * 0.5));
    for (const sx of [-1, 1]) g.add(box(0.03, 0.03, 1.02, '#b08a5a', sx * 0.56, y, 0));
  }
  return g;
}

// Warenstapel neben der Hütte bzw. Kisten am Lager; Sichtbarkeit setzt der Renderer
function pile(color, positions) {
  const geos = positions.map(([x, y, z]) => new THREE.BoxGeometry(0.11, 0.1, 0.11).translate(x, y + 0.05, z).toNonIndexed());
  const m = new THREE.Mesh(mergeGeometries(geos), mat(color));
  m.castShadow = true;
  m.userData.perItem = geos[0].attributes.position.count;
  return m;
}

// Zeigt die ersten n Kisten eines Stapels
export function showCount(pileMesh, n) {
  const k = Math.max(0, Math.min(n, 8));
  pileMesh.geometry.setDrawRange(0, k * pileMesh.userData.perItem);
  pileMesh.visible = k > 0;
}

const PILE_POS = Array.from({ length: 8 }, (_, i) => [-0.62 + (i % 2) * 0.12, Math.floor(i / 4) * 0.1, 0.05 + (Math.floor(i / 2) % 2) * 0.13]);
const CRATE_POS = Array.from({ length: 8 }, (_, i) => [-0.2 + (i % 4) * 0.14, Math.floor(i / 4) * 0.1, -0.7]);

// Eigene Modelle aus Blender (blender/*.py nach Marcos Entwürfen): Datei, Maßstab,
// Schornstein für Rauch und Versatz des Warenstapels nach vorn (in Spielkoordinaten)
const CUSTOM = {
  townhall: { file: 'townhall', scale: 0.38 },
  oremine: { file: 'mine_ore', scale: 0.35, pile: [0.55, 0.5] },
  coalmine: { file: 'mine_coal', scale: 0.35, pile: [0.55, 0.5] },
  smelter: { file: 'smelter', scale: 0.35, pile: [0.55, 0.55], chimney: [0.26, 1.0, 0.19] },
  market: { file: 'market', scale: 0.35 },
  sheepfarm: { file: 'sheepfarm', scale: 0.35, pile: [0.55, 0.5] },
  tavern: { file: 'tavern', scale: 0.34, chimney: [0.24, 1.1, -0.12] },
  chapel: { file: 'chapel', scale: 0.34 },
  plaza: { file: 'plaza', scale: 0.38 },
  monument: { file: 'monument', scale: 0.36 },
};

function customBuilding(type) {
  const c = CUSTOM[type];
  if (!c || !A.has(`custom/${c.file}`)) return null;
  const g = new THREE.Group();
  const m = A.model(`custom/${c.file}`);
  m.scale.setScalar(c.scale);
  g.add(m);
  if (c.chimney) g.userData.chimney = new THREE.Vector3(...c.chimney);
  return g;
}

export function buildingModel(type, level = 1, upgrading = false) {
  if (type === 'well') return wellModel();
  const custom = customBuilding(type);
  if (!custom && type === 'monument') return monumentModel();
  if (!custom && type === 'plaza') return plazaModel();
  const kit = !custom && A.has('town/wall') ? kitBuilding(type, level) : null;
  const g = custom || kit || new THREE.Group();
  const lift = (level - 1) * 0.16;
  if (kit) {
    g.add(type === 'warehouse' || type === 'farm' ? foundation(1.6, 0.9) : foundation(0.95, 0.9));
    if (type === 'toolmaker') {
      g.add(box(0.16, 0.12, 0.1, '#4a4d52', 0.62, 0, 0.3));
      g.add(box(0.22, 0.05, 0.1, '#5d6066', 0.62, 0.12, 0.3));
    }
    if (type === 'house' || type === 'bakery' || type === 'toolmaker') {
      const floors = type === 'house' && level >= 2 ? 2 : 1;
      g.userData.chimney = new THREE.Vector3(0.32 * S, (floors + 0.85) * S, -0.15 * S);
    }
  }
  switch (kit || custom ? null : type) {
    case 'warehouse': {
      g.add(foundation(1.5, 1.15));
      g.add(hut(1.3, 0.95, 0.62 + lift, 0.48, C.plaster, C.roofRed));
      g.add(box(0.22, 0.22, 0.22, C.timber, 0.55, 0, 0.66));
      g.add(box(0.18, 0.18, 0.18, '#a0703f', 0.33, 0, 0.7));
      g.add(cyl(0.09, 0.09, 0.22, 8, '#6e4423', -0.55, 0, 0.66));
      g.add(cyl(0.09, 0.09, 0.22, 8, '#6e4423', -0.35, 0, 0.7));
      break;
    }
    case 'builderhut': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.85, 0.72, 0.42 + lift * 0.5, 0.36, '#c9a77a', '#7a5230'));
      for (let i = 0; i < 4; i++) g.add(box(0.5, 0.04, 0.09, '#d1a66a', 0.12, i * 0.045, 0.55 + (i % 2) * 0.1));
      g.add(box(0.04, 0.16, 0.04, C.timber, -0.5, 0, 0.38));
      g.add(box(0.04, 0.16, 0.04, C.timber, -0.5, 0, 0.58));
      g.add(box(0.06, 0.04, 0.28, C.timber, -0.5, 0.16, 0.48));
      break;
    }
    case 'farm': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.7, 0.62, 0.4, 0.34, '#e2d2a8', C.thatch));
      const barn = hut(0.42, 0.5, 0.36, 0.3, '#9b4a32', '#6e3a26');
      barn.position.set(0.48, 0, -0.18);
      g.add(barn);
      const hay = mesh(new THREE.ConeGeometry(0.14, 0.24, 7), '#e3c25a');
      hay.position.set(-0.5, 0.12, 0.38);
      g.add(hay);
      break;
    }
    case 'mill': {
      g.add(foundation(0.9, 0.9));
      g.add(cyl(0.26, 0.36, 0.95 + lift, 8, '#ece0c4'));
      const cap = mesh(new THREE.ConeGeometry(0.32, 0.32, 8), '#8a5a32');
      cap.position.y = 0.95 + lift + 0.16;
      g.add(cap);
      g.add(box(0.14, 0.24, 0.02, C.darkWood, 0, 0, 0.33));
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.add(box(0.04, 0.62, 0.02, C.timber, 0, 0.02, 0));
        arm.add(box(0.13, 0.42, 0.01, '#f4f1e8', 0.085, 0.2, 0));
        arm.rotation.z = (i * Math.PI) / 2;
        blades.add(arm);
      }
      blades.position.set(0, 0.8 + lift, 0.4);
      g.add(blades);
      g.userData.blades = blades;
      break;
    }
    case 'bakery': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.8, 0.7, 0.44, 0.36, '#ece0c4', C.roofRed));
      const oven = mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#a8603a');
      oven.position.set(-0.55, 0, 0.2);
      g.add(oven);
      g.add(box(0.1, 0.36, 0.1, '#8a8580', 0.22, 0.55, -0.1));
      g.userData.chimney = new THREE.Vector3(0.22, 0.94, -0.1);
      break;
    }
    case 'woodcutter': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.8, 0.7, 0.42, 0.36, '#c9a77a', C.thatch));
      g.add(logPile(0.58, 0.1));
      g.add(cyl(0.09, 0.1, 0.12, 7, C.timber, -0.5, 0, 0.42));
      break;
    }
    case 'quarry': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.8, 0.7, 0.4, 0.3, C.stone, '#6d6a64'));
      g.add(box(0.2, 0.14, 0.2, C.stone, 0.55, 0, 0.35));
      g.add(box(0.16, 0.12, 0.16, '#8f8c84', 0.6, 0, 0.1));
      g.add(box(0.14, 0.1, 0.14, '#b6b3aa', 0.56, 0.14, 0.33));
      break;
    }
    case 'gatherer': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.75, 0.7, 0.4, 0.36, '#d8c49a', C.thatch));
      g.add(cyl(0.12, 0.09, 0.14, 8, '#b08850', 0.52, 0, 0.42));
      for (let i = 0; i < 3; i++) {
        const b = mesh(geoms.berry, '#c6283c');
        b.position.set(0.48 + i * 0.05, 0.16, 0.4 + (i % 2) * 0.04);
        g.add(b);
      }
      break;
    }
    case 'fisher': {
      g.add(foundation(1.0, 0.9));
      g.add(hut(0.75, 0.65, 0.4, 0.32, '#b9a27e', '#5d7d95'));
      g.add(box(0.04, 0.4, 0.04, C.timber, 0.5, 0, 0.15));
      g.add(box(0.04, 0.4, 0.04, C.timber, 0.5, 0, 0.45));
      g.add(box(0.03, 0.03, 0.34, C.timber, 0.5, 0.38, 0.3));
      for (let i = 0; i < 2; i++) g.add(box(0.03, 0.12, 0.06, '#9fb6c4', 0.5, 0.24, 0.22 + i * 0.15));
      break;
    }
    case 'house': {
      g.add(foundation(1.05, 0.95));
      g.add(hut(0.9, 0.78, 0.5 + lift, 0.42, C.plaster, C.roofRed));
      g.add(box(0.1, 0.32, 0.1, '#8a8580', 0.24, 0.55 + lift, -0.12));
      if (level >= 2) {
        g.add(box(0.14, 0.12, 0.02, '#4a6b8a', -0.26, 0.5, 0.395));
        g.add(box(0.14, 0.12, 0.02, '#4a6b8a', 0.26, 0.5, 0.395));
      }
      g.add(box(0.14, 0.12, 0.02, '#4a6b8a', -0.26, 0.22, 0.395));
      g.add(box(0.14, 0.12, 0.02, '#4a6b8a', 0.26, 0.22, 0.395));
      break;
    }
  }

  if (!kit && !custom && type !== 'house' && type !== 'warehouse' && level >= 2) g.add(annex(-0.5, -0.32, ROOF[type]));
  if (!kit && !custom && type !== 'house' && level >= 3) g.add(annex(0.52, -0.34, ROOF[type]));
  if (type === 'sheepfarm' && !custom) g.add(fence());
  if ((type === 'tower' || type === 'townhall') && kit) g.add(towerFlag(type === 'townhall' ? 3 : level));
  if (LEVEL_FLAG[level - 1]) g.add(flag(LEVEL_FLAG[level - 1]));
  if (upgrading) g.add(scaffold());

  if (type === 'warehouse') {
    g.userData.crates = pile('#a0703f', CRATE_POS);
    g.add(g.userData.crates);
  } else if (BUILDINGS[type].produces) {
    g.userData.pile = pile(ITEM_COLORS[BUILDINGS[type].produces], PILE_POS);
    if (custom && CUSTOM[type].pile) g.userData.pile.position.set(CUSTOM[type].pile[0], 0, CUSTOM[type].pile[1]);
    g.add(g.userData.pile);
  }
  return g;
}

// Feld: Acker mit Furchen, darauf Halme, die wachsen und reifen
const cropGeom = shared(mergeGeometries(
  Array.from({ length: 16 }, (_, i) => new THREE.BoxGeometry(0.05, 0.3, 0.05)
    .translate(-0.33 + (i % 4) * 0.22, 0.15, -0.33 + Math.floor(i / 4) * 0.22)),
));
const GREEN = new THREE.Color('#6fa83a'), GOLD = new THREE.Color('#e0b84a');

// 2x2 Weizenbüschel als ein Mesh je Material, einmal gebaut und von allen Feldern geteilt
const cropCache = {};
function cropPatch(key) {
  if (!cropCache[key]) {
    const k = 0.42 / A.size(key).x;
    const byMat = new Map();
    for (const { geometry, material } of A.flatten(key)) {
      for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
        const geo = geometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(k, k, k).setPosition(dx, 0.05, dz));
        if (!byMat.has(material)) byMat.set(material, []);
        byMat.get(material).push(geo.index ? geo.toNonIndexed() : geo);
      }
    }
    cropCache[key] = [...byMat].map(([material, geos]) => [shared(mergeGeometries(geos)), material]);
  }
  const g = new THREE.Group();
  for (const [geometry, material] of cropCache[key]) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// Acker mit Furchen als ein gemeinsames Mesh
let soilGeom = null;
function soilMesh() {
  soilGeom ||= shared(mergeGeometries([
    new THREE.BoxGeometry(0.94, 0.05, 0.94).translate(0, 0.025, 0).toNonIndexed(),
    ...[0, 1, 2, 3].map((i) => new THREE.BoxGeometry(0.9, 0.02, 0.05).translate(0, 0.06, -0.33 + i * 0.22).toNonIndexed()),
  ]));
  const m = new THREE.Mesh(soilGeom, mat('#6e4c2a'));
  m.receiveShadow = true;
  return m;
}

export function fieldModel() {
  const g = new THREE.Group();
  g.add(soilMesh());
  const crop = new THREE.Mesh(cropGeom, new THREE.MeshLambertMaterial({ color: GREEN, flatShading: true }));
  crop.material.userData.own = true;
  crop.castShadow = true;
  crop.position.y = 0.05;
  g.add(crop);
  // Mit Kenney-Modellen: junger Weizen (grün) und reifer Weizen (golden), je 2x2 pro Feld
  if (A.has('nature/crops_wheatStageA')) {
    crop.visible = false;
    const young = cropPatch('nature/crops_wheatStageA');
    const ripe = cropPatch('nature/crops_wheatStageB');
    g.add(young, ripe);
    g.userData.update = (f) => {
      const grown = f.state !== 'planned';
      young.visible = grown && f.growth < 0.65;
      ripe.visible = grown && f.growth >= 0.65;
      young.scale.y = 0.2 + f.growth * 1.2;
    };
    return g;
  }
  g.userData.update = (f) => {
    crop.visible = f.state !== 'planned';
    crop.scale.y = 0.1 + 0.9 * f.growth;
    crop.material.color.copy(GREEN).lerp(GOLD, Math.max(0, (f.growth - 0.6) / 0.4));
  };
  return g;
}

export function siteModel(type) {
  const g = new THREE.Group();
  g.add(foundation(1.0, 0.9));
  g.add(box(0.96, 0.05, 0.86, '#b08a5a'));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(box(0.06, 0.75, 0.06, C.timber, sx * 0.4, 0, sz * 0.35));

  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.7).translate(0, 0.5, 0), mat('#c9ab7c'));
  walls.castShadow = true;
  walls.position.y = 0.05;
  walls.scale.y = 0.001;
  g.add(walls);

  const wood = logPile(0.62, 0.42);
  wood.scale.setScalar(0.7);
  const stone = box(0.2, 0.12, 0.2, C.stone, -0.62, 0, 0.42);
  g.add(wood, stone);

  const cost = BUILDINGS[type].cost;
  g.userData.update = (b) => {
    walls.scale.y = Math.max(0.001, b.progress * 0.5);
    wood.visible = (b.delivered.wood || 0) > 0 && b.progress < 0.9;
    stone.visible = (b.delivered.stone || 0) > 0 && b.progress < 0.9;
    if (cost.wood) wood.scale.y = 0.4 + 0.6 * ((b.delivered.wood || 0) / cost.wood);
  };
  return g;
}

const ghostMat = new THREE.MeshLambertMaterial({ color: 0x66ff66, transparent: true, opacity: 0.55, depthWrite: false });

// Blaue Fahne oben auf dem Wachturm
function towerFlag(level) {
  const g = new THREE.Group();
  const top = (level >= 3 ? 4 : level >= 2 ? 3 : 2) * S + 0.2;
  g.add(box(0.025, 0.6, 0.025, C.timber, 0, top, 0));
  const cloth = box(0.26, 0.15, 0.015, '#3f6fb0', 0.14, top + 0.43, 0);
  g.add(cloth);
  return g;
}

// Kleiner Pferch neben der Schäferei
function fence() {
  const g = new THREE.Group();
  const posts = [[0.5, 0.15], [0.5, 0.5], [0.85, 0.5], [0.85, 0.15], [0.85, -0.2]];
  for (const [x, z] of posts) g.add(box(0.035, 0.2, 0.035, C.timber, x, 0, z));
  for (let i = 0; i < posts.length - 1; i++) {
    const [x0, z0] = posts[i], [x1, z1] = posts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [0.07, 0.15]) {
      const rail = box(0.02, 0.025, len, '#a0703f', (x0 + x1) / 2, y, (z0 + z1) / 2);
      rail.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      g.add(rail);
    }
  }
  const hay = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), '#e3c25a');
  hay.position.set(0.68, 0.05, 0.33);
  g.add(hay);
  return g;
}

// Dorfbrunnen aus Blender (entwuerfe/Dorfbrunnen.png), Ersatzform falls das Modell fehlt
function wellModel() {
  const g = new THREE.Group();
  if (A.has('custom/well')) {
    const w = A.model('custom/well');
    w.scale.setScalar(0.3);
    g.add(w);
  } else {
    g.add(cyl(0.26, 0.28, 0.25, 10, C.stone));
    g.add(box(0.5, 0.06, 0.3, '#a2612f', 0, 0.62, 0));
  }
  return g;
}

// Höhe des Brückenbelags bei Anteil t (0 = Ufer hier, 1 = Ufer gegenüber): leichter Bogen über dem Wasser
export function deckHeight(grid, b, t) {
  const { dx, dz, len } = b.span, L = len + 1;
  const hA = grid.heightAt(b.x + 0.5, b.z + 0.5), hB = grid.heightAt(b.x + 0.5 + dx * L, b.z + 0.5 + dz * L);
  const lift = Math.max(0.2, grid.waterLevel + 0.45 - (hA + hB) / 2);
  return hA + (hB - hA) * t + 4 * t * (1 - t) * lift + 0.05;
}

// Holzbrücke in Weltkoordinaten: Bohlen, Geländer, Pfähle im Wasser
export function bridgeModel(grid, b) {
  const g = new THREE.Group();
  const { dx, dz, len } = b.span, L = len + 1, n = L * 3;
  const px = (t) => b.x + 0.5 + dx * L * t, pz = (t) => b.z + 0.5 + dz * L * t;
  const yaw = Math.atan2(dx, dz);
  const segs = [];
  const beam = (t0, t1, side, lift, w, h, color) => {
    const y0 = deckHeight(grid, b, t0) + lift, y1 = deckHeight(grid, b, t1) + lift;
    const run = L * (t1 - t0);
    const m = mesh(new THREE.BoxGeometry(w, h, Math.hypot(run, y1 - y0) + 0.02), color);
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.atan2(y1 - y0, run), yaw, 0);
    m.position.set((px(t0) + px(t1)) / 2 + dz * side, (y0 + y1) / 2, (pz(t0) + pz(t1)) / 2 - dx * side);
    g.add(m);
    return m;
  };
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const parts = [beam(t0, t1, 0, 0, 0.82, 0.07, k % 2 ? '#a0703f' : '#b07d48')];
    if (k >= 1 && k < n - 1) for (const side of [-0.4, 0.4]) parts.push(beam(t0, t1, side, 0.3, 0.04, 0.04, C.timber));
    segs.push(parts);
  }
  for (let i = 1; i <= len; i++) {
    const t = i / L, y = deckHeight(grid, b, t);
    for (const side of [-0.4, 0.4]) {
      g.add(box(0.06, 0.34, 0.06, C.darkWood, px(t) + dz * side, y - 0.04, pz(t) - dx * side));
      g.add(cyl(0.06, 0.07, y - grid.waterLevel + 0.6, 6, C.darkWood, px(t) + dz * side * 0.9, grid.waterLevel - 0.6, pz(t) - dx * side * 0.9));
    }
  }
  if (!b.done) {
    const pile = logPile(0, 0);
    pile.scale.setScalar(0.7);
    pile.position.set(px(0) - dz * 0.45, deckHeight(grid, b, 0), pz(0) + dx * 0.45);
    g.add(pile);
    g.userData.update = (site) => segs.forEach((parts, k) => parts.forEach((m) => { m.visible = k / n < site.progress; }));
    g.userData.update(b);
  }
  return g;
}

function ghostify(g) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.material = ghostMat;
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return g;
}

export function bridgeGhost(grid, x, z, span) {
  return ghostify(bridgeModel(grid, { x, z, span, done: true }));
}


// Ersatz ohne Blender-Modell — Denkmal: Stufensockel, Obelisk mit goldener Spitze, Fahnen an den Ecken
function monumentModel() {
  const g = new THREE.Group();
  g.add(box(1.0, 0.1, 1.0, '#8f8a80'));
  g.add(box(0.78, 0.12, 0.78, '#a29f96', 0, 0.1, 0));
  g.add(box(0.52, 0.22, 0.52, C.stone, 0, 0.22, 0));
  g.add(cyl(0.09, 0.15, 1.1, 4, '#ddd8cc', 0, 0.44, 0));
  g.add(cyl(0, 0.09, 0.16, 4, '#c9a227', 0, 1.54, 0));
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
    g.add(box(0.03, 0.55, 0.03, '#6e4423', x, 0.1, z));
    g.add(box(0.02, 0.12, 0.18, '#b3472f', x, 0.5, z + 0.09));
  }
  return g;
}

// Marktplatz: gepflasterte Fläche mit Brunnen in der Mitte, Bänke und Blumen
function plazaModel() {
  const g = new THREE.Group();
  g.add(box(1.7, 0.04, 1.7, '#a29f96'));
  for (let i = 0; i < 4; i++) g.add(box(0.8, 0.01, 0.8, i % 3 ? '#b8b4aa' : '#8f8a80', (i % 2 ? 0.42 : -0.42), 0.04, (i < 2 ? 0.42 : -0.42)));
  const well = wellModel();
  well.scale.setScalar(0.8);
  well.position.y = 0.05;
  g.add(well);
  for (const [x, z, r] of [[-0.62, 0, Math.PI / 2], [0.62, 0, Math.PI / 2], [0, 0.62, 0]]) {
    const bench = new THREE.Group();
    bench.add(box(0.36, 0.04, 0.1, '#8a5a32', 0, 0.1, 0));
    bench.add(box(0.04, 0.1, 0.08, '#6e4423', -0.14, 0, 0));
    bench.add(box(0.04, 0.1, 0.08, '#6e4423', 0.14, 0, 0));
    bench.position.set(x, 0.05, z);
    bench.rotation.y = r;
    g.add(bench);
  }
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    g.add(box(0.16, 0.12, 0.16, '#8f8a80', x, 0.04, z));
    g.add(box(0.12, 0.08, 0.12, '#d0607a', x, 0.16, z));
  }
  return g;
}

export function ghostModel(type) {
  const g = buildingModel(type);
  if (g.userData.pile) g.userData.pile.visible = false;
  if (g.userData.crates) g.userData.crates.visible = false;
  return ghostify(g);
}

export function setGhostColor(ok) {
  ghostMat.color.set(ok ? 0x66ff66 : 0xff5555);
}

const hitMat = new THREE.MeshBasicMaterial({ visible: false });

// Werkzeuge in der rechten Hand, Griff nach unten entlang des Arms
function tool(job) {
  const g = new THREE.Group();
  const handle = (len) => g.add(box(0.025, len, 0.025, '#7a5230', 0, -len + 0.02, 0));
  switch (job) {
    case 'Holzfäller':
      handle(0.26);
      g.add(box(0.03, 0.07, 0.09, '#9aa0a6', 0, -0.26, 0.04));
      break;
    case 'Steinmetz':
      handle(0.26);
      g.add(box(0.03, 0.03, 0.2, '#8a8f95', 0, -0.25, 0));
      break;
    case 'Bauarbeiter':
      handle(0.2);
      g.add(box(0.05, 0.05, 0.1, '#6f7378', 0, -0.2, 0.02));
      break;
    case 'Fischer':
      handle(0.6);
      break;
    case 'Bauer':
      handle(0.22);
      g.add(box(0.02, 0.02, 0.16, '#c8ccd0', 0, -0.21, 0.08));
      break;
    case 'Sammler':
      g.add(cyl(0.06, 0.045, 0.07, 7, '#b08850', 0, -0.14, 0));
      break;
    case 'Bergmann':
      handle(0.26);
      g.add(box(0.03, 0.03, 0.22, '#6f7378', 0, -0.25, 0.02));
      break;
    case 'Schäfer':
      handle(0.7);
      g.add(box(0.025, 0.025, 0.08, '#7a5230', 0, 0.02, 0.04));
      break;
  }
  return g;
}

function limb(w, h, color, x, y) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const m = box(w, h, w, color, 0, -h, 0);
  pivot.add(m);
  return pivot;
}

export function settlerModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const legL = limb(0.05, 0.12, '#4a3a2a', -0.035, 0.12);
  const legR = limb(0.05, 0.12, '#4a3a2a', 0.035, 0.12);
  const torso = cyl(0.075, 0.09, 0.22, 6, JOB_COLORS.null, 0, 0.11, 0);
  const armL = limb(0.04, 0.15, C.skin, -0.1, 0.31);
  const armR = limb(0.04, 0.15, C.skin, 0.1, 0.31);
  const head = mesh(new THREE.IcosahedronGeometry(0.075, 1), C.skin);
  head.position.y = 0.41;
  const hat = cyl(0.0, 0.1, 0.11, 6, HAT_COLORS.null, 0, 0.46, 0);
  const carry = box(0.14, 0.1, 0.12, ITEM_COLORS.wood, 0, 0.18, 0.14);
  carry.visible = false;
  const hand = new THREE.Group();
  hand.position.y = -0.15;
  armR.add(hand);
  body.add(legL, legR, torso, armL, armR, head, hat, carry);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.45).translate(0, 0.45, 0), hitMat);
  g.add(hit);
  g.userData = { body, torso, hat, carry, legL, legR, armL, armR, hand, tool: null, job: undefined, carryItem: null };
  return g;
}

// --- Siedler mit Kenney-Figuren und echten Animationen ---

const clipCache = {};
function clipsFor(key) {
  if (clipCache[key]) return clipCache[key];
  const list = A.animations(key);
  const byName = Object.fromEntries(list.map((c) => [c.name, c]));
  // Gehen nur mit den Beinen, damit beim Tragen die Arme vorne bleiben
  const walk = byName.walk;
  byName['walk-legs'] = new THREE.AnimationClip('walk-legs', walk.duration, walk.tracks.filter((t) => !/arm-/.test(t.name)));
  return (clipCache[key] = byName);
}

const WORK_CLIP = {
  Holzfäller: 'attack-melee-right', Steinmetz: 'attack-melee-right', Bauarbeiter: 'attack-melee-right',
  Sammler: 'pick-up', Bauer: 'pick-up', Fischer: 'holding-right', Müller: 'interact-right', Bäcker: 'interact-right',
};

export function kitSettler(id) {
  const key = A.CHARACTERS[id % A.CHARACTERS.length];
  const g = new THREE.Group();
  const body = A.character(key);
  body.scale.setScalar(0.6);
  g.add(body);
  const bones = {};
  body.traverse((o) => { bones[o.name] = o; });
  const hand = new THREE.Group();
  hand.position.set(0, -0.14, 0.02);
  bones['arm-right'].add(hand);
  const hat = cyl(0.0, 0.1, 0.1, 6, HAT_COLORS.null, 0, 0.3, 0);
  bones.head.add(hat);
  const carry = box(0.16, 0.12, 0.14, ITEM_COLORS.wood, 0, 0.2, 0.16);
  carry.visible = false;
  g.add(carry);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.45).translate(0, 0.45, 0), hitMat);
  g.add(hit);
  const mixer = new THREE.AnimationMixer(body);
  g.userData = { kit: true, mixer, clips: clipsFor(key), actions: {}, current: [], hand, hat, carry, tool: null, job: undefined, carryItem: null };
  play(g, ['idle']);
  return g;
}

function play(o, names) {
  const u = o.userData;
  if (u.current.join() === names.join()) return;
  for (const a of Object.values(u.actions)) if (!names.includes(a.getClip().name)) a.fadeOut(0.2);
  for (const n of names) {
    const action = (u.actions[n] ||= u.mixer.clipAction(u.clips[n]));
    action.reset().fadeIn(0.2).play();
  }
  u.current = names;
}

function animateKitSettler(o, s, dt) {
  const u = o.userData;
  let names;
  if (s.moving) names = s.carry ? ['walk-legs', 'holding-both'] : ['walk'];
  else if (s.working) names = [WORK_CLIP[s.job] || 'attack-melee-right'];
  else names = s.carry ? ['holding-both'] : ['idle'];
  play(o, names);
  u.mixer.update(dt);
  u.carry.visible = !!s.carry;
  if (u.tool) u.tool.visible = !s.carry;
}

export function setSettlerJob(o, job) {
  const u = o.userData;
  if (u.kit) {
    u.hat.material = mat(HAT_COLORS[job]);
    u.hat.visible = job !== null;
    if (u.tool) {
      u.hand.remove(u.tool);
      disposeModel(u.tool);
    }
    u.tool = tool(job);
    u.hand.add(u.tool);
    return;
  }
  u.torso.material = mat(JOB_COLORS[job]);
  u.hat.material = mat(HAT_COLORS[job]);
  if (u.tool) {
    u.hand.remove(u.tool);
    disposeModel(u.tool);
  }
  u.tool = tool(job);
  u.hand.add(u.tool);
}

// Bewegung: Gehen, Tragen, Arbeiten je nach Beruf
export function animateSettler(o, s, t, dt = 0.016) {
  const u = o.userData;
  if (u.kit) return animateKitSettler(o, s, dt);
  const ph = t * 10 + s.id;
  const swing = s.moving ? Math.sin(ph) : 0;
  u.body.position.y = s.moving ? Math.abs(Math.sin(ph)) * 0.025 : 0;
  u.legL.rotation.x = swing * 0.6;
  u.legR.rotation.x = -swing * 0.6;
  u.body.rotation.x = 0;
  if (s.carry) {
    u.armL.rotation.x = u.armR.rotation.x = -1.2;
  } else if (s.working) {
    const w = t * 9 + s.id;
    switch (s.job) {
      case 'Holzfäller': case 'Steinmetz': case 'Bauarbeiter': case null:
        u.armR.rotation.x = -1.6 + Math.sin(w) * 1.1;
        u.armL.rotation.x = -1.2 + Math.sin(w) * 0.6;
        u.body.rotation.x = 0.1 + Math.sin(w) * 0.08;
        break;
      case 'Fischer':
        u.armR.rotation.x = -1.0 + Math.sin(t * 2) * 0.08;
        u.armL.rotation.x = -0.6;
        break;
      default:
        u.armR.rotation.x = -0.9 + Math.sin(w * 0.8) * 0.35;
        u.armL.rotation.x = -0.9 - Math.sin(w * 0.8) * 0.35;
        u.body.rotation.x = 0.25;
    }
  } else {
    u.armL.rotation.x = -swing * 0.5;
    u.armR.rotation.x = swing * 0.5;
  }
  u.carry.visible = !!s.carry;
  if (u.tool) u.tool.visible = !s.carry;
}

// Pferdekarren: Pferd vorn, Wagen mit zwei Rädern, Ladung als Kisten
export function cartModel() {
  const g = new THREE.Group();
  const horse = new THREE.Group();
  horse.add(box(0.16, 0.16, 0.36, '#7a4e2d', 0, 0.2, 0));
  const neck = box(0.1, 0.18, 0.1, '#7a4e2d', 0, 0.3, 0.17);
  neck.rotation.x = 0.5;
  horse.add(neck);
  horse.add(box(0.09, 0.09, 0.18, '#6b4226', 0, 0.42, 0.27));
  horse.add(box(0.05, 0.12, 0.05, '#2e2116', 0, 0.36, -0.2));
  const legs = [];
  for (const [lx, lz] of [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]]) {
    const leg = limb(0.04, 0.2, '#5a3a20', lx, 0.22);
    leg.position.z = lz;
    horse.add(leg);
    legs.push(leg);
  }
  horse.position.z = 0.32;
  g.add(horse);

  const wagon = new THREE.Group();
  // Eigenes Pferd aus Blender statt des Klötzchen-Pferds
  if (A.has('custom/horse')) {
    g.remove(horse);
    const h = A.model('custom/horse');
    h.scale.setScalar(0.22);
    h.position.z = 0.36;
    g.add(h);
    const node = (n) => h.getObjectByName(n);
    // Reihenfolge für Trab: diagonale Beinpaare gleichzeitig
    legs.length = 0;
    legs.push(node('leg_fl'), node('leg_fr'), node('leg_br'), node('leg_bl'));
    g.userData.horseHead = node('head');
    g.userData.horseTail = node('tail');
  }
  if (A.has('town/cart')) {
    // Kenney-Wagen mit sitzendem Kutscher
    const cart = A.model('town/cart');
    cart.scale.setScalar(0.42);
    cart.rotation.y = Math.PI;   // Deichsel zum Pferd
    wagon.add(cart);
    const cargo = pile('#a0703f', [[-0.08, 0.2, -0.12], [0.08, 0.2, -0.12], [-0.08, 0.2, 0.04], [0.08, 0.2, 0.04], [-0.08, 0.3, -0.04], [0.08, 0.3, -0.04]]);
    wagon.add(cargo);
    const key = A.CHARACTERS[3];
    const driver = A.character(key);
    driver.scale.setScalar(0.42);
    driver.position.set(0, 0.16, -0.05);
    wagon.add(driver);
    const mixer = new THREE.AnimationMixer(driver);
    mixer.clipAction(clipsFor(key).sit || clipsFor(key).idle).play();
    wagon.position.z = -0.12;
    g.add(wagon);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.9).translate(0, 0.3, 0.05), hitMat);
    g.add(hit);
    g.userData = { ...g.userData, legs, wheels: [], cargo, mixer };
    g.scale.setScalar(1.3);
    return g;
  }
  wagon.add(box(0.36, 0.06, 0.46, '#9a6a3a', 0, 0.16, 0));
  for (const sx of [-1, 1]) wagon.add(box(0.03, 0.1, 0.46, '#8a5a32', sx * 0.17, 0.22, 0));
  wagon.add(box(0.36, 0.1, 0.03, '#8a5a32', 0, 0.22, -0.22));
  for (const sx of [-1, 1]) wagon.add(box(0.02, 0.02, 0.3, '#5b3a1e', sx * 0.06, 0.17, 0.33));
  const wheels = [];
  for (const sx of [-1, 1]) {
    const wheel = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), '#5b3a1e');
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.21, 0.12, 0);
    wagon.add(wheel);
    wheels.push(wheel);
  }
  const cargo = pile('#a0703f', [[-0.08, 0.2, -0.1], [0.08, 0.2, -0.1], [-0.08, 0.2, 0.08], [0.08, 0.2, 0.08], [-0.08, 0.3, -0.01], [0.08, 0.3, -0.01]]);
  wagon.add(cargo);
  wagon.position.z = -0.12;
  g.add(wagon);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.9).translate(0, 0.3, 0.05), hitMat);
  g.add(hit);
  g.userData = { legs, wheels, cargo };
  g.scale.setScalar(1.3);
  return g;
}

export function animateCart(o, c, t, dt) {
  const u = o.userData;
  const ph = t * 12 + c.id;
  u.legs.forEach((leg, i) => { leg.rotation.x = c.moving ? Math.sin(ph + (i % 2) * Math.PI) * 0.45 : 0; });
  if (u.horseHead) u.horseHead.rotation.x = c.moving ? Math.sin(ph * 2) * 0.06 : Math.sin(t * 0.8 + c.id) * 0.04;
  if (u.horseTail) u.horseTail.rotation.z = Math.sin(t * 1.7 + c.id) * 0.15;
  if (c.moving) u.wheels.forEach((w) => { w.rotation.x -= dt * 8; });
  u.mixer?.update(dt);
  const n = c.carry ? c.carryAmount || 1 : 0;
  showCount(u.cargo, n);
  if (c.carry) u.cargo.material = mat(ITEM_COLORS[c.carry]);
}

export function disposeModel(o) {
  o.traverse((m) => {
    if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
  });
}
