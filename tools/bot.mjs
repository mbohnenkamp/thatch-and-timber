// Testspieler: baut nach fester Liste, ergänzt Nahrung, Türme und Ausbauten.
// Wird vom Balancing-Test (Node) und im Browser für Probeläufe benutzt.
import { BUILDINGS, SEASON_LENGTH } from '../src/config.js';
import { isUnlocked } from '../src/goals.js';
import { isSite, upgradeCost } from '../src/entities/buildings.js';

export function makeBot(g) {
  const of = (t) => g.buildings.filter((b) => b.type === t && !b.removed);
  const openSites = () => g.buildings.filter((b) => isSite(b)).length;
  // Ein Mensch baut nicht beliebig viele Türme
  const towerOk = () => of('tower').length < 25 && !of('tower').some(isSite);

  // Platz suchen: im Gebiet, bewertet nach Nähe zum Lager und zu passenden Ressourcen
  function spot(type) {
    const wh = g.warehouses[0];
    const def = BUILDINGS[type];
    const wanted = def.resource;
    let best = null, bs = -Infinity;
    for (let z = 1; z < g.size - 1; z++)
      for (let x = 1; x < g.size - 1; x++) {
        if (!g.inTerritory(x, z) || g.placeError(type, x, z)) continue;
        let score = -Math.hypot(x - wh.x, z - wh.z) * 0.5;
        if (wanted) {
          let n = 0;
          for (const r of g.resources) if (r.type === wanted && !r.gone && Math.hypot(r.x - x, r.z - z) < 9) n++;
          if (!n) continue;
          score += Math.min(n, 25) * 2;
        }
        if (type === 'farm') {
          let open = 0;
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (g.grid.walkable(x + dx, z + dz) && g.grid.resource[g.grid.idx(x + dx, z + dz)] < 0) open++;
          score += open;
        }
        if (score > bs) { bs = score; best = { x, z }; }
      }
    return best;
  }

  // Wachturm am Rand, dort wo am meisten freie Fläche außerhalb liegt
  function towerSpot() {
    let best = null, bs = -1;
    for (let z = 1; z < g.size - 1; z++)
      for (let x = 1; x < g.size - 1; x++) {
        if (!g.inTerritory(x, z) || g.placeError('tower', x, z)) continue;
        let outside = 0;
        for (let dz = -8; dz <= 8; dz += 2) for (let dx = -8; dx <= 8; dx += 2) if (!g.inTerritory(x + dx, z + dz) && g.grid.walkable(x + dx, z + dz)) outside++;
        if (outside > bs) { bs = outside; best = { x, z }; }
      }
    return best;
  }

  const ORDER = [
    'woodcutter', 'gatherer', 'quarry', 'fisher', 'house', 'woodcutter', 'farm', 'sawmill', 'quarry', 'house', 'mill',
    'bakery', 'well', 'toolmaker', 'oremine', 'coalmine', 'smelter', 'sheepfarm', 'house', 'woodcutter', 'gatherer', 'house', 'farm', 'house', 'sheepfarm', 'house', 'house',
  ];
  let next = 0;
  const log = [];
  const note = (msg) => log.push(`${fmt(g.time)}  ${msg}`);
  const fmt = (t) => `J${Math.floor(t / SEASON_LENGTH / 4) + 1} ${['Fr', 'So', 'He', 'Wi'][Math.floor(t / SEASON_LENGTH) % 4]} ${String(Math.floor(t / 60)).padStart(3)} min`;

  // Wachturm Richtung Felsen (oder Erz/Kohle), wenn in Reichweite nichts mehr liegt
  function rockTowerSpot(type = 'rock') {
    let best = null, bs = 0;
    for (let z = 1; z < g.size - 1; z++)
      for (let x = 1; x < g.size - 1; x++) {
        if (!g.inTerritory(x, z) || g.placeError('tower', x, z)) continue;
        let n = 0;
        for (const r of g.resources) if (r.type === type && !r.gone && !g.inTerritory(r.x, r.z) && Math.hypot(r.x - x, r.z - z) < 14) n += r.amount;
        if (n > bs) { bs = n; best = { x, z }; }
      }
    return best;
  }

  const FOOD = ['fisher', 'sheepfarm', 'farm', 'gatherer', 'sheepfarm', 'fisher', 'farm', 'bakery', 'mill'];
  let foodNext = 0;

  function think() {
    // Markt auf Holz -> Eisen stellen, sobald er steht
    // Wie ein Spieler: Markt auf Holz -> Eisen, bei Steinmangel und genug Eisen auf Holz -> Stein
    // Mit zwei Märkten: einer für Eisen, einer für Stein
    const markets = of('market');
    markets.forEach((m, i) => {
      if (!m.done) return;
      const want = markets.length > 1 ? (i ? 'stone' : 'iron') : g.total('stone') < 50 && g.total('iron') >= 8 ? 'stone' : 'iron';
      if (m.trade?.get !== want) { g.setTrade(m, 'wood', want); note(`Markt tauscht Holz gegen ${want === 'stone' ? 'Stein' : 'Eisen'}`); }
    });
    if (openSites() >= 2) return;
    // Werkzeug wird knapp und keine Schmelze läuft: Markt bauen
    if (g.total('tools') <= 3 && isUnlocked(g, 'market') && !of('market').length && !of('smelter').some((b) => b.done && b.workers.length) && g.canAfford(BUILDINGS.market.cost)) {
      const s = spot('market');
      if (s) { g.place('market', s.x, s.z); note('baut Markt (Werkzeug knapp)'); return; }
    }
    // Wie ein Spieler: freie Hände und schrumpfende Nahrung -> neue Nahrungshütte
    if (g.freeCount >= 3 && g.available('tools') > 0 && (g.foodRising === false || g.foodPoints() < g.settlers.length) && next > 6) {
      const type = FOOD[foodNext % FOOD.length];
      if (g.canAfford(BUILDINGS[type].cost)) {
        const s = spot(type);
        foodNext++;
        if (s) { g.place(type, s.x, s.z); note(`baut ${BUILDINGS[type].name} (Nahrung)`); return; }
      }
    }
    const quarries = of('quarry').filter((b) => b.done);
    if (markets.length < 2 && quarries.length && quarries.every((b) => b.workers[0]?.status === 'Findet nichts in der Nähe') && g.canAfford(BUILDINGS.tower.cost) && towerOk()) {
      const t = rockTowerSpot();
      if (t) {
        g.place('tower', t.x, t.z);
        note('baut Wachturm Richtung Felsen');
        const q = spot('quarry');
        if (q && g.canAfford(BUILDINGS.quarry.cost)) { g.place('quarry', q.x, q.z); note('baut Steinbruch (neue Felsen)'); }
        return;
      }
    }
    // Erz und Kohle liegen herum, aber keine Schmelze; Holz wird knapp: mehr Holzfäller
    const extra = [];
    if (isUnlocked(g, 'smelter') && !of('smelter').length && g.total('ore') >= 4 && g.total('coal') >= 4) extra.push('smelter');
    if (g.total('wood') < 100 && of('woodcutter').length < 6 && g.settlers.length > 60) extra.push('woodcutter');
    for (const t of extra) {
      if (!g.canAfford(BUILDINGS[t].cost)) continue;
      const s = spot(t);
      if (s) { g.place(t, s.x, s.z); note(`baut ${BUILDINGS[t].name} (Nachschub)`); return; }
    }
    // Für die Zufriedenheit je einmal Wirtshaus, Kapelle, Marktplatz
    for (const t of ['tavern', 'chapel', 'plaza']) {
      if (!isUnlocked(g, t) || of(t).length || g.settlers.length < 20 || !g.canAfford(BUILDINGS[t].cost)) continue;
      const s = spot(t);
      if (s) { g.place(t, s.x, s.z); note(`baut ${BUILDINGS[t].name}`); return; }
    }
    // Großes Dorf: zweites Lagerhaus (mehr Träger) und zweite Bauhütte
    for (const t of ['warehouse', 'builderhut']) {
      if (!isUnlocked(g, 'warehouse') || of(t).length >= 2 || !g.canAfford(BUILDINGS[t].cost)) continue;
      const s = spot(t);
      if (s) { g.place(t, s.x, s.z); note(`baut zweite${t === 'warehouse' ? 's Lagerhaus' : ' Bauhütte'}`); return; }
    }
    // Als Stadt: Rathaus, dann (ab 100 Siedlern) das Denkmal
    if (isUnlocked(g, 'townhall') && markets.length === 1 && g.canAfford(BUILDINGS.market.cost)) {
      const s = spot('market');
      if (s) { g.place('market', s.x, s.z); note('baut zweiten Markt'); return; }
    }
    for (const t of ['townhall', 'monument']) {
      if (!isUnlocked(g, t) || of(t).length || (t === 'monument' && g.settlers.length < 100) || !g.canAfford(BUILDINGS[t].cost)) continue;
      const s = spot(t);
      if (s) { g.place(t, s.x, s.z); note(`baut ${BUILDINGS[t].name}`); return; }
    }
    // Wohnraum geht vor, wenn es eng wird
    const crowded = g.settlers.length >= g.housing - 1 && !of('house').some(isSite);
    // Ohne Minen keine Schmelze
    if (ORDER[next] === 'smelter' && !of('oremine').length) next++;
    // Noch gesperrt: das nächste freigeschaltete Gebäude der Liste vorziehen
    if (ORDER[next] && !isUnlocked(g, ORDER[next])) {
      const i = ORDER.findIndex((t, k) => k > next && isUnlocked(g, t));
      if (i > 0) [ORDER[next], ORDER[i]] = [ORDER[i], ORDER[next]];
    }
    let type = crowded ? 'house' : ORDER[next];
    if (!type) type = g.settlers.length >= g.housing - 2 ? 'house' : null;
    if (type && type !== 'fisher' || (type === 'fisher' && g.grid.water.some((w) => w))) {
      if (type && g.canAfford(BUILDINGS[type].cost)) {
        const s = spot(type);
        if (s) {
          g.place(type, s.x, s.z);
          note(`baut ${BUILDINGS[type].name}`);
          if (type === ORDER[next]) next++;
          return;
        }
        if (type === 'fisher') { next++; return; }   // kein Wasser in Reichweite
        // Kein Erz/keine Kohle im Gebiet: Wachturm dorthin, sonst auslassen (der Markt liefert Eisen)
        const dep = BUILDINGS[type].resource;
        if (dep === 'ore' || dep === 'coal') {
          const t = !of('market').length && g.canAfford(BUILDINGS.tower.cost) && towerOk() && rockTowerSpot(dep);
          if (t) { g.place('tower', t.x, t.z); note(`baut Wachturm Richtung ${dep === 'ore' ? 'Erz' : 'Kohle'}`); return; }
          next++;
          return;
        }
        if (g.canAfford(BUILDINGS.tower.cost) && towerOk()) {
          const t = towerSpot();
          if (t) { g.place('tower', t.x, t.z); note('baut Wachturm (kein Platz mehr)'); return; }
        }
      }
    } else if (type === 'fisher') next++;
    // Ausbauen: Lagerhaus, dann Wohnhäuser
    for (const b of [...of('warehouse'), ...of('house'), ...of('sawmill')]) {
      const cost = upgradeCost(b);
      if (cost && g.canAfford(cost) && openSites() < 2) {
        g.startUpgrade(b);
        note(`baut ${BUILDINGS[b.type].name} auf Stufe ${b.level + 1} aus`);
        return;
      }
    }
  }

  return { think, log, note, fmt };
}
