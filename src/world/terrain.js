import { Grid } from './grid.js';
import { mulberry32, makeNoise } from './noise.js';
import { placeResources } from './resources.js';
import { MAPS } from '../config.js';

const smoothstep = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// u, w: Lage in "Basis-Einheiten" (64 Felder = 1) -> Details bleiben auf jeder Kartengröße gleich fein
// nx, nz: Lage relativ zur ganzen Karte (0..1) -> Großformen wie Talrand und Flussverlauf
function heightFor(type, x, z, N, fbm, p) {
  const k = N / 64;
  const u = x / 64, w = z / 64;
  const nx = x / N, nz = z / N;
  const d = Math.hypot(nx - 0.5, nz - 0.5);
  // Erster See: zieht eine feste Tiefe ab (wie bisher, wichtig für alte Spielstände)
  // Auf größeren Karten auch hier ein unregelmäßiges Ufer (64er-Karten bleiben unverändert)
  const shore = (l) => (k > 1 ? 0.35 + 1.3 * fbm(u * 4 + l.x * 40, w * 4 + l.z * 40, 3) : 1);
  const lakes = (width, depth) => p.lakes.reduce((sum, l) => (l.big ? sum
    : sum + Math.exp(-(((u - l.x * k) ** 2 + (w - l.z * k) ** 2) * shore(l)) / width) * depth), 0);
  // Weitere Seen (nur große Karten): senken das Gelände auf eine Mulde unter dem Wasserspiegel ab
  const basins = (h) => p.lakes.reduce((acc, l) => {
    if (!l.big) return acc;
    // unregelmäßiges Ufer: Abstand mit Rauschen verzerrt
    const wobble = 0.35 + 1.3 * fbm(u * 4 + l.x * 40, w * 4 + l.z * 40, 3);
    const f = Math.min(1, Math.exp(-(((u - l.x * k) ** 2 + (w - l.z * k) ** 2) * wobble) / 0.012) * 1.6);
    return acc + (p.bottom - acc) * f;
  }, h);

  if (type === 'forest') {
    return basins(1.5 + fbm(u * 5, w * 5) * 1.2 + smoothstep(0.3, 0.7, d) * 4.5 - lakes(0.009, 1.9));
  }
  if (type === 'mountains') {
    const ridge = 1 - Math.abs(fbm(u * 3 + 10, w * 3 + 10) * 2 - 1);
    let h = 1.5 + fbm(u * 4, w * 4) * 2.5 + ridge ** 3 * 6 + smoothstep(0.3, 0.7, d) * 3;
    const flat = 1 - smoothstep(0.12, 0.25, d * k);
    h = h * (1 - flat) + (1.8 + fbm(u * 8, w * 8) * 0.5) * flat;
    return basins(h - lakes(0.004, 2.2));
  }
  const h = 1.4 + fbm(u * 4, w * 4) * 0.8;
  const rz = 0.5 + Math.sin(nx * Math.PI * 2.4 * Math.sqrt(k) + p.phase) * 0.12;
  return h - (1 - smoothstep(0.02, 0.065, Math.abs(nz - rz) * k)) * 1.3;
}

function isGoodStart(grid, x, z) {
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx, tz = z + dz;
      if (!grid.inBounds(tx, tz) || grid.isWater(tx, tz) || grid.slope(tx, tz) > 0.5) return false;
    }
  return true;
}

function findStart(grid) {
  const c = grid.size >> 1;
  for (let r = 0; r < c; r++)
    for (let z = c - r; z <= c + r; z++)
      for (let x = c - r; x <= c + r; x++) {
        if (Math.max(Math.abs(x - c), Math.abs(z - c)) !== r) continue;
        if (isGoodStart(grid, x, z)) return { x, z };
      }
  return { x: c, z: c };
}

export function generateWorld(mapType, seed, N = 64) {
  const rng = mulberry32(seed);
  const { fbm } = makeNoise(rng);
  const map = MAPS[mapType];
  const grid = new Grid(N);
  grid.waterLevel = map.waterLevel;

  // Erster See wie bisher (gleiche Zufallsfolge -> alte 64er-Spielstände bleiben identisch)
  const p = {
    bottom: MAPS[mapType].waterLevel - 0.7,
    phase: rng() * Math.PI * 2,
    lakes: [{ x: 0.5 + (rng() < 0.5 ? -1 : 1) * (0.14 + rng() * 0.06), z: 0.5 + (rng() - 0.5) * 0.3 }],
  };
  // Größere Karten bekommen weitere Seen, abseits der Mitte (Lage relativ zur Karte)
  const extra = mapType === 'river' ? 0 : Math.max(0, Math.round((N / 64) ** 2 * 0.75) - 1) + (mapType === 'mountains' && N > 64 ? 1 : 0);
  for (let i = 0; i < extra; i++) {
    const a = rng() * Math.PI * 2, r = 0.16 + rng() * 0.16;
    p.lakes.push({ x: 0.5 + Math.cos(a) * r, z: 0.5 + Math.sin(a) * r, big: true });
  }

  for (let z = 0; z <= N; z++)
    for (let x = 0; x <= N; x++)
      grid.setCorner(x, z, heightFor(mapType, x, z, N, fbm, p));

  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++)
      grid.water[grid.idx(x, z)] = grid.tileHeight(x, z) < grid.waterLevel ? 1 : 0;

  const start = findStart(grid);
  const resources = placeResources(grid, { ...map, key: mapType }, rng, fbm, start, N);
  return { grid, resources, start };
}
