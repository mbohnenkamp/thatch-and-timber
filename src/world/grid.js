import { ROAD } from '../config.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

class Heap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const { items, prio } = this;
    items.push(item); prio.push(p);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prio[parent] <= prio[i]) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      [prio[i], prio[parent]] = [prio[parent], prio[i]];
      i = parent;
    }
  }
  pop() {
    const { items, prio } = this;
    const top = items[0];
    const lastItem = items.pop(), lastPrio = prio.pop();
    if (items.length) {
      items[0] = lastItem; prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < items.length && prio[l] < prio[m]) m = l;
        if (r < items.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        [prio[i], prio[m]] = [prio[m], prio[i]];
        i = m;
      }
    }
    return top;
  }
}

export class Grid {
  constructor(size) {
    this.size = size;
    this.heights = new Float32Array((size + 1) * (size + 1));
    this.water = new Uint8Array(size * size);
    this.resource = new Int32Array(size * size).fill(-1);
    this.building = new Int32Array(size * size).fill(-1);
    this.field = new Int32Array(size * size).fill(-1);
    this.traffic = new Float32Array(size * size);
    this.road = new Uint8Array(size * size);
    this.bridge = new Int32Array(size * size).fill(-1);   // Brücken-Id auf Brückenkopf und Wasserfeldern
    this.deck = new Uint8Array(size * size);              // fertige Brücke: Wasser ist begehbar
    this.waterLevel = 0;
  }

  idx(x, z) { return z * this.size + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.size && z < this.size; }
  corner(x, z) { return this.heights[z * (this.size + 1) + x]; }
  setCorner(x, z, h) { this.heights[z * (this.size + 1) + x] = h; }

  tileHeight(x, z) {
    return (this.corner(x, z) + this.corner(x + 1, z) + this.corner(x, z + 1) + this.corner(x + 1, z + 1)) / 4;
  }

  slope(x, z) {
    const h = [this.corner(x, z), this.corner(x + 1, z), this.corner(x, z + 1), this.corner(x + 1, z + 1)];
    return Math.max(...h) - Math.min(...h);
  }

  // Weich gerundete Geländehöhe (Catmull-Rom über die Eckpunkte), nur für die Darstellung
  heightAt(px, pz) {
    const N = this.size;
    const x = Math.min(Math.max(px, 0), N), z = Math.min(Math.max(pz, 0), N);
    const x1 = Math.min(Math.floor(x), N - 1), z1 = Math.min(Math.floor(z), N - 1);
    const fx = x - x1, fz = z - z1;
    const c = (i, j) => this.corner(Math.min(Math.max(i, 0), N), Math.min(Math.max(j, 0), N));
    const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    const row = (j) => cr(c(x1 - 1, j), c(x1, j), c(x1 + 1, j), c(x1 + 2, j), fx);
    return cr(row(z1 - 1), row(z1), row(z1 + 1), row(z1 + 2), fz);
  }

  isWater(x, z) { return this.water[this.idx(x, z)] === 1; }

  // Zusammenhängende Landstücke (nur Wasser ohne Brücke trennt); neu berechnet, wenn sich Brücken ändern
  landId(x, z) {
    if (!this.land) {
      const N = this.size, land = (this.land = new Int32Array(N * N).fill(-1));
      let next = 0;
      for (let i = 0; i < N * N; i++) {
        if (land[i] >= 0 || this.blocked(i)) continue;
        const stack = [i];
        land[i] = next;
        while (stack.length) {
          const j = stack.pop(), x0 = j % N, z0 = (j - x0) / N;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x0 + dx, nz = z0 + dz;
            if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
            const k = nz * N + nx;
            if (land[k] < 0 && !this.blocked(k)) { land[k] = next; stack.push(k); }
          }
        }
        next++;
      }
    }
    return this.land[this.idx(x, z)];
  }

  blocked(i) { return this.water[i] && !this.deck[i]; }

  isShore(x, z) {
    for (const [dx, dz] of DIRS.slice(0, 4)) {
      const nx = x + dx, nz = z + dz;
      if (this.inBounds(nx, nz) && !this.isWater(nx, nz)) return true;
    }
    return false;
  }

  waterNear(x, z, r) {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++)
        if (this.inBounds(x + dx, z + dz) && this.isWater(x + dx, z + dz)) return true;
    return false;
  }

  walkable(x, z) {
    if (!this.inBounds(x, z)) return false;
    const i = this.idx(x, z);
    return !this.blocked(i) && this.building[i] < 0;
  }

  roadAt(x, z) { return this.inBounds(x, z) ? this.road[this.idx(x, z)] : 0; }

  hasRoadAccess(x, z) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dz) && this.roadAt(x + dx, z + dz) === 2 && this.walkable(x + dx, z + dz)) return true;
    return false;
  }

  // adjacent: Ziel ist ein begehbares Nachbarfeld von (tx, tz); roadOnly: nur über Straßen (Pferdekarren)
  // passable: eigene Begehbarkeitsprüfung (z. B. für Straßenplanung)
  findPath(sx, sz, tx, tz, adjacent, roadOnly = false, passable = null) {
    const ok = passable || ((x, z) => this.walkable(x, z));
    const N = this.size;
    const isGoal = adjacent
      ? (x, z) => Math.max(Math.abs(x - tx), Math.abs(z - tz)) === 1
      : (x, z) => x === tx && z === tz;
    const h = (x, z) => {
      const dx = Math.abs(x - tx), dz = Math.abs(z - tz);
      return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * ROAD.cost[2];
    };

    const g = new Float32Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    const heap = new Heap();
    const start = this.idx(sx, sz);
    g[start] = 0;
    heap.push(start, h(sx, sz));

    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % N, cz = (cur / N) | 0;
      if (isGoal(cx, cz)) {
        const path = [];
        for (let i = cur; i !== start; i = from[i]) path.push({ x: i % N, z: (i / N) | 0 });
        return path.reverse();
      }
      const ch = this.tileHeight(cx, cz);
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!ok(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (roadOnly && this.road[ni] !== 2) continue;
        if (dx && dz && (!ok(cx + dx, cz) || !ok(cx, cz + dz))) continue;
        if (closed[ni]) continue;
        const ng = g[cur] + cost * ROAD.cost[this.road[ni]] + Math.abs(this.tileHeight(nx, nz) - ch) * 0.8;
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          heap.push(ni, ng + h(nx, nz));
        }
      }
    }
    return null;
  }
}
