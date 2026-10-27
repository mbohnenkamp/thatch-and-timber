import { BUILDINGS, HAPPINESS } from './config.js';

// Zufriedenheit 0..100: Grundstimmung plus Essen, Versorgung der Wohnhäuser durch Brunnen,
// Wirtshaus, Kapelle und Marktplatz; Hunger und Enge ziehen ab.
const FOOD_SOURCES = ['gatherer', 'fisher', 'sheepfarm', 'bakery'];

const active = (g, b) => b.done && !b.removed && (b.type !== 'tavern' || (b.workers.length && b.servedUntil > g.time));

// Anteil der Wohnhäuser im Umkreis eines aktiven Gebäudes dieser Art
function coverage(g, type, houses) {
  if (!houses.length) return 0;
  const r = BUILDINGS[type].radius;
  const spots = g.buildings.filter((b) => b.type === type && active(g, b));
  if (!spots.length) return 0;
  return houses.filter((h) => spots.some((b) => Math.hypot(b.x - h.x, b.z - h.z) <= r)).length / houses.length;
}

export function happinessParts(g) {
  const houses = g.buildings.filter((b) => b.type === 'house' && b.done && !b.removed);
  const foods = FOOD_SOURCES.filter((t) => g.buildings.some((b) => b.type === t && b.done && !b.removed && b.workers.length)).length;
  const parts = [['Grundstimmung', HAPPINESS.base], ['Abwechslung beim Essen', foods * HAPPINESS.perFood]];
  for (const [type, max] of Object.entries(HAPPINESS.cover)) {
    const share = coverage(g, type, houses);
    parts.push([`${BUILDINGS[type].name} (${Math.round(share * 100)} % der Häuser)`, Math.round(share * max)]);
  }
  if (g.hungry) parts.push(['Hunger', -HAPPINESS.hunger]);
  if (g.settlers.length >= g.housing) parts.push(['Alle Wohnungen voll', -HAPPINESS.crowded]);
  return parts;
}

export const happinessTarget = (g) => Math.max(0, Math.min(100, happinessParts(g).reduce((s, [, v]) => s + v, 0)));

// Bei 100 % arbeiten alle HAPPINESS.effect schneller, bei 0 % so viel langsamer
export const happinessFactor = (g) => 1 + ((g.happiness ?? 50) - 50) / 50 * HAPPINESS.effect;

export function updateHappiness(g, dt) {
  g.moodTimer = (g.moodTimer || 0) + dt;
  if (g.moodTimer < 2) return;
  const step = g.moodTimer;
  g.moodTimer = 0;
  const target = happinessTarget(g);
  const h = g.happiness ?? 50;
  // Langsam angleichen: höchstens 1 Punkt je Sekunde
  g.happiness = h + Math.max(-step, Math.min(step, target - h));
}
