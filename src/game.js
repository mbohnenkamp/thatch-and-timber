import { updateGoals } from './goals.js';
import { generateWorld } from './world/terrain.js';
import { seasonAt } from './seasons.js';
import { updateResources, harvest } from './world/resources.js';
import { createSettler, updateSettler, abortSettler, releaseJob, hasOpenWorkplace, canBuildOn, rebalanceJobs } from './entities/settlers.js';
import {
  createBuilding, placeError, bridgeTiles, isSite, siteCost, siteNeeds, upgradeCost, housingOf, outputItem,
} from './entities/buildings.js';
import { updateEconomy } from './economy.js';
import { START, BUILDINGS, WORK_RADIUS, ITEMS, GRAIN_GROW_TIME, BREAD_FOOD, ROAD, CART } from './config.js';

const ITEM_KEYS = Object.keys(ITEMS);
const NAME_A = ['Eichen', 'Birken', 'Linden', 'Buchen', 'Tannen', 'Hasel', 'Erlen', 'Weiden', 'Mühl', 'Stein', 'Rosen', 'Falken', 'Hirsch', 'Kranich', 'Wolfs', 'Sonnen'];
const NAME_B = ['bach', 'feld', 'au', 'hausen', 'tal', 'heim', 'brück', 'furt', 'berg', 'wald', 'rode', 'stedt'];

export class Game {
  constructor(mapType, seed, size = 64) {
    this.mapType = mapType;
    this.seed = seed;
    this.size = size;
    const world = generateWorld(mapType, seed, size);
    this.grid = world.grid;
    this.resources = world.resources;
    this.start = world.start;
    this.buildings = [];
    this.settlers = [];
    this.fields = [];
    this.carts = [];
    this.roadPlans = [];
    this.seasonsOn = true;
    this.goal = 0;
    this.season = seasonAt(0);
    this.roadTimer = 0;
    this.time = 0;
    this.nextId = 1;
    this.hunger = 0;
    this.hungry = false;
    this.hungerTime = 0;
    this.cityAt = null;
    this.growthTimer = 0;
    this.checkTimer = 0;
    this.handlers = {};
    this.territory = new Uint8Array(size * size);
    this.territoryDirty = true;
  }

  // Ortsname aus dem Seed: gleiche Karte, gleicher Name
  get townName() {
    const n = Math.abs(Math.floor(this.seed));
    return NAME_A[n % NAME_A.length] + NAME_B[Math.floor(n / NAME_A.length) % NAME_B.length];
  }

  // Gebiet = Kreise um fertige Lagerhäuser und Wachtürme
  updateTerritory() {
    const N = this.size, t = this.territory;
    t.fill(0);
    for (const b of this.buildings) {
      const r = b.done && !b.removed && BUILDINGS[b.type].territory?.[b.level - 1];
      if (!r) continue;
      // Brücke: Brückenkopf am anderen Ufer
      const c = b.span ? bridgeTiles(b.x, b.z, b.span).at(-1) : b;
      for (let z = Math.max(0, c.z - r); z <= Math.min(N - 1, c.z + r); z++)
        for (let x = Math.max(0, c.x - r); x <= Math.min(N - 1, c.x + r); x++)
          if (Math.hypot(x - c.x, z - c.z) <= r + 0.3) t[z * N + x] = 1;
    }
    this.territoryDirty = false;
    this.emit('territory', t);
  }

  inTerritory(x, z) {
    if (this.territoryDirty) this.updateTerritory();
    return x >= 0 && z >= 0 && x < this.size && z < this.size && this.territory[z * this.size + x] === 1;
  }

  static create(mapType, seed, size = 64) {
    const g = new Game(mapType, seed, size);
    const wh = g.addBuilding('warehouse', g.start.x, g.start.z, true);
    Object.assign(wh.stock, START.stock);
    const spot = g.findSpotNear('builderhut', wh);
    if (spot) g.addBuilding('builderhut', spot.x, spot.z, true);
    for (let i = 0; i < START.settlers; i++) g.spawnSettler(wh);
    return g;
  }

  on(event, fn) { (this.handlers[event] ||= []).push(fn); }
  emit(event, data) { this.handlers[event]?.forEach((fn) => fn(data)); }

  // --- Lager ---

  get warehouses() {
    return this.buildings.filter((b) => b.type === 'warehouse' && b.done && !b.removed);
  }

  nearestWarehouse(pos, except = null) {
    let best = null, bd = Infinity;
    for (const w of this.warehouses) {
      if (w === except) continue;
      const d = Math.hypot(w.x - pos.x, w.z - pos.z);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  // Ware ins nächste Lager legen (bei Abbruch, Abriss, umgeleiteter Lieferung)
  store(pos, item, amount, except = null) {
    if (amount <= 0) return;
    const w = pos.type === 'warehouse' && !pos.removed && pos.done ? pos : this.nearestWarehouse(pos, except);
    if (w) w.stock[item] += amount;
  }

  total(item) {
    return this.warehouses.reduce((sum, w) => sum + w.stock[item], 0);
  }

  // Was für Baustellen bestimmt, aber noch nicht aus dem Lager geholt ist
  reserved(item) {
    let sum = 0;
    for (const b of this.buildings) {
      if (!isSite(b)) continue;
      const need = (siteCost(b)[item] || 0) - (b.delivered[item] || 0) - (b.incoming[item] || 0);
      if (need > 0) sum += need;
    }
    return sum;
  }

  available(item) { return this.total(item) - this.reserved(item); }

  get stock() {
    return Object.fromEntries(ITEM_KEYS.map((k) => [k, this.available(k)]));
  }

  canAfford(cost) {
    return Object.entries(cost).every(([item, amount]) => this.available(item) >= amount);
  }

  // Nahrung zählt Beeren/Fisch einfach, Brot dreifach
  foodPoints() { return this.total('food') + this.total('bread') * BREAD_FOOD; }

  takeItem(item) {
    const w = this.warehouses.reduce((a, b) => (b.stock[item] > (a?.stock[item] ?? 0) ? b : a), null);
    if (!w || w.stock[item] <= 0) return false;
    w.stock[item]--;
    return true;
  }

  // Zieht Nahrungspunkte ab; gibt zurück, wie viele tatsächlich gedeckt wurden
  eat(points) {
    let paid = 0;
    while (paid < points) {
      if (this.takeItem('food')) paid += 1;
      else if (this.takeItem('bread')) paid += BREAD_FOOD;
      else break;
    }
    return paid;
  }

  // --- Wege ---

  roadLevel(traffic, current) {
    if (current === 2 || traffic >= ROAD.roadAt) return 2;
    return traffic >= ROAD.pathAt ? 1 : 0;
  }

  setRoad(i, level) {
    const g = this.grid;
    if (g.road[i] === level) return;
    const first = level === 1 && !this.hadPath;
    if (first) this.hadPath = true;
    g.road[i] = level;
    this.roadsDirty = true;
    this.emit('road', { x: i % g.size, z: Math.floor(i / g.size), level });
    if (first) this.emit('firstPath');
  }

  addTraffic(x, z) {
    const g = this.grid;
    const i = g.idx(x, z);
    if (g.building[i] >= 0 || g.field[i] >= 0) return;
    g.traffic[i] = Math.min(g.traffic[i] + 1, ROAD.roadAt * 2);
    this.setRoad(i, this.roadLevel(g.traffic[i], g.road[i]));
  }

  clearRoad(x, z) {
    const g = this.grid;
    const i = g.idx(x, z);
    g.traffic[i] = 0;
    this.setRoad(i, 0);
  }

  // Unbenutzte Trampelpfade verwildern, Straßen bleiben
  updateRoads(dt) {
    this.roadTimer += dt;
    if (this.roadTimer < ROAD.decayEvery) return;
    this.roadTimer = 0;
    const g = this.grid;
    for (let i = 0; i < g.traffic.length; i++) {
      if (!g.traffic[i] || g.road[i] === 2) continue;
      g.traffic[i] = Math.max(0, g.traffic[i] - ROAD.decay);
      this.setRoad(i, this.roadLevel(g.traffic[i], g.road[i]));
    }
  }

  // Zusammenhängende Straßennetze (für Pferdekarren), wird nur bei Änderungen neu berechnet
  roadComponents() {
    const g = this.grid;
    if (this.roadComp && !this.roadsDirty) return this.roadComp;
    const comp = new Int32Array(g.road.length).fill(-1);
    let id = 0;
    for (let i = 0; i < comp.length; i++) {
      if (g.road[i] !== 2 || comp[i] >= 0 || g.building[i] >= 0) continue;
      const stack = [i];
      comp[i] = id;
      while (stack.length) {
        const c = stack.pop();
        const cx = c % g.size, cz = (c / g.size) | 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, nz = cz + dz;
            if (!g.inBounds(nx, nz)) continue;
            const n = g.idx(nx, nz);
            if (comp[n] >= 0 || g.road[n] !== 2 || !g.walkable(nx, nz)) continue;
            if (dx && dz && (!g.walkable(cx + dx, cz) || !g.walkable(cx, cz + dz))) continue;
            comp[n] = id;
            stack.push(n);
          }
      }
      id++;
    }
    this.roadsDirty = false;
    return (this.roadComp = comp);
  }

  compAt(x, z) { return this.roadComponents()[this.grid.idx(Math.floor(x), Math.floor(z))]; }

  // Straßennetze, die direkt an einem Gebäude vorbeiführen
  accessComps(b) {
    const comp = this.roadComponents();
    const set = new Set();
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = b.x + dx, z = b.z + dz;
        if ((dx || dz) && this.grid.inBounds(x, z) && comp[this.grid.idx(x, z)] >= 0) set.add(comp[this.grid.idx(x, z)]);
      }
    return set;
  }

  // Ein wartender Karren im selben Straßennetz übernimmt den Auftrag
  cartWillServe(b) {
    return this.carts.some((c) => c.waiting && this.accessComps(b).has(this.compAt(c.x, c.z)));
  }

  // --- Selbst gebaute Straßen ---

  // Bäume und Büsche dürfen im Weg stehen (werden beim Pflastern entfernt), Felsen nicht
  canPaveTile(x, z) {
    const g = this.grid;
    if (!g.walkable(x, z) || !this.inTerritory(x, z)) return false;
    const i = g.idx(x, z);
    if (g.field[i] >= 0) return false;
    return g.resource[i] < 0 || this.resources[g.resource[i]].type !== 'rock';
  }

  // Verlauf von a nach b über bebaubare Felder, ohne schon vorhandene Straßen doppelt zu zählen
  roadRoute(a, b) {
    if (!this.canPaveTile(a.x, a.z) || !this.canPaveTile(b.x, b.z)) return null;
    const path = this.grid.findPath(a.x, a.z, b.x, b.z, false, false, (x, z) => this.canPaveTile(x, z));
    if (!path) return null;
    const tiles = [a, ...path];
    const isPlanned = (t) => this.roadPlans.some((p) => p.x === t.x && p.z === t.z);
    const fresh = tiles.filter((t) => this.grid.road[this.grid.idx(t.x, t.z)] !== 2 && !isPlanned(t));
    return { tiles, fresh, cost: fresh.length * ROAD.buildCost };
  }

  roadError(a, b) {
    const route = this.roadRoute(a, b);
    if (!route) return 'Dort kann keine Straße entlang (Wasser, Felsen, Felder, Gebäude oder außerhalb deines Gebiets)';
    if (this.available('stone') < route.cost) return `Nicht genug Stein: ${route.cost} nötig`;
    return null;
  }

  planRoad(a, b) {
    const route = this.roadRoute(a, b);
    if (!route || this.available('stone') < route.cost) return false;
    for (let n = 0; n < route.cost; n++) this.takeItem('stone');
    for (const t of route.fresh) {
      const plan = { x: t.x, z: t.z, builder: null };
      this.roadPlans.push(plan);
      this.emit('roadPlan', plan);
    }
    this.abortIdle();
    this.emit('sfx', { name: 'place', x: b.x + 0.5, z: b.z + 0.5 });
    return true;
  }

  // Ein Bauarbeiter hat ein Feld fertig gepflastert
  paveRoad(plan) {
    plan.removed = true;
    this.roadPlans = this.roadPlans.filter((p) => p !== plan);
    this.emit('roadPlanRemoved', plan);
    if (!this.canPaveTile(plan.x, plan.z)) {
      this.store(plan, 'stone', ROAD.buildCost);
      return;
    }
    const i = this.grid.idx(plan.x, plan.z);
    const r = this.grid.resource[i];
    if (r >= 0) {
      const n = this.resources[r];
      if (n.type === 'tree' && n.amount > 0) this.store(plan, 'wood', n.amount);
      n.gone = true;
      n.amount = 0;
      n.reserved = false;
      this.grid.resource[i] = -1;
      this.emit('resource', n);
    }
    this.grid.traffic[i] = Math.max(this.grid.traffic[i], ROAD.roadAt);
    this.setRoad(i, 2);
  }

  // --- Pferdekarren: je nach Lagerstufe ---

  syncCarts() {
    for (const w of this.warehouses) {
      const want = CART.perLevel[w.level - 1];
      const have = this.carts.filter((c) => c.workplace === w);
      for (let n = have.length; n < want; n++) {
        const c = createSettler(this, w.x + 0.5, w.z + 0.5, { cart: true, job: 'Pferdekarren', workplace: w, name: 'Pferdekarren' });
        const spot = this.findCartSpot(w);
        c.x = spot.x + 0.5;
        c.z = spot.z + 0.5;
        this.carts.push(c);
        this.emit('cart', c);
        this.emit('toast', 'Ein Pferdekarren ist einsatzbereit');
      }
    }
    for (const c of this.carts.filter((c) => c.workplace.removed)) {
      abortSettler(c);
      this.carts = this.carts.filter((o) => o !== c);
      this.emit('cartRemoved', c);
    }
  }

  findCartSpot(w) {
    let fallback = null;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = w.x + dx, z = w.z + dz;
        if ((!dx && !dz) || !this.grid.walkable(x, z)) continue;
        if (this.grid.roadAt(x, z) === 2) return { x, z };
        fallback ||= { x, z };
      }
    return fallback || { x: w.x, z: w.z };
  }

  // --- Felder ---

  addField(x, z, farm) {
    const f = { id: this.nextId++, x, z, farm, state: 'planned', growth: 0, reserved: false, removed: false };
    this.fields.push(f);
    this.grid.field[this.grid.idx(x, z)] = f.id;
    this.emit('field', f);
    return f;
  }

  sowField(f) {
    if (f.removed) return;
    f.state = 'growing';
    f.growth = 0;
  }

  removeField(f) {
    if (f.removed) return;
    f.removed = true;
    this.fields = this.fields.filter((o) => o !== f);
    this.grid.field[this.grid.idx(f.x, f.z)] = -1;
    this.emit('fieldRemoved', f);
  }

  findFieldSpot(farm) {
    const g = this.grid;
    const r = BUILDINGS[farm.type].fieldRadius[farm.level - 1];
    let best = null, bd = Infinity;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const x = farm.x + dx, z = farm.z + dz;
        const d = Math.hypot(dx, dz);
        if (d > r + 0.5 || d >= bd || !g.walkable(x, z) || !this.inTerritory(x, z)) continue;
        const i = g.idx(x, z);
        if (g.resource[i] >= 0 || g.field[i] >= 0 || g.road[i] > 0 || g.slope(x, z) > 0.6) continue;
        best = { x, z };
        bd = d;
      }
    return best;
  }

  updateFields(dt) {
    for (const f of this.fields) {
      if (f.state !== 'growing') continue;
      f.growth = Math.min(1, f.growth + (dt * this.season.grain) / GRAIN_GROW_TIME);
      if (f.growth >= 1) f.state = 'ripe';
    }
  }

  // --- Gebäude ---

  get housing() { return this.buildings.reduce((sum, b) => sum + housingOf(b, this), 0); }
  get freeCount() { return this.settlers.filter((s) => !s.job).length; }
  get hasBuilders() { return this.settlers.some((s) => s.job === 'Bauarbeiter'); }
  // Ohne Bauarbeiter bleibt ein Siedler frei, der notfalls baut
  get jobReserve() { return this.hasBuilders ? 0 : 1; }

  findSpotNear(type, pos) {
    const cost = BUILDINGS[type].cost;
    for (let r = 2; r < 8; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = pos.x + dx, z = pos.z + dz;
          if (!placeError(this, type, x, z, true)) return { x, z };
        }
    return null;
  }

  placeError(type, x, z) { return placeError(this, type, x, z); }

  // Markt umstellen: was schon für den alten Tausch angeliefert war, geht zurück ins Lager
  setTrade(b, give, get) {
    if (give === get) return;
    for (const [item, n] of Object.entries(b.inputs)) if (n > 0) this.store(b, item, n, b);
    if (b.trade && b.output > 0) this.store(b, b.trade.get, b.output, b);
    b.inputs = {};
    b.output = 0;
    b.outReserved = 0;
    b.trade = { give, get };
    for (const w of b.workers) abortSettler(w);
    this.emit('buildingChanged', b);
  }

  // Kürzester gerader Weg vom Uferfeld (x, z) übers Wasser zum nächsten Land
  bridgeSpan(x, z) {
    const g = this.grid, max = BUILDINGS.bridge.span;
    if (!g.inBounds(x, z) || g.isWater(x, z)) return null;
    let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let len = 0;
      while (len <= max && g.inBounds(x + dx * (len + 1), z + dz * (len + 1)) && g.isWater(x + dx * (len + 1), z + dz * (len + 1))) len++;
      const ex = x + dx * (len + 1), ez = z + dz * (len + 1);
      if (!len || len > max || !g.inBounds(ex, ez)) continue;
      if (!best || len < best.len) best = { dx, dz, len };
    }
    return best;
  }

  // Brückenfelder belegen; fertige Brücken machen das Wasser begehbar
  markBridge(b, on) {
    const g = this.grid;
    for (const t of bridgeTiles(b.x, b.z, b.span)) {
      const i = g.idx(t.x, t.z);
      g.bridge[i] = on ? b.id : -1;
      g.deck[i] = on && b.done && g.water[i] ? 1 : 0;
    }
    g.land = null;
    this.territoryDirty = true;
  }

  place(type, x, z) {
    const b = this.addBuilding(type, x, z, false);
    this.abortIdle();
    this.emit('sfx', { name: 'place', x: x + 0.5, z: z + 0.5 });
    return b;
  }

  addBuilding(type, x, z, done) {
    const b = createBuilding(this.nextId++, type, x, z, done);
    this.clearRoad(x, z);
    for (const p of this.roadPlans.filter((p) => p.x === x && p.z === z)) {
      if (p.builder) abortSettler(p.builder);
      p.removed = true;
      this.roadPlans = this.roadPlans.filter((o) => o !== p);
      this.emit('roadPlanRemoved', p);
      this.store(p, 'stone', ROAD.buildCost);
    }
    this.roadsDirty = true;
    this.buildings.push(b);
    if (BUILDINGS[type].span) {
      b.span = this.bridgeSpan(x, z);
      this.markBridge(b, true);
    } else this.grid.building[this.grid.idx(x, z)] = b.id;
    if (done) this.territoryDirty = true;
    this.emit('building', b);
    return b;
  }

  startUpgrade(b) {
    const cost = upgradeCost(b);
    if (!cost || !this.canAfford(cost)) return false;
    b.upgrading = true;
    b.progress = 0;
    b.siteToken++;
    b.delivered = {};
    b.incoming = {};
    this.emit('buildingChanged', b);
    this.emit('sfx', { name: 'place', x: b.x + 0.5, z: b.z + 0.5 });
    this.abortIdle();
    return true;
  }

  cancelUpgrade(b) {
    if (!b.upgrading) return;
    for (const [item, n] of Object.entries(b.delivered)) this.store(b, item, n);
    for (const w of [...b.builders]) abortSettler(w);
    b.upgrading = false;
    b.progress = 1;
    b.siteToken++;
    b.delivered = {};
    b.incoming = {};
    this.emit('buildingChanged', b);
  }

  completeSite(b) {
    const name = BUILDINGS[b.type].name;
    if (!b.done) {
      b.done = true;
      this.emit('toast', `${name} ist fertig`);
    } else {
      b.level++;
      b.upgrading = false;
      this.emit('toast', `${name} ist jetzt Stufe ${b.level}`);
    }
    b.progress = 1;
    b.siteToken++;
    b.delivered = {};
    b.incoming = {};
    if (b.span) this.markBridge(b, true);
    this.emit('buildingChanged', b);
    if (BUILDINGS[b.type].territory) this.territoryDirty = true;
    this.emit('sfx', { name: 'complete', x: b.x + 0.5, z: b.z + 0.5 });
    if (b.type === 'warehouse') this.syncCarts();
    this.abortIdle();
  }

  demolishError(b) {
    if (b.type === 'warehouse' && b.done && this.warehouses.length <= 1) return 'Das letzte Lagerhaus kann nicht abgerissen werden';
    return null;
  }

  demolish(b) {
    if (b.removed || this.demolishError(b)) return;
    for (const w of [...b.workers]) releaseJob(w);
    for (const w of [...b.builders]) abortSettler(w);
    b.removed = true;

    const refund = b.done ? Object.entries(BUILDINGS[b.type].cost).map(([k, v]) => [k, Math.floor(v / 2)]) : [];
    for (const [item, n] of [...refund, ...Object.entries(b.delivered)]) this.store(b, item, n, b);
    for (const item of ITEM_KEYS) this.store(b, item, b.stock[item], b);
    if (outputItem(b)) this.store(b, outputItem(b), b.output, b);
    for (const [item, n] of Object.entries(b.inputs)) this.store(b, item, n, b);
    for (const f of this.fields.filter((f) => f.farm === b)) this.removeField(f);

    this.buildings = this.buildings.filter((o) => o !== b);
    if (b.span) this.markBridge(b, false);
    else this.grid.building[this.grid.idx(b.x, b.z)] = -1;
    this.roadsDirty = true;
    this.emit('buildingRemoved', b);
    if (BUILDINGS[b.type].territory) this.territoryDirty = true;
    this.emit('sfx', { name: 'demolish', x: b.x + 0.5, z: b.z + 0.5 });
    if (b.type === 'warehouse') this.syncCarts();
  }

  // --- Siedler und Ressourcen ---

  spawnSettler(near) {
    const candidates = [];
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++)
        if ((dx || dz) && this.grid.walkable(near.x + dx, near.z + dz)) candidates.push([near.x + dx, near.z + dz]);
    const [x, z] = candidates[Math.floor(Math.random() * candidates.length)] || [near.x, near.z];
    const s = createSettler(this, x + 0.5, z + 0.5);
    this.settlers.push(s);
    this.emit('settler', s);
    return s;
  }

  findResource(type, hut) {
    const radius = WORK_RADIUS[hut.level - 1];
    let best = null, bestDist = Infinity;
    for (const n of this.resources) {
      if (n.type !== type || n.gone || n.amount <= 0 || n.reserved || n.blockedUntil > this.time) continue;
      const d = Math.hypot(n.x - hut.x, n.z - hut.z);
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  harvest(node) { harvest(this, node); }

  abortIdle() {
    for (const s of this.settlers) if (s.idle) abortSettler(s);
  }

  hasOpenWork() {
    if (this.freeCount > this.jobReserve && hasOpenWorkplace(this)) return true;
    if (this.roadPlans.some((p) => !p.builder)) return true;
    return this.buildings.some((b) => isSite(b) && (siteNeeds(b).length || canBuildOn(b)));
  }

  update(dt) {
    this.time += dt;
    const before = this.season.index;
    this.season = seasonAt(this.time, this.seasonsOn);
    if (this.season.index !== before) this.emit('season', this.season);
    const warnKey = `${this.season.year}`;
    if (this.seasonsOn && this.season.key === 'autumn' && this.season.progress > 0.6 && this.winterWarned !== warnKey) {
      this.winterWarned = warnKey;
      this.emit('toast', 'Bald kommt der Winter. Sorge für Vorräte: Brot, Fisch und Milch helfen.');
    }
    updateResources(this, dt);
    this.updateFields(dt);
    for (const s of this.settlers) updateSettler(this, s, dt);
    for (const c of this.carts) updateSettler(this, c, dt);
    this.updateRoads(dt);
    updateEconomy(this, dt);
    if (this.hungry) this.hungerTime += dt;
    updateGoals(this, dt);
    this.jobTimer = (this.jobTimer || 0) + dt;
    if (this.jobTimer > 10) {
      this.jobTimer = 0;
      rebalanceJobs(this);
    }
    if (this.territoryDirty) this.updateTerritory();
    this.checkTimer += dt;
    if (this.checkTimer >= 1) {
      this.checkTimer = 0;
      if (this.hasOpenWork()) this.abortIdle();
    }
  }

  // --- Speichern ---

  serialize() {
    return {
      v: 2,
      mapType: this.mapType,
      seed: this.seed,
      size: this.size,
      time: this.time,
      hunger: this.hunger,
      hungry: this.hungry,
      growthTimer: this.growthTimer,
      goal: this.goal,
      hungerTime: Math.round(this.hungerTime),
      cityAt: this.cityAt,
      nextId: this.nextId,
      resources: this.resources.map((n) => [n.amount, Math.round(n.timer * 10) / 10, n.gone ? 1 : 0]),
      buildings: this.buildings.map((b) => ({
        id: b.id, type: b.type, x: b.x, z: b.z, done: b.done, level: b.level, upgrading: b.upgrading,
        progress: b.progress, delivered: b.delivered, stock: b.stock, output: b.output, inputs: b.inputs,
        ...(b.span && { span: b.span }),
        ...(b.trade && { trade: b.trade }),
      })),
      roadPlans: this.roadPlans.map((p) => [p.x, p.z]),
      roads: [...this.grid.traffic].flatMap((t, i) => (t > 0 ? [[i, Math.round(t * 10) / 10, this.grid.road[i]]] : [])),
      fields: this.fields.filter((f) => f.state !== 'planned').map((f) => [f.x, f.z, f.farm.id, f.state, Math.round(f.growth * 1000) / 1000]),
      settlers: this.settlers.map((s) => ({
        name: s.name, x: s.x, z: s.z, job: s.job, workplace: s.workplace ? s.workplace.id : null,
      })),
    };
  }

  static deserialize(d) {
    const g = new Game(d.mapType, d.seed, d.size || 64);
    g.time = d.time;
    g.season = seasonAt(g.time);
    g.hunger = d.hunger;
    g.hungry = d.hungry;
    g.growthTimer = d.growthTimer;
    g.goal = d.goal || 0;
    g.hungerTime = d.hungerTime || 0;
    g.cityAt = d.cityAt ?? null;
    g.nextId = d.nextId;

    d.resources.forEach(([amount, timer, gone], i) => {
      const n = g.resources[i];
      if (!n) return;
      n.amount = amount;
      n.timer = timer;
      if (gone) {
        n.gone = true;
        g.grid.resource[g.grid.idx(n.x, n.z)] = -1;
      }
    });

    for (const bd of d.buildings) {
      if (!BUILDINGS[bd.type]) continue;   // Gebäudeart gibt es nicht mehr
      const b = createBuilding(bd.id, bd.type, bd.x, bd.z, bd.done);
      Object.assign(b, {
        progress: bd.progress,
        delivered: bd.delivered || {},
        level: bd.level || 1,
        upgrading: !!bd.upgrading,
        output: bd.output || 0,
        // ältere Spielstände: eine Zahl für die (damals einzige) Zutat
        inputs: bd.inputs || (bd.input ? { [Object.keys(BUILDINGS[bd.type].consumes)[0]]: bd.input } : {}),
        trade: bd.trade || null,
      });
      if (bd.stock) Object.assign(b.stock, bd.stock);
      // Spielstände von vor den Werkzeugen bekommen den Startvorrat
      if (bd.stock && bd.stock.tools === undefined && b.type === 'warehouse' && !d.buildings.some((o) => o.stock?.tools !== undefined)) {
        b.stock.tools = d.toolsGiven ? 0 : START.stock.tools;
        d.toolsGiven = true;
      }
      g.buildings.push(b);
      if (bd.span) {
        b.span = bd.span;
        g.markBridge(b, true);
      } else g.grid.building[g.grid.idx(b.x, b.z)] = b.id;
    }
    // Spielstände der ersten Version hatten einen gemeinsamen Vorrat
    if (d.stock && g.warehouses[0]) Object.assign(g.warehouses[0].stock, d.stock);

    for (const [i, t, level] of d.roads || []) {
      g.grid.traffic[i] = t;
      g.grid.road[i] = level;
      if (level) g.hadPath = true;
    }

    g.roadPlans = (d.roadPlans || []).map(([x, z]) => ({ x, z, builder: null }));

    for (const [x, z, farmId, state, growth] of d.fields || []) {
      const farm = g.buildings.find((b) => b.id === farmId);
      if (!farm) continue;
      const f = g.addField(x, z, farm);
      f.state = state;
      f.growth = growth;
    }

    for (const sd of d.settlers) {
      const s = createSettler(g, sd.x, sd.z, { name: sd.name });
      const b = g.buildings.find((b) => b.id === sd.workplace);
      if (b && sd.job) {
        s.job = sd.job;
        s.workplace = b;
        b.workers.push(s);
      }
      g.settlers.push(s);
    }
    g.syncCarts();
    // Neu hinzugekommene Felsen dürfen nicht unter alten Gebäuden oder Feldern liegen
    for (const n of g.resources) {
      const i = g.grid.idx(n.x, n.z);
      if (!n.gone && (g.grid.building[i] >= 0 || g.grid.field[i] >= 0)) {
        n.gone = true;
        g.grid.resource[i] = -1;
      }
    }
    // Gebiet erst jetzt aus den geladenen Gebäuden berechnen
    g.updateTerritory();
    return g;
  }
}
