import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Modelle von Kenney (kenney.nl), Lizenz CC0 — siehe public/models/*/License.txt
const LIST = {
  town: [
    'wall', 'wall-door', 'wall-window-shutters', 'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters',
    'wall-wood-window-small', 'wall-window-small', 'roof-gable', 'roof-point', 'roof-high-gable',
    'chimney', 'windmill', 'cart', 'stall-red',
    'planks',
  ],
  nature: [
    'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_tallA',
    'rock_tallB', 'rock_smallA', 'rock_smallB', 'plant_bushDetailed',
    'crops_wheatStageA', 'crops_wheatStageB', 'log_stack', 'log_stackLarge', 'stump_round',
  ],
  // Eigene Modelle aus Blender (nach Marcos Entwürfen in entwuerfe/)
  custom: ['horse', 'sheep', 'tree_a', 'tree_b', 'tree_c', 'pine_a', 'pine_b', 'pine_c', 'well', 'townhall',
    'mine_ore', 'mine_coal', 'smelter', 'market', 'sheepfarm', 'tavern', 'chapel', 'plaza', 'monument'],
  chars: [
    'character-male-a', 'character-male-b', 'character-male-c',
    'character-female-a', 'character-female-b', 'character-female-c',
  ],
};

export const CHARACTERS = LIST.chars.map((n) => `chars/${n}`);

const models = {};
const clips = {};
const flat = {};

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  const jobs = Object.entries(LIST).flatMap(([dir, names]) => names.map((n) => `${dir}/${n}`));
  let done = 0;
  await Promise.all(jobs.map(async (key) => {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${key}.glb`);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    if (key.startsWith('nature/')) recolor(key, gltf.scene);
    else if (!key.startsWith('custom/')) shareMaterial(key.split('/')[0], gltf.scene);
    models[key] = gltf.scene;
    if (gltf.animations.length) clips[key] = gltf.animations;
    onProgress?.(++done / jobs.length);
  }));
}

export const has = (key) => !!models[key];

// Stadt-Teile und Figuren nutzen jeweils dieselbe Farbtextur -> ein gemeinsames Material
const sharedMats = {};
function shareMaterial(dir, root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!sharedMats[dir]) sharedMats[dir] = o.material;
    else if (o.material !== sharedMats[dir]) {
      o.material.map?.dispose();
      o.material.dispose();
      o.material = sharedMats[dir];
    }
  });
}

// Kenneys Natur-Farben sind mintgrün; wir passen sie an unsere Wiese an
const NATURE_COLORS = {
  leafsGreen: '#4f9a3c', leafsDark: '#2f6b35', grass: '#5a9a3a', dirt: '#8a6a45',
  woodBark: '#7a5230', woodBarkDark: '#5b3a1e', woodInner: '#d9b98a', _defaultMat: '#9a968e',
};
function recolor(key, root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      let c = NATURE_COLORS[m.name];
      if (key === 'nature/crops_wheatStageB' && m.name === '_defaultMat') c = '#e0b84a';
      if (key === 'nature/crops_wheatStageA' && m.name === 'grass') c = '#7cb342';
      if (key.includes('flower_')) c = null;
      // Felsen: Kenneys "dirt"/"grass" sind hier Gestein, nicht Erde und Gras
      if (key.startsWith('nature/rock_')) c = { dirt: '#a8a49c', grass: '#bab6ae', _defaultMat: '#8d8a83' }[m.name] || c;
      if (c) m.color.set(c);
      // Kenneys Naturmodelle sind als Metall markiert und wirken ohne Umgebungsspiegelung schwarz
      m.metalness = 0;
      m.flatShading = true;
      m.needsUpdate = true;
    }
  });
}

// Dachfarben: Kenneys Palette hat türkise Dächer; wir tauschen diese Farbfelder aus
const ROOF_SOURCE = { red: [0, 384], thatch: [0, 128], brown: [256, 256] };
const roofMats = {};

export function roofMaterial(variant, base) {
  const key = variant + base.uuid;
  if (roofMats[key]) return roofMats[key];
  const img = base.map.image;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const f = img.width / 512;
  const [sx, sy] = ROOF_SOURCE[variant];
  for (const [dx, dy] of [[64, 384], [448, 256]]) ctx.drawImage(canvas, sx * f, sy * f, 64 * f, 128 * f, dx * f, dy * f, 64 * f, 128 * f);
  const tex = new THREE.CanvasTexture(canvas);
  Object.assign(tex, { flipY: base.map.flipY, colorSpace: base.map.colorSpace, magFilter: base.map.magFilter, minFilter: base.map.minFilter, wrapS: base.map.wrapS, wrapT: base.map.wrapT });
  const mat = base.clone();
  mat.map = tex;
  return (roofMats[key] = mat);
}

// Kopie mit gemeinsamer Geometrie und gemeinsamem Material
export function model(key) {
  return models[key].clone();
}

export function character(key) {
  return SkeletonUtils.clone(models[key]);
}

export function animations(key) {
  return clips[key] || [];
}

// Höhe und Breite eines Modells (für das Angleichen der Größen)
export function size(key) {
  const box = new THREE.Box3().setFromObject(models[key]);
  return box.getSize(new THREE.Vector3());
}

// Alle Teile eines Modells als [{ geometry, material }] mit eingerechneter Lage (für InstancedMesh)
export function flatten(key) {
  if (flat[key]) return flat[key];
  const root = models[key];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const geometry = o.geometry.clone().applyMatrix4(m);
    geometry.userData.shared = true;
    parts.push({ geometry, material: o.material });
  });
  return (flat[key] = parts);
}
