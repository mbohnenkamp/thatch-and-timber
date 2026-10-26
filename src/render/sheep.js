import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as A from './assets.js';
import { BUILDINGS } from '../config.js';

// Grasende Schafherden — reine Kulisse, nicht im Spielstand
const SCALE = 0.24;
const SPEED = 0.45;
const LEGS = ['sheep_leg_fl', 'sheep_leg_br', 'sheep_leg_fr', 'sheep_leg_bl'];

let template = null;

// Teile je Gruppe zu einem Mesh mit Vertexfarben zusammenfassen (weniger Draw Calls)
function buildTemplate() {
  const root = A.model('custom/sheep');
  root.updateMatrixWorld(true);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const groups = [root.getObjectByName('sheep'), root.getObjectByName('sheep_head'), ...LEGS.map((n) => root.getObjectByName(n))];
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh);
    const geos = meshes.map((m) => {
      let geo = m.geometry.clone();
      if (geo.index) geo = geo.toNonIndexed();
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      geo.applyMatrix4(m.matrix);
      const c = m.material.color;
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    });
    for (const m of meshes) g.remove(m);
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.geometry.userData.shared = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  root.scale.setScalar(SCALE);
  return root;
}

export class Flocks {
  constructor(scene, game) {
    this.game = game;
    this.grid = game.grid;
    this.sheep = [];
    this.farms = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
    if (!A.has('custom/sheep')) return;
    template ??= buildTemplate();
    this.lastTime = game.time;

    let seed = (game.seed * 9301 + 49297) % 233280;
    this.rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

    const herds = Math.round(this.grid.size / 32) + 1;
    for (let h = 0; h < herds; h++) {
      const c = this.findPasture();
      if (!c) continue;
      c.range = 5;
      const count = 3 + Math.floor(this.rand() * 3);
      for (let i = 0; i < count; i++) this.spawn(c);
    }
  }

  spawn(herd) {
    const o = template.clone();
    const s = {
      o, herd,
      x: herd.x + (this.rand() - 0.5) * 2, z: herd.z + (this.rand() - 0.5) * 2,
      dir: this.rand() * Math.PI * 2, tx: null, tz: null,
      wait: this.rand() * 6, ph: this.rand() * 10,
      head: o.getObjectByName('sheep_head'),
      legs: LEGS.map((n) => o.getObjectByName(n)),
    };
    this.group.add(o);
    this.sheep.push(s);
    return s;
  }

  despawn(s) {
    this.group.remove(s.o);
    this.sheep.splice(this.sheep.indexOf(s), 1);
  }

  // Herden der Schäfereien: Anzahl nach Ausbaustufe, verschwinden beim Abriss
  syncFarms() {
    for (const b of this.game.buildings) {
      if (b.type !== 'sheepfarm' || !b.done || b.removed || this.farms.has(b)) continue;
      this.farms.set(b, { x: b.x + 0.5, z: b.z + 0.5, farm: b, range: BUILDINGS.sheepfarm.herdRadius * 2, members: [] });
    }
    for (const [b, herd] of this.farms) {
      const want = b.removed ? 0 : BUILDINGS.sheepfarm.sheep[b.level - 1];
      while (herd.members.length < want) herd.members.push(this.spawn(herd));
      while (herd.members.length > want) this.despawn(herd.members.pop());
      if (b.removed) this.farms.delete(b);
    }
  }

  // Während der Schäfer melkt, kommt das nächste Schaf zu ihm
  milking(herd) {
    const w = herd.farm.workers[0];
    const at = w?.milkAt;
    if (at && !herd.milker && herd.members.length) {
      const m = herd.members.reduce((a, c) => (Math.hypot(c.x - at.x, c.z - at.z) < Math.hypot(a.x - at.x, a.z - at.z) ? c : a));
      const a = Math.atan2(m.x - at.x, m.z - at.z);
      m.tx = at.x + Math.sin(a) * 0.32; m.tz = at.z + Math.cos(a) * 0.32;
      m.milked = at;
      herd.milker = m;
    } else if (!at && herd.milker) {
      herd.milker.milked = null;
      herd.milker.wait = 1 + this.rand() * 2;
      herd.milker = null;
    }
  }

  free(x, z) {
    const g = this.grid;
    const tx = Math.floor(x), tz = Math.floor(z);
    if (!g.walkable(tx, tz) || g.waterNear(tx, tz, 1)) return false;
    const i = g.idx(tx, tz);
    return g.field[i] < 0 && g.resource[i] < 0 && !g.road[i] && g.slope(tx, tz) < 0.5;
  }

  // Freie Wiese mit Abstand zum Dorf
  findPasture() {
    const g = this.grid, N = g.size, st = this.game.start;
    for (let k = 0; k < 400; k++) {
      const x = 3 + Math.floor(this.rand() * (N - 6)), z = 3 + Math.floor(this.rand() * (N - 6));
      if (Math.hypot(x - st.x, z - st.z) < 12) continue;
      let ok = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (this.free(x + dx + 0.5, z + dz + 0.5)) ok++;
      if (ok >= 20) return { x: x + 0.5, z: z + 0.5 };
    }
    return null;
  }

  // Ab und zu blökt ein Schaf in der Nähe der Kamera
  bleat(dt) {
    this.baaT = (this.baaT ?? 3) - dt;
    if (this.baaT > 0 || !this.onSound || !this.listener) return;
    this.baaT = 4 + this.rand() * 9;
    const L = this.listener;
    const near = this.sheep.filter((s) => Math.hypot(s.x - L.x, s.z - L.z) < 18);
    if (near.length) {
      const s = near[Math.floor(this.rand() * near.length)];
      this.onSound(s.x, s.z);
    }
  }

  update(t) {
    if (!template) return;
    const dt = Math.min(0.5, this.game.time - this.lastTime);
    this.lastTime = this.game.time;
    const g = this.grid;
    this.syncFarms();
    this.bleat(dt);
    for (const herd of this.farms.values()) this.milking(herd);
    for (const s of this.sheep) {
      let moving = false;
      if (s.tx === null && s.milked) {
        s.dir = Math.atan2(s.milked.x - s.x, s.milked.z - s.z);
      } else if (s.tx === null) {
        s.wait -= dt;
        if (s.wait <= 0) {
          // Wilde Herden wandern gelegentlich weiter
          if (!s.herd.farm && this.rand() < 0.05) {
            const nx = s.herd.x + (this.rand() - 0.5) * 6, nz = s.herd.z + (this.rand() - 0.5) * 6;
            if (this.free(nx, nz)) { s.herd.x = nx; s.herd.z = nz; }
          }
          const tx = s.herd.x + (this.rand() - 0.5) * s.herd.range, tz = s.herd.z + (this.rand() - 0.5) * s.herd.range;
          if (this.free(tx, tz)) { s.tx = tx; s.tz = tz; }
          s.wait = 3 + this.rand() * 8;
        }
      } else {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
        const step = SPEED * dt;
        const nx = s.x + (dx / d) * step, nz = s.z + (dz / d) * step;
        if (d < 0.05 || (!s.milked && !this.free(nx, nz) && this.free(s.x, s.z))) s.tx = null;
        else {
          s.x = nx; s.z = nz;
          s.dir = Math.atan2(dx, dz);
          moving = dt > 0;
        }
      }

      const o = s.o;
      o.position.set(s.x, g.heightAt(s.x, s.z), s.z);
      let diff = s.dir - o.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      o.rotation.y += diff * Math.min(1, dt * 4);
      const ph = t * 9 + s.ph;
      s.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(ph + (i % 2) * Math.PI) * 0.4 : 0; });
      // Stehend: Kopf zum Grasen senken
      const graze = moving ? 0 : 0.45 + Math.sin(t * 0.7 + s.ph) * 0.35;
      s.head.rotation.x += ((Math.max(0, graze) * 0.9) - s.head.rotation.x) * Math.min(1, dt * 3);
    }
  }
}
