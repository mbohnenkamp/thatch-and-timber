import { BUILDINGS, MAX_LEVEL, OUTPUT_CAP, ITEMS, TRADE_VALUE, TRADE_FEE, WORK_SPEED } from '../config.js';
import { RANKS, isUnlocked } from '../goals.js';

export function createBuilding(id, type, x, z, done) {
  return {
    id, type, x, z, done,
    level: 1,
    upgrading: false,
    progress: done ? 1 : 0,
    siteToken: 0,
    delivered: {}, incoming: {},
    builders: [], workers: [], removed: false,
    output: 0, outReserved: 0,
    inputs: {}, inIncoming: {},
    stock: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
  };
}

// Baustelle = Neubau oder laufender Ausbau
export const isSite = (b) => !b.removed && (!b.done || b.upgrading);

export function siteCost(b) {
  const def = BUILDINGS[b.type];
  return b.done ? def.upgrades[b.level - 1] : def.cost;
}

export function siteBuildTime(b) {
  const base = BUILDINGS[b.type].buildTime;
  return b.done ? base * (b.level + 1) * 0.75 : base;
}

export function upgradeCost(b) {
  if (!b.done || b.upgrading || b.level >= MAX_LEVEL || !BUILDINGS[b.type].upgrades) return null;
  return BUILDINGS[b.type].upgrades[b.level - 1];
}

// Materialien, die noch zur Baustelle unterwegs sein müssten: [[item, menge], ...]
export function siteNeeds(b) {
  if (!isSite(b)) return [];
  return Object.entries(siteCost(b))
    .map(([item, amount]) => [item, amount - (b.delivered[item] || 0) - (b.incoming[item] || 0)])
    .filter(([, rest]) => rest > 0);
}

// Anteil der Baustelle, der mit dem gelieferten Material gebaut werden kann (0..1)
export function siteCap(b) {
  const cost = Object.entries(siteCost(b));
  const total = cost.reduce((sum, [, v]) => sum + v, 0);
  if (!total) return 1;
  return cost.reduce((sum, [k, v]) => sum + Math.min(v, b.delivered[k] || 0), 0) / total;
}

export function slots(b) {
  const def = BUILDINGS[b.type];
  if (!b.done || !def.job) return 0;
  const perLevel = def.carriers || def.builders;
  return perLevel ? perLevel[b.level - 1] : 1;
}

// Fertiger Brunnen in Reichweite eines Wohnhauses
export function nearWell(game, b) {
  const { radius } = BUILDINGS.well;
  return game.buildings.some((w) => w.type === 'well' && w.done && !w.removed && Math.hypot(w.x - b.x, w.z - b.z) <= radius);
}

export function housingOf(b, game = null) {
  if (!b.done) return 0;
  const base = BUILDINGS[b.type].housing?.[b.level - 1] || 0;
  return base + (game && b.type === 'house' && nearWell(game, b) ? BUILDINGS.well.houseBonus : 0);
}
// Felder einer Brücke vom Ufer (x, z) bis zum Ufer gegenüber
export function bridgeTiles(x, z, span) {
  return Array.from({ length: span.len + 2 }, (_, i) => ({ x: x + span.dx * i, z: z + span.dz * i }));
}

// Markt: give Stück abgeben, get Stück bekommen
export function tradeRate(give, get) {
  const a = TRADE_VALUE[give], b = TRADE_VALUE[get] * TRADE_FEE;
  return a >= b ? { give: 1, get: Math.floor(a / b) } : { give: Math.ceil(b / a), get: 1 };
}

// Arbeitstempo je Ausbaustufe, mit fertigem Rathaus schneller
export function workSpeed(game, b) {
  const bonus = game.buildings.some((t) => t.type === 'townhall' && t.done && !t.removed) ? 1 + BUILDINGS.townhall.speedBonus : 1;
  return WORK_SPEED[b.level - 1] * bonus;
}

export const outputItem = (b) => (BUILDINGS[b.type].trade ? b.trade?.get : BUILDINGS[b.type].produces);
export const outputAmount = (b) => (BUILDINGS[b.type].trade && b.trade ? tradeRate(b.trade.give, b.trade.get).get : 1);
// Was ein Arbeitsgang verbraucht: { ware: menge }
export function recipe(b) {
  if (BUILDINGS[b.type].trade) return b.trade ? { [b.trade.give]: tradeRate(b.trade.give, b.trade.get).give } : {};
  return BUILDINGS[b.type].consumes || {};
}
export const hasInputs = (b) => Object.entries(recipe(b)).every(([k, n]) => (b.inputs[k] || 0) >= n);
export function useInputs(b) {
  for (const [k, n] of Object.entries(recipe(b))) b.inputs[k] -= n;
}
export const outputCap = (b) => OUTPUT_CAP[b.level - 1];

export function placeError(game, type, x, z, free = false) {
  const g = game.grid;
  const def = BUILDINGS[type];
  if (!isUnlocked(game, type)) return `${def.name} gibt es ab der Stufe ${RANKS[def.unlock]}`;
  if (def.unique && game.buildings.some((b) => b.type === type && !b.removed)) return `Es gibt schon ein ${def.name}`;
  if (!g.inBounds(x, z)) return 'Außerhalb der Karte';
  if (!free && !game.canAfford(def.cost)) return 'Nicht genug Material im Lager';
  if (x < 1 || z < 1 || x >= g.size - 1 || z >= g.size - 1) return 'Zu nah am Kartenrand';
  if (g.isWater(x, z)) return def.span ? 'Brücken beginnen am Ufer: tippe auf das Land direkt am Wasser' : 'Hier ist Wasser';
  if (!game.inTerritory(x, z)) return 'Außerhalb deines Gebiets — baue einen Wachturm am Rand';
  if (game.warehouses.length && !game.warehouses.some((w) => g.landId(w.x, w.z) === g.landId(x, z))) return 'Dorthin kommen deine Siedler nicht (Wasser dazwischen) — baue eine Brücke';
  if (def.span) {
    const span = game.bridgeSpan(x, z);
    if (!span) return `Kein Ufer gegenüber in Reichweite (höchstens ${def.span} Felder Wasser)`;
    if (bridgeTiles(x, z, span).some((t) => g.building[g.idx(t.x, t.z)] >= 0 || g.bridge[g.idx(t.x, t.z)] >= 0)) return 'Hier steht schon etwas';
    return null;
  }
  if (g.bridge[g.idx(x, z)] >= 0) return 'Hier beginnt eine Brücke';
  if (g.resource[g.idx(x, z)] >= 0 || g.field[g.idx(x, z)] >= 0) return 'Hier steht schon etwas';
  if (g.slope(x, z) > 0.6) return 'Zu steil zum Bauen';
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      if (g.building[g.idx(x + dx, z + dz)] >= 0) return 'Zu nah an einem anderen Gebäude';
  if (def.needsWater && !g.waterNear(x, z, 3)) return 'Die Fischerhütte braucht Wasser in der Nähe';
  return null;
}
