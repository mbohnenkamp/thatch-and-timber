import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CameraRig } from './camera.js';
import * as M from './models.js';
import * as A from './assets.js';
import { Grass, Smoke, Roads, createWater, createTerrain, addSway, timeUniform, terrainUniforms } from './nature.js';
import { PostFX, DayNight } from './effects.js';
import { Flocks } from './sheep.js';
import { TownSigns } from './signs.js';
import { RESOURCES, MAPS, BUILDINGS, WORK_RADIUS } from '../config.js';

const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Rahmen für geplante Straßenfelder und Vorschaukacheln
const PLAN_FRAME = mergeGeometries([
  new THREE.BoxGeometry(0.8, 0.03, 0.08).translate(0, 0, 0.36),
  new THREE.BoxGeometry(0.8, 0.03, 0.08).translate(0, 0, -0.36),
  new THREE.BoxGeometry(0.08, 0.03, 0.64).translate(0.36, 0, 0),
  new THREE.BoxGeometry(0.08, 0.03, 0.64).translate(-0.36, 0, 0),
]);
const PLAN_MAT = new THREE.MeshBasicMaterial({ color: '#efe6d2', transparent: true, opacity: 0.85 });
const PREVIEW_TILE = new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2);
const PREVIEW_OK = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.6, depthWrite: false });
const PREVIEW_BAD = new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.6, depthWrite: false });

// Baumarten je Landschaft; Felsarten überall gleich
// Eigene Bäume aus Blender: Laubbäume nach entwuerfe/Baum.png, Tannen (pine_a/b) und Kiefer (pine_c) im selben Stil
const TREE_VARIANTS = {
  forest: ['custom/tree_a', 'custom/tree_b', 'custom/tree_c', 'custom/pine_a', 'custom/pine_b'],
  mountains: ['custom/pine_a', 'custom/pine_b', 'custom/pine_c'],
  river: ['custom/tree_a', 'custom/tree_b', 'custom/tree_c'],
};
// Grenzpfosten: heller Pfahl mit blauer Spitze
const BORDER_POST = (() => {
  const post = new THREE.BoxGeometry(0.07, 0.36, 0.07).translate(0, 0.18, 0).toNonIndexed();
  const cap = new THREE.ConeGeometry(0.07, 0.11, 4).translate(0, 0.415, 0).toNonIndexed();
  const paint = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  };
  const geo = mergeGeometries([paint(post, '#e9dfc8'), paint(cap, '#3f6fb0')]);
  geo.userData.shared = true;
  return geo;
})();
const BORDER_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const AUTUMN_LEAF = new THREE.Color('#d9822b');
const SNOW_LEAF = new THREE.Color('#e4eaee');
const ROCK_VARIANTS = ['rock_tallA', 'rock_tallB', 'rock_largeA', 'rock_largeB', 'rock_largeC'].map((k) => `nature/${k}`);

// Wie Layer, aber für Modelle aus mehreren Teilen (Stamm + Krone usw.)
class ModelLayer {
  constructor(scene, parts, count, norm = 1) {
    this.norm = norm;
    this.meshes = parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, count));
      m.count = count;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      return m;
    });
    this.d = new THREE.Object3D();
  }

  set(i, x, y, z, rot, sx, sy = sx, sz = sx) {
    const d = this.d;
    d.position.set(x, y, z);
    d.rotation.set(0, rot, 0);
    d.scale.set(sx * this.norm, sy * this.norm, sz * this.norm);
    d.updateMatrix();
    for (const m of this.meshes) {
      m.setMatrixAt(i, d.matrix);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  hide(i) { this.set(i, 0, -100, 0, 0, 0.0001); }

  // Farbton nur fürs Laub (all: für alle Teile, z. B. Erz und Kohle)
  tint(i, color, all = false) {
    for (const m of this.meshes) {
      if (!all && !/leaf/i.test(m.material.name)) continue;
      m.setColorAt(i, color);
      m.instanceColor.needsUpdate = true;
    }
  }
}

class Layer {
  constructor(scene, geo, material, count, shadow = true) {
    this.mesh = new THREE.InstancedMesh(geo, material, Math.max(1, count));
    this.mesh.count = count;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.d = new THREE.Object3D();
    scene.add(this.mesh);
  }

  set(i, x, y, z, rot, sx, sy = sx, sz = sx) {
    const d = this.d;
    d.position.set(x, y, z);
    d.rotation.set(0, rot, 0);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    this.mesh.setMatrixAt(i, d.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  hide(i) { this.set(i, 0, -100, 0, 0, 0.0001); }

  color(i, c) {
    this.mesh.setColorAt(i, c);
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Renderer {
  constructor(container, game, settings = { graphics: 'high', dayNight: true }) {
    this.game = game;
    this.grid = game.grid;
    this.container = container;
    this.time = 0;
    this.regrowTimer = 0;
    this.selection = null;
    this.ghost = null;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.85;
    container.appendChild(r.domElement);

    const map = MAPS[game.mapType];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.sky, 50, 120);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.rig = new CameraRig(this.camera, this.grid.size);
    const home = game.warehouses[0] || game.start;
    this.rig.target.set(home.x + 0.5, 0, home.z + 0.5);

    this.setupLights();
    this.buildTerrain(map);
    this.buildResources();
    this.grass = new Grass(this.scene, this.grid);
    this.roads = new Roads(this.scene, this.grid);
    for (let i = 0; i < this.grid.road.length; i++) {
      if (this.grid.road[i]) this.paintRoad(i % this.grid.size, Math.floor(i / this.grid.size));
    }
    this.smoke = new Smoke(this.scene);
    this.flocks = new Flocks(this.scene, game);
    this.postfx = new PostFX(r, this.scene, this.camera);
    this.dayNight = new DayNight({
      scene: this.scene, sun: this.sun, hemi: this.hemi, water: this.water, skyColor: map.sky, postfx: this.postfx,
    });

    this.buildingObjs = new Map();
    this.bridges = new Set();
    this.settlerObjs = new Map();
    for (const b of game.buildings) this.addBuilding(b);
    for (const s of game.settlers) this.addSettler(s);
    game.on('building', (b) => this.addBuilding(b));
    game.on('buildingChanged', (b) => { this.removeBuilding(b); this.addBuilding(b); });
    game.on('buildingRemoved', (b) => this.removeBuilding(b));
    game.on('settler', (s) => this.addSettler(s));
    game.on('fest', () => this.showBunting());
    game.on('resource', (n) => this.updateResource(n));

    this.cartObjs = new Map();
    for (const c of game.carts) this.addCart(c);
    game.on('cart', (c) => this.addCart(c));
    game.on('cartRemoved', (c) => {
      const o = this.cartObjs.get(c);
      if (o) {
        this.scene.remove(o);
        M.disposeModel(o);
        this.cartObjs.delete(c);
      }
    });
    game.on('road', ({ x, z }) => this.paintRoad(x, z));

    // Geplante Straßenfelder (helle Umrandung) und Vorschau beim Planen
    this.planObjs = new Map();
    for (const p of game.roadPlans) this.addRoadPlan(p);
    game.on('roadPlan', (p) => this.addRoadPlan(p));
    game.on('roadPlanRemoved', (p) => {
      const o = this.planObjs.get(p);
      if (o) this.scene.remove(o);
      this.planObjs.delete(p);
    });
    this.preview = new THREE.Group();
    this.scene.add(this.preview);

    this.fieldObjs = new Map();
    for (const f of game.fields) this.addField(f);
    game.on('field', (f) => this.addField(f));
    game.on('fieldRemoved', (f) => {
      const o = this.fieldObjs.get(f);
      if (o) {
        this.scene.remove(o);
        this.grass.setTile(f.x, f.z, true);
        o.traverse((m) => { if (m.isMesh && m.material.userData.own) m.material.dispose(); });
        M.disposeModel(o);
        this.fieldObjs.delete(f);
      }
    });

    this.signs = new TownSigns(this.scene, game);
    this.setTerritory(game.territory);
    game.on('territory', (t) => this.setTerritory(t));
    game.on('goal', () => this.signs.refresh());

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    this.tileMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.tileMarker.visible = false;
    this.scene.add(this.tileMarker);

    this.radiusRing = new THREE.Mesh(
      new THREE.RingGeometry(0.992, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthTest: false }),
    );
    this.radiusRing.visible = false;
    this.scene.add(this.radiusRing);

    this.applySettings(settings);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0x6b7a4a, 1.6);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera;
    sc.near = 1;
    sc.far = 160;
    this.scene.add(sun, sun.target);
    this.shadowSize = 0;
  }

  buildTerrain(map) {
    const g = this.grid;
    this.terrain = createTerrain(g, map);
    this.scene.add(this.terrain);

    if (g.water.some((v) => v)) {
      this.water = createWater(this.renderer, g, map.sky);
      this.scene.add(this.water);
    }
  }

  buildResources() {
    const nodes = this.game.resources;
    const of = (t) => nodes.filter((n) => n.type === t);
    const s = this.scene;
    // Je Baumart / Felsart eine gesammelte Ebene; ri = Platz innerhalb dieser Ebene
    const group = (list, keys, target, measure) => keys.map((key) => {
      const members = list.filter((n) => keys[n.variantIndex] === key);
      members.forEach((n, i) => { n.ri = i; n.layerKey = key; });
      const sz = A.size(key);
      return [key, new ModelLayer(s, A.flatten(key), members.length, target / measure(sz))];
    });
    const trees = of('tree'), rocks = of('rock'), bushes = of('berry'), fish = of('fish');
    const treeKeys = TREE_VARIANTS[this.game.mapType];
    trees.forEach((n) => { n.variantIndex = Math.floor(hash(n.x, n.z) * treeKeys.length); });
    const ores = of('ore'), coals = of('coal');
    for (const n of [...rocks, ...ores, ...coals]) n.variantIndex = Math.floor(hash(n.z, n.x) * ROCK_VARIANTS.length);

    // Laub: Sway plus Grundfarbe merken, damit Herbst und Winter darauf aufbauen
    this.leafMats = [];
    for (const key of [...treeKeys, 'nature/plant_bushDetailed']) for (const p of A.flatten(key)) {
      if (!/leaf/i.test(p.material.name) || this.leafMats.some((l) => l.mat === p.material)) continue;
      if (treeKeys.includes(key)) addSway(p.material, 0.06);
      p.material.userData.base ??= p.material.color.clone();
      this.leafMats.push({ mat: p.material, base: p.material.userData.base, pine: key.includes('pine') });
    }
    this.treeLayers = Object.fromEntries(group(trees, treeKeys, 1.35, (v) => v.y));
    // Jeder Baum bekommt einen eigenen Grünton
    const tint = new THREE.Color();
    for (const n of trees) {
      const h = hash(n.x * 3.1, n.z * 1.7);
      tint.setRGB(0.86 + h * 0.22, 0.9 + hash(n.z, n.x * 2.3) * 0.16, 0.8 + h * 0.2);
      this.treeLayers[n.layerKey].tint(n.ri, tint);
    }
    this.rockLayers = Object.fromEntries(group(rocks, ROCK_VARIANTS, 0.8, (v) => Math.max(v.x, v.z)));
    // Erz rostrot, Kohle fast schwarz: dieselben Felsen, eingefärbt
    this.depositLayers = {};
    for (const [type, list, color] of [['ore', ores, '#c0714a'], ['coal', coals, '#3b3735']]) {
      this.depositLayers[type] = Object.fromEntries(group(list, ROCK_VARIANTS, 0.7, (v) => Math.max(v.x, v.z)));
      const c = new THREE.Color(color);
      for (const n of list) this.depositLayers[type][n.layerKey].tint(n.ri, c, true);
    }
    const stumpSize = A.size('nature/stump_round');
    const bushSize = A.size('nature/plant_bushDetailed');
    this.layers = {
      stump: new ModelLayer(s, A.flatten('nature/stump_round'), trees.length, 0.32 / stumpSize.x),
      bush: new ModelLayer(s, A.flatten('nature/plant_bushDetailed'), bushes.length, 0.55 / bushSize.x),
      berry: new Layer(s, M.geoms.berry, M.mat('#c62a3c'), bushes.length * 3, false),
      fish: new Layer(
        s, M.geoms.ring,
        new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.7, depthWrite: false }),
        fish.length, false,
      ),
    };
    this.fishNodes = fish;
    this.treeNodes = trees;
    trees.forEach((n, i) => { n.si = i; });
    bushes.forEach((n, i) => { n.ri = i; });
    fish.forEach((n, i) => { n.ri = i; });
    for (const n of nodes) this.updateResource(n);
  }

  updateResource(n) {
    const L = this.layers;
    const x = n.x + 0.5 + n.ox, z = n.z + 0.5 + n.oz;
    const y = this.grid.heightAt(x, z);
    const i = n.ri;
    if (n.type === 'tree') {
      const layer = this.treeLayers[n.layerKey];
      if (n.gone) {
        layer.hide(i);
        L.stump.hide(n.si);
      } else if (n.amount > 0) {
        layer.set(i, x, y, z, n.rot, n.scale);
        L.stump.hide(n.si);
      } else {
        const p = n.timer / RESOURCES.tree.regrow;
        L.stump.set(n.si, x, y, z, n.rot, n.scale);
        if (p < 0.3) layer.hide(i);
        else layer.set(i, x + 0.2, y, z + 0.1, n.rot, n.scale * p * 0.8);
      }
    } else if (n.type === 'rock' || n.type === 'ore' || n.type === 'coal') {
      const layer = n.type === 'rock' ? this.rockLayers[n.layerKey] : this.depositLayers[n.type][n.layerKey];
      if (n.gone) layer.hide(i);
      else layer.set(i, x, y - 0.03, z, n.rot, n.scale * (0.5 + (0.5 * n.amount) / n.max));
    } else if (n.type === 'berry') {
      if (n.gone) {
        L.bush.hide(i);
        for (let k = 0; k < 3; k++) L.berry.hide(i * 3 + k);
        return;
      }
      L.bush.set(i, x, y, z, n.rot, n.scale);
      for (let k = 0; k < 3; k++) {
        if (k >= n.amount) {
          L.berry.hide(i * 3 + k);
          continue;
        }
        const a = n.rot + k * 2.1;
        L.berry.set(i * 3 + k, x + Math.cos(a) * 0.2 * n.scale, y + (0.22 + k * 0.04) * n.scale, z + Math.sin(a) * 0.2 * n.scale, 0, 1.2);
      }
    }
  }

  addBuilding(b) {
    this.grass.setTile(b.x, b.z, false);
    if (this.roads) this.roads.dirty = true;
    let o;
    if (b.span) {
      o = M.bridgeModel(this.grid, b);
      this.bridges.add(b);
    } else {
      o = b.done ? M.buildingModel(b.type, b.level, b.upgrading) : M.siteModel(b.type);
      o.position.set(b.x + 0.5, this.grid.heightAt(b.x + 0.5, b.z + 0.5), b.z + 0.5);
    }
    o.userData.entity = { kind: 'building', ref: b };
    this.scene.add(o);
    this.buildingObjs.set(b, o);
  }

  removeBuilding(b) {
    const o = this.buildingObjs.get(b);
    if (!o) return;
    if (b.removed) this.grass.setTile(b.x, b.z, true);
    if (b.removed) this.bridges.delete(b);
    this.scene.remove(o);
    M.disposeModel(o);
    this.buildingObjs.delete(b);
  }

  addField(f) {
    this.grass.setTile(f.x, f.z, false);
    const o = M.fieldModel();
    o.position.set(f.x + 0.5, this.grid.heightAt(f.x + 0.5, f.z + 0.5), f.z + 0.5);
    o.userData.entity = { kind: 'field', ref: f };
    this.scene.add(o);
    this.fieldObjs.set(f, o);
  }

  addRoadPlan(p) {
    const o = new THREE.Mesh(PLAN_FRAME, PLAN_MAT);
    o.position.set(p.x + 0.5, this.grid.heightAt(p.x + 0.5, p.z + 0.5) + 0.06, p.z + 0.5);
    this.scene.add(o);
    this.planObjs.set(p, o);
  }

  // Zeigt den geplanten Straßenverlauf (grün = möglich, rot = nicht möglich)
  setRoadPreview(tiles, ok) {
    this.preview.clear();
    if (!tiles) return;
    const mat = ok ? PREVIEW_OK : PREVIEW_BAD;
    for (const t of tiles) {
      const m = new THREE.Mesh(PREVIEW_TILE, mat);
      m.position.set(t.x + 0.5, this.grid.heightAt(t.x + 0.5, t.z + 0.5) + 0.07, t.z + 0.5);
      this.preview.add(m);
    }
  }

  addCart(c) {
    const o = M.cartModel();
    o.userData.entity = { kind: 'cart', ref: c };
    this.scene.add(o);
    this.cartObjs.set(c, o);
  }

  // Gras auf Wegen ausblenden; die Wegbänder werden gesammelt neu gezeichnet
  paintRoad(x, z) {
    const g = this.grid;
    const i = g.idx(x, z);
    if (g.building[i] < 0 && g.field[i] < 0) this.grass.setTile(x, z, g.road[i] === 0);
    this.roads.dirty = true;
  }

  addSettler(s) {
    const o = A.has(A.CHARACTERS[0]) ? M.kitSettler(s.id) : M.settlerModel();
    o.userData.entity = { kind: 'settler', ref: s };
    this.scene.add(o);
    this.settlerObjs.set(s, o);
  }

  setNdc(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  pickTile(cx, cy) {
    this.setNdc(cx, cy);
    const hit = this.raycaster.intersectObject(this.terrain, false)[0];
    if (!hit) return null;
    const x = Math.floor(hit.point.x), z = Math.floor(hit.point.z);
    return this.grid.inBounds(x, z) ? { x, z } : null;
  }

  pickEntity(cx, cy) {
    this.setNdc(cx, cy);
    const objs = [...this.settlerObjs.values(), ...this.cartObjs.values(), ...this.buildingObjs.values(), ...this.fieldObjs.values()];
    for (const h of this.raycaster.intersectObjects(objs, true)) {
      let o = h.object;
      while (o && !o.userData.entity) o = o.parent;
      if (o) return o.userData.entity;
    }
    return null;
  }

  // Geländehöhe, auf fertigen Brücken die Höhe des Belags
  groundAt(x, z) {
    const h = this.grid.heightAt(x, z);
    for (const b of this.bridges) {
      if (!b.done) continue;
      const { dx, dz, len } = b.span, L = len + 1;
      const along = ((x - b.x - 0.5) * dx + (z - b.z - 0.5) * dz) / L;
      const side = Math.abs((x - b.x - 0.5) * dz - (z - b.z - 0.5) * dx);
      if (along > 0 && along < 1 && side < 0.6) return Math.max(h, M.deckHeight(this.grid, b, along));
    }
    return h;
  }

  setGhost(type) {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      M.disposeModel(this.ghost);
    }
    this.ghost = null;
    this.tileMarker.visible = false;
    this.radiusRing.visible = false;
    const def = type && BUILDINGS[type];
    this.ghostRadius = def?.resource ? WORK_RADIUS[0] : def?.fieldRadius ? def.fieldRadius[0] + 0.5 : def?.houseBonus ? def.radius : def?.territory ? def.territory[0] : 0;
    this.radiusRing.scale.setScalar(this.ghostRadius || 1);
    if (!type) return;
    this.ghostType = type;
    this.ghostKey = null;
    if (BUILDINGS[type].span) {
      this.ghostRadius = 0;
      this.ghost = new THREE.Group();
    } else this.ghost = M.ghostModel(type);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  // Brückenvorschau folgt dem Ufer: neu bauen, wenn sich Lage oder Richtung ändern
  updateBridgeGhost(tile) {
    const span = tile && this.game.bridgeSpan(tile.x, tile.z);
    const key = span ? `${tile.x},${tile.z},${span.dx},${span.dz}` : null;
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghost.children.forEach((c) => M.disposeModel(c));
    this.ghost.clear();
    if (span) this.ghost.add(M.bridgeGhost(this.grid, tile.x, tile.z, span));
  }

  updateGhost(tile, ok) {
    if (!this.ghost) return;
    if (!tile) {
      this.ghost.visible = false;
      this.tileMarker.visible = false;
      this.radiusRing.visible = false;
      return;
    }
    this.radiusRing.position.set(tile.x + 0.5, this.grid.heightAt(tile.x + 0.5, tile.z + 0.5) + 0.1, tile.z + 0.5);
    this.radiusRing.visible = this.ghostRadius > 0;
    if (BUILDINGS[this.ghostType].span) this.updateBridgeGhost(tile);
    else this.ghost.position.set(tile.x + 0.5, this.grid.heightAt(tile.x + 0.5, tile.z + 0.5), tile.z + 0.5);
    this.ghost.visible = true;
    M.setGhostColor(ok);
    this.tileMarker.position.set(tile.x + 0.5, this.grid.heightAt(tile.x + 0.5, tile.z + 0.5) + 0.06, tile.z + 0.5);
    this.tileMarker.material.color.set(ok ? 0x44ff44 : 0xff4444);
    this.tileMarker.visible = true;
  }

  setSelection(sel) { this.selection = sel; }

  applySettings({ graphics, dayNight }) {
    this.high = graphics !== 'low';
    this.dayNight.on = dayNight;
    this.grass.group.visible = this.high;
    const size = this.high ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  // Gibt Grafikspeicher frei (für Vorschaubilder im Menü)
  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
    this.postfx.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const ratio = this.high ? Math.min(window.devicePixelRatio, 2) : 1;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h, Math.min(ratio, 1.5));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  updateSun() {
    const t = this.rig.target;
    const dir = this.dayNight.sunDir;
    this.sun.position.set(t.x + dir.x * 40, t.y + dir.y * 40, t.z + dir.z * 40);
    this.sun.target.position.copy(t);
    const size = Math.min(60, Math.max(14, this.rig.dist * 1.2));
    if (Math.abs(size - this.shadowSize) > 1) {
      this.shadowSize = size;
      const sc = this.sun.shadow.camera;
      sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size;
      sc.updateProjectionMatrix();
    }
  }

  // Wimpelketten rund um Lagerhäuser, Rathaus und Denkmal, solange das Fest dauert
  showBunting() {
    if (this.bunting) return;
    const g = (this.bunting = new THREE.Group());
    const colors = ['#c6283c', '#f2c230', '#2f6db3', '#3f9a4a'].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    const pole = new THREE.MeshLambertMaterial({ color: '#6e4423' });
    const line = new THREE.LineBasicMaterial({ color: '#3a2a1a' });
    const flag = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.11, 0, 0), new THREE.Vector3(0.11, 0, 0), new THREE.Vector3(0, -0.24, 0)]);
    const spots = this.game.buildings.filter((b) => b.done && !b.removed && ['warehouse', 'townhall', 'monument', 'plaza'].includes(b.type));
    for (const b of spots) {
      const cx = b.x + 0.5, cz = b.z + 0.5, r = 1.1;
      const corners = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([dx, dz]) => new THREE.Vector3(cx + dx, this.groundAt(cx + dx, cz + dz) + 1.1, cz + dz));
      for (const c of corners) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 5), pole);
        p.position.set(c.x, c.y - 0.55, c.z);
        g.add(p);
      }
      corners.forEach((a, i) => {
        const c = corners[(i + 1) % 4];
        // Schnur mit leichtem Durchhang
        const pts = Array.from({ length: 13 }, (_, k) => new THREE.Vector3().lerpVectors(a, c, k / 12).add(new THREE.Vector3(0, -Math.sin((k / 12) * Math.PI) * 0.18, 0)));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), line));
        for (let k = 1; k < 6; k++) {
          const f = k / 6;
          const m = new THREE.Mesh(flag, colors[k % 4]);
          m.position.lerpVectors(a, c, f);
          m.position.y -= Math.sin(f * Math.PI) * 0.18;
          m.lookAt(m.position.x + (c.z - a.z), m.position.y, m.position.z - (c.x - a.x));
          g.add(m);
        }
      });
    }
    this.scene.add(g);
  }

  update(dt) {
    this.time += dt;
    timeUniform.value = this.time;
    const g = this.grid;
    this.dayNight.update(this.game.time);

    for (const [s, o] of this.settlerObjs) {
      o.position.set(s.x, this.groundAt(s.x, s.z), s.z);
      let diff = s.dir - o.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      o.rotation.y += diff * Math.min(1, dt * 12);
      const u = o.userData;
      if (u.job !== s.job) {
        u.job = s.job;
        M.setSettlerJob(o, s.job);
      }
      if (u.carryItem !== s.carry) {
        u.carryItem = s.carry;
        if (s.carry) u.carry.material = M.mat(M.ITEM_COLORS[s.carry]);
      }
      M.animateSettler(o, s, this.time, dt);
      // Fest: hüpfen und drehen
      if (s.dancing) {
        o.position.y += Math.abs(Math.sin(this.time * 7 + s.id)) * 0.12;
        o.rotation.y = this.time * 3 + s.id;
      }
    }
    if (this.bunting && !this.game.festActive) {
      this.scene.remove(this.bunting);
      this.bunting.traverse((m) => m.geometry?.dispose());
      this.bunting = null;
    }

    for (const [f, o] of this.fieldObjs) o.userData.update(f);
    this.flocks.update(this.time);
    this.updateSeason();

    for (const [c, o] of this.cartObjs) {
      o.position.set(c.x, this.groundAt(c.x, c.z), c.z);
      let diff = c.dir - o.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      o.rotation.y += diff * Math.min(1, dt * 8);
      M.animateCart(o, c, this.time, dt);
    }

    for (const [b, o] of this.buildingObjs) {
      const u = o.userData;
      if (!b.done) {
        u.update?.(b);
        continue;
      }
      if (u.pile) M.showCount(u.pile, b.output);
      if (u.crates) M.showCount(u.crates, Math.ceil(Object.values(b.stock).reduce((a, v) => a + v, 0) / 10));
      if (u.blades) u.blades.rotation.z -= dt * (b.workers[0]?.working ? 3 : 0.3);
      if (u.chimney) {
        u.smokeT = (u.smokeT || Math.random()) - dt;
        if (u.smokeT <= 0) {
          u.smokeT = 0.7 + Math.random() * 0.6;
          this.smoke.emit(o.localToWorld(u.chimney.clone()));
        }
      }
    }

    const wl = g.waterLevel + 0.02;
    for (const n of this.fishNodes) {
      if (n.amount <= 0) {
        this.layers.fish.hide(n.ri);
        continue;
      }
      const k = 0.7 + ((this.time * 0.6 + n.rot) % 1) * 1.1;
      this.layers.fish.set(n.ri, n.x + 0.5 + n.ox, wl, n.z + 0.5 + n.oz, 0, k);
    }

    this.regrowTimer += dt;
    if (this.regrowTimer > 1) {
      this.regrowTimer = 0;
      // Neue Wege können neue Schildplätze ergeben
      this.signTimer = (this.signTimer || 0) + 1;
      if (this.signTimer >= 15) {
        this.signTimer = 0;
        this.signs.refresh();
      }
      for (const n of this.treeNodes) if (n.amount === 0) this.updateResource(n);
    }

    this.updateSelectionRing();
    this.rig.update(dt, (x, z) => g.heightAt(x, z));
    this.updateSun();
    this.smoke.update(dt);
    this.roadTimer = (this.roadTimer || 0) + dt;
    if (this.roads.dirty && this.roadTimer > 0.5) {
      this.roadTimer = 0;
      this.roads.rebuild();
    }
    if (this.high) this.postfx.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Grenzpfosten auf jeder Kante zwischen eigenem und fremdem Land
  setTerritory(t) {
    this.terrain.userData.setTerritory(t);
    this.signs.refresh();
    if (this.border) {
      this.scene.remove(this.border);
      this.border.dispose();
    }
    const N = this.grid.size, spots = [];
    const inside = (x, z) => x >= 0 && z >= 0 && x < N && z < N && t[z * N + x] === 1;
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        if (!inside(x, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= N || nz >= N || inside(nx, nz)) continue;
          spots.push([x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5]);
        }
      }
    const m = (this.border = new THREE.InstancedMesh(BORDER_POST, BORDER_MAT, Math.max(1, spots.length)));
    m.count = spots.length;
    m.castShadow = true;
    const d = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      if (this.grid.isWater(Math.floor(x), Math.floor(z))) d.position.set(x, -50, z);
      else d.position.set(x, this.grid.heightAt(x, z), z);
      d.rotation.y = hash(x, z) * 6;
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    this.scene.add(m);
  }

  updateSeason() {
    const { autumn, snow } = this.game.season;
    if (autumn === this.seasonAutumn && snow === this.seasonSnow) return;
    this.seasonAutumn = autumn;
    this.seasonSnow = snow;
    terrainUniforms.uAutumn.value = autumn;
    terrainUniforms.uSnow.value = snow;
    this.grass.setSeason(autumn, snow);
    for (const l of this.leafMats) {
      l.mat.color.copy(l.base);
      if (!l.pine) l.mat.color.lerp(AUTUMN_LEAF, autumn * 0.7);
      l.mat.color.lerp(SNOW_LEAF, snow * (l.pine ? 0.45 : 0.75));
    }
  }

  updateSelectionRing() {
    const sel = this.selection;
    const ring = this.selRing;
    if (!sel || sel.ref.removed || sel.ref.gone) {
      ring.visible = false;
      return;
    }
    let x, z, scale = 1;
    if (sel.kind === 'settler' || sel.kind === 'cart') {
      x = sel.ref.x; z = sel.ref.z; scale = 0.7;
    } else {
      x = sel.ref.x + 0.5; z = sel.ref.z + 0.5;
      scale = sel.kind === 'building' ? 1.4 : 1;
    }
    ring.position.set(x, this.grid.heightAt(x, z) + 0.06, z);
    ring.scale.setScalar(scale);
    ring.visible = true;
  }
}
