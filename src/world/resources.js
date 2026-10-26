import { RESOURCES } from '../config.js';

export function placeResources(grid, map, rng, fbm, start) {
  const N = grid.size;
  const nodes = [];

  const add = (type, x, z) => {
    const def = RESOURCES[type];
    const node = {
      id: nodes.length, type, x, z,
      amount: def.amount, max: def.amount, timer: 0,
      gone: false, reserved: false, blockedUntil: 0,
      variant: rng() < 0.5 ? 0 : 1,
      rot: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.4,
      ox: (rng() - 0.5) * 0.4,
      oz: (rng() - 0.5) * 0.4,
    };
    nodes.push(node);
    grid.resource[grid.idx(x, z)] = node.id;
  };

  const near = (x, z, r) => Math.max(Math.abs(x - start.x), Math.abs(z - start.z)) <= r;
  const free = (x, z) => grid.inBounds(x, z) && grid.resource[grid.idx(x, z)] < 0;

  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      if (near(x, z, 4)) continue;
      if (grid.isWater(x, z)) {
        if (grid.isShore(x, z) && rng() < map.fish) add('fish', x, z);
        continue;
      }
      const h = grid.tileHeight(x, z), s = grid.slope(x, z);
      const forest = fbm((x / 64) * 6 + 30, (z / 64) * 6 + 30);
      if ((h > map.rockHeight || s > 0.9) && rng() < map.rockDensity) add('rock', x, z);
      else if (forest > map.forestThreshold && s < 1.5 && rng() < map.treeDensity) add('tree', x, z);
      else if (rng() < map.rockScatter) add('rock', x, z);
      else if (s < 0.6 && rng() < map.berry) add('berry', x, z);
    }

  // Jede Karte bekommt genug Startmaterial in Reichweite
  const ensure = (type, min, rMin, rMax) => {
    let count = nodes.filter((n) => n.type === type && near(n.x, n.z, rMax)).length;
    for (let tries = 0; count < min && tries < 600; tries++) {
      const x = start.x + Math.round((rng() * 2 - 1) * rMax);
      const z = start.z + Math.round((rng() * 2 - 1) * rMax);
      if (!free(x, z) || near(x, z, rMin - 1) || grid.isWater(x, z) || grid.slope(x, z) > 1) continue;
      add(type, x, z);
      count++;
    }
  };
  ensure('tree', 12, 5, 11);
  ensure('rock', 6, 5, 9);
  ensure('berry', 5, 5, 9);

  if (!nodes.some((n) => n.type === 'fish' && near(n.x, n.z, 14))) {
    let added = 0;
    for (let z = start.z - 14; z <= start.z + 14 && added < 4; z++)
      for (let x = start.x - 14; x <= start.x + 14 && added < 4; x++)
        if (free(x, z) && grid.isWater(x, z) && grid.isShore(x, z) && rng() < 0.3) {
          add('fish', x, z);
          added++;
        }
  }

  // Sichere Felsgruppe in Reichweite: ohne genug Stein ist das Spiel nicht zu schaffen.
  // Kommt ans Ende der Liste, damit ältere Spielstände ihre Ressourcen behalten.
  const STONE_MIN = 160;
  const stoneNear = () => nodes.filter((n) => n.type === 'rock' && near(n.x, n.z, 16)).reduce((a, n) => a + n.amount, 0);
  for (let tries = 0; stoneNear() < STONE_MIN && tries < 200; tries++) {
    const a = rng() * Math.PI * 2, d = 9 + rng() * 6;
    const cx = Math.round(start.x + Math.cos(a) * d), cz = Math.round(start.z + Math.sin(a) * d);
    if (!free(cx, cz) || grid.isWater(cx, cz) || grid.slope(cx, cz) > 1) continue;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, z = cz + dz;
        if (stoneNear() >= STONE_MIN || Math.hypot(dx, dz) > 2.3 || rng() < 0.35) continue;
        if (free(x, z) && !grid.isWater(x, z) && grid.slope(x, z) < 1.2 && !near(x, z, 6)) add('rock', x, z);
      }
  }

  // Genug Beeren für den Anfang (ebenfalls am Ende der Liste)
  const berriesNear = () => nodes.filter((n) => n.type === 'berry' && near(n.x, n.z, 11)).length;
  for (let tries = 0; berriesNear() < 8 && tries < 400; tries++) {
    const x = start.x + Math.round((rng() * 2 - 1) * 11), z = start.z + Math.round((rng() * 2 - 1) * 11);
    if (free(x, z) && !near(x, z, 4) && !grid.isWater(x, z) && grid.slope(x, z) < 0.6) add('berry', x, z);
  }

  // Nie ganz ohne Stein: verstreute Felsen, bis mindestens 5 Stein je 100 Felder auf der Karte liegen
  const stoneAll = () => nodes.filter((n) => n.type === 'rock').reduce((a, n) => a + n.amount, 0);
  for (let tries = 0; stoneAll() < N * N * 0.05 && tries < 4000; tries++) {
    const x = Math.floor(rng() * N), z = Math.floor(rng() * N);
    if (free(x, z) && !near(x, z, 6) && !grid.isWater(x, z) && grid.slope(x, z) < 1.2) add('rock', x, z);
  }

  // Erz und Kohle in Gruppen, am liebsten auf Anhöhen; Bergland viel und nah, Flussebene wenig und weit
  const DEPOSITS = { mountains: [3, 12, 22], forest: [2, 14, 26], river: [1, 18, 30] }[map.key] || [1, 14, 26];
  const [groups, dMin, dMax] = DEPOSITS;
  for (const type of ['ore', 'coal'])
    for (let k = 0; k < groups; k++) {
      let best = null;
      for (let tries = 0; tries < 40; tries++) {
        const a = rng() * Math.PI * 2, d = dMin + rng() * (dMax - dMin) * (k + 1) / groups;
        const cx = Math.round(start.x + Math.cos(a) * d), cz = Math.round(start.z + Math.sin(a) * d);
        if (!free(cx, cz) || grid.isWater(cx, cz) || grid.slope(cx, cz) > 1.2 || cx < 3 || cz < 3 || cx > N - 4 || cz > N - 4) continue;
        if (!best || grid.tileHeight(cx, cz) > grid.tileHeight(best.x, best.z)) best = { x: cx, z: cz };
      }
      if (!best) continue;
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = best.x + dx, z = best.z + dz;
          if (Math.hypot(dx, dz) > 2.3 || rng() < 0.4) continue;
          if (free(x, z) && !grid.isWater(x, z) && grid.slope(x, z) < 1.4 && !near(x, z, 6)) add(type, x, z);
        }
    }

  return nodes;
}

// Nachwachsen hängt von der Jahreszeit ab (im Winter wächst fast nichts)
const SEASON_FACTOR = { tree: 'trees', berry: 'berries', fish: 'fish' };

export function updateResources(game, dt) {
  for (const n of game.resources) {
    if (n.gone || n.amount >= n.max) continue;
    const def = RESOURCES[n.type];
    if (!def.regrow || (!def.gradual && n.amount > 0)) continue;
    n.timer += dt * (game.season?.[SEASON_FACTOR[n.type]] ?? 1);
    if (n.timer >= def.regrow) {
      n.timer = 0;
      n.amount = def.gradual ? n.amount + 1 : n.max;
      game.emit('resource', n);
    }
  }
}

export function harvest(game, n) {
  n.amount--;
  if (n.amount <= 0) {
    n.amount = 0;
    n.timer = 0;
    if (!RESOURCES[n.type].regrow) {
      n.gone = true;
      game.grid.resource[game.grid.idx(n.x, n.z)] = -1;
    }
  }
  game.emit('resource', n);
}
