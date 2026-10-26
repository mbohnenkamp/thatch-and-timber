import * as THREE from 'three';
import { RANKS, rankIndex } from '../goals.js';

// Ortsschilder: wo Wege das Gebiet verlassen, sonst in den vier Richtungen vom ersten Lager.
// Je Stufe ein schöneres Schild: Holzbrett, gelbes Ortsschild, als Stadt mit Wappen und Fahnen.
const STYLE = [
  { board: '#9a6a3c', ink: '#f3e6c8', w: 0.75, h: 0.34, posts: 1 },
  { board: '#c9a77a', ink: '#2e2116', w: 0.85, h: 0.38, posts: 1, frame: '#6e4423' },
  { board: '#f2c230', ink: '#1a1a1a', w: 1.0, h: 0.44, posts: 2, frame: '#1a1a1a' },
  { board: '#f2c230', ink: '#1a1a1a', w: 1.1, h: 0.48, posts: 2, frame: '#1a1a1a', stone: true },
  { board: '#f2c230', ink: '#1a1a1a', w: 1.2, h: 0.52, posts: 2, frame: '#1a1a1a', stone: true, crest: true, flags: true },
];
const MAX_SIGNS = 4;

function signTexture(name, rank, st) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * st.h) / st.w);
  const x = c.getContext('2d');
  x.fillStyle = st.board;
  x.fillRect(0, 0, c.width, c.height);
  if (st.frame) {
    x.strokeStyle = st.frame;
    x.lineWidth = 12;
    x.strokeRect(14, 14, c.width - 28, c.height - 28);
  }
  let left = 0;
  if (st.crest) {
    // Wappen: Schild mit Turm
    const cx = 70, cy = c.height / 2, s = c.height * 0.32;
    x.fillStyle = '#b3472f';
    x.beginPath();
    x.moveTo(cx - s, cy - s);
    x.lineTo(cx + s, cy - s);
    x.lineTo(cx + s, cy + s * 0.2);
    x.quadraticCurveTo(cx, cy + s * 1.4, cx - s, cy + s * 0.2);
    x.closePath();
    x.fill();
    x.fillStyle = '#f3e6c8';
    x.fillRect(cx - s * 0.35, cy - s * 0.5, s * 0.7, s * 0.95);
    for (const dx of [-0.35, -0.05, 0.25]) x.fillRect(cx + dx * s, cy - s * 0.7, s * 0.12, s * 0.22);
    left = 60;
  }
  x.fillStyle = st.ink;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const mid = c.width / 2 + left;
  let size = Math.round(c.height * 0.36);
  x.font = `bold ${size}px Georgia, serif`;
  while (x.measureText(name).width > c.width - 70 - left * 2 && size > 20) x.font = `bold ${--size}px Georgia, serif`;
  x.fillText(name, mid, c.height * 0.42);
  x.font = `${Math.round(c.height * 0.17)}px Georgia, serif`;
  x.fillText(rank, mid, c.height * 0.76);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class TownSigns {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.key = '';
  }

  // Schildplätze: Grenzfelder mit Weg, möglichst weit auseinander
  spots() {
    const g = this.game, grid = g.grid, N = g.size;
    const inside = (x, z) => g.inTerritory(x, z);
    const edge = (x, z) => inside(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => grid.inBounds(x + dx, z + dz) && !inside(x + dx, z + dz));
    const free = (x, z) => grid.walkable(x, z) && grid.resource[grid.idx(x, z)] < 0 && grid.bridge[grid.idx(x, z)] < 0;
    const home = g.warehouses[0] || g.start;
    const cands = [];
    for (let z = 1; z < N - 1; z++)
      for (let x = 1; x < N - 1; x++) {
        const lvl = grid.road[grid.idx(x, z)];
        if (lvl && edge(x, z) && free(x, z)) cands.push({ x, z, score: lvl * 10 + Math.hypot(x - home.x, z - home.z) * 0.01 });
      }
    cands.sort((a, b) => b.score - a.score);
    const picked = [];
    for (const c of cands) if (picked.length < MAX_SIGNS && picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 9)) picked.push(c);
    // Ohne Wege: geradeaus vom Lager bis an den Rand
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (picked.length >= 2) break;
      let x = home.x, z = home.z;
      while (inside(x + dx, z + dz)) { x += dx; z += dz; }
      if (free(x, z) && picked.every((p) => Math.hypot(p.x - x, p.z - z) > 9)) picked.push({ x, z });
    }
    return picked.map((p) => ({ ...p, dir: Math.atan2(p.x - home.x, p.z - home.z) }));
  }

  refresh() {
    const g = this.game;
    const rank = rankIndex(g);
    const spots = this.spots();
    const key = `${rank}|${spots.map((p) => `${p.x},${p.z}`).join(';')}`;
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const st = STYLE[rank];
    const tex = signTexture(g.townName, RANKS[rank], st);
    const face = new THREE.MeshLambertMaterial({ map: tex });
    const wood = new THREE.MeshLambertMaterial({ color: st.stone ? '#8f8a80' : '#6e4423', flatShading: true });
    const flag = new THREE.MeshLambertMaterial({ color: '#b3472f', side: THREE.DoubleSide });
    this.mats = [face, wood, flag];
    this.tex = tex;
    for (const p of spots) this.group.add(this.sign(p, st, face, wood, flag));
  }

  sign(p, st, face, wood, flag) {
    const grid = this.game.grid;
    const o = new THREE.Group();
    // Etwas neben die Wegmitte, damit niemand durchs Schild läuft
    const side = 0.42;
    const px = p.x + 0.5 + Math.cos(p.dir) * side, pz = p.z + 0.5 - Math.sin(p.dir) * side;
    o.position.set(px, grid.heightAt(px, pz), pz);
    o.rotation.y = p.dir;
    o.scale.setScalar(1.4);
    const top = 0.55 + st.h;
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      o.add(m);
      return m;
    };
    const postX = st.posts === 2 ? [-st.w * 0.4, st.w * 0.4] : [0];
    for (const x of postX) add(new THREE.BoxGeometry(0.06, top, 0.06), wood, x, top / 2, 0);
    if (st.stone) for (const x of postX) add(new THREE.BoxGeometry(0.14, 0.12, 0.14), wood, x, 0.06, 0);
    add(new THREE.BoxGeometry(st.w + 0.04, st.h + 0.04, 0.03), wood, 0, 0.55 + st.h / 2, 0);
    // Schrift auf beiden Seiten lesbar
    for (const s of [1, -1]) {
      const m = add(new THREE.PlaneGeometry(st.w, st.h), face, 0, 0.55 + st.h / 2, s * 0.017);
      if (s < 0) m.rotation.y = Math.PI;
    }
    if (st.flags) for (const x of postX) {
      add(new THREE.BoxGeometry(0.03, 0.5, 0.03), wood, x, top + 0.25, 0);
      add(new THREE.PlaneGeometry(0.24, 0.15), flag, x + 0.13, top + 0.42, 0);
    }
    return o;
  }

  clear() {
    for (const o of [...this.group.children]) {
      o.traverse((m) => m.geometry?.dispose());
      this.group.remove(o);
    }
    this.mats?.forEach((m) => m.dispose());
    this.tex?.dispose();
  }
}
