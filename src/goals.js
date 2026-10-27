import { BUILDINGS } from './config.js';

// Aufgaben nacheinander; jede erledigte hebt die Dorfstufe und bringt eine kleine Belohnung.
// progress(g) liefert [erreicht, Ziel]; rank = Dorfstufe nach Erledigung.
const count = (g, type, ok = (b) => b.done) => g.buildings.filter((b) => b.type === type && !b.removed && ok(b)).length;

export const RANKS = ['Weiler', 'Dorf', 'Marktflecken', 'Kleinstadt', 'Stadt', 'Großstadt'];
export const CITY = 4;

export const GOALS = [
  { text: 'Wachse auf 10 Siedler', progress: (g) => [g.settlers.length, 10], reward: { wood: 10 }, rank: 0 },
  { text: 'Lege 30 Nahrung auf Vorrat', progress: (g) => [g.foodPoints(), 30], reward: { stone: 6 }, rank: 1 },
  { text: 'Backe Brot: baue eine Bäckerei', progress: (g) => [count(g, 'bakery'), 1], reward: { wood: 10, stone: 6 }, rank: 1 },
  { text: 'Baue einen Brunnen und 3 Wohnhäuser', progress: (g) => [Math.min(1, count(g, 'well')) + Math.min(3, count(g, 'house')), 4], reward: { stone: 10 }, rank: 2 },
  { text: 'Wachse auf 30 Siedler', progress: (g) => [g.settlers.length, 30], reward: { wood: 15, stone: 10 }, rank: 2 },
  { text: 'Baue ein Lagerhaus auf Stufe 3 aus', progress: (g) => [count(g, 'warehouse', (b) => b.done && b.level >= 3), 1], reward: { wood: 15, stone: 15 }, rank: 3 },
  { text: 'Erlebe den dritten Frühling mit 40 Siedlern', progress: (g) => [g.season.year >= 3 && g.settlers.length >= 40 ? 1 : 0, 1], reward: { wood: 20, stone: 20 }, rank: 3 },
  { text: 'Wachse auf 60 Siedler', progress: (g) => [g.settlers.length, 60], reward: { wood: 25, stone: 25 }, rank: 4 },
  // Nach der Stadt: weiter zur Großstadt, Krönung ist das Denkmal
  { text: 'Baue das Rathaus', progress: (g) => [count(g, 'townhall'), 1], reward: { planks: 10, iron: 4 }, rank: 4 },
  { text: 'Wachse auf 100 Siedler', progress: (g) => [g.settlers.length, 100], reward: { stone: 30, planks: 15, iron: 6 }, rank: 4 },
  { text: 'Errichte das Denkmal', progress: (g) => [count(g, 'monument'), 1], reward: { wood: 50, stone: 50 }, rank: 5 },
];

export const currentGoal = (g) => GOALS[g.goal] || null;
export const rankIndex = (g) => (g.goal > 0 ? GOALS[g.goal - 1].rank : 0);
export const rankOf = (g) => RANKS[rankIndex(g)];
// Gebäude werden mit der Dorfstufe freigeschaltet
export const isUnlocked = (g, type) => (BUILDINGS[type].unlock || 0) <= rankIndex(g);
export const unlockedAt = (rank) => Object.keys(BUILDINGS).filter((t) => BUILDINGS[t].unlock === rank);

export function updateGoals(g, dt) {
  g.goalTimer = (g.goalTimer || 0) + dt;
  if (g.goalTimer < 1) return;
  g.goalTimer = 0;
  const goal = currentGoal(g);
  if (!goal) return;
  const [have, need] = goal.progress(g);
  if (have < need) return;
  const before = rankOf(g);
  g.goal++;
  const w = g.warehouses[0];
  if (w) for (const [item, n] of Object.entries(goal.reward)) g.store(w, item, n);
  const rankUp = rankOf(g) !== before;
  let honor = null;
  if (rankIndex(g) === CITY && g.cityAt == null) { g.cityAt = g.time; honor = 'city'; }
  if (!currentGoal(g)) { g.metroAt = g.time; honor = 'metro'; }
  g.emit('goal', { goal, reward: goal.reward, rank: rankOf(g), rankUp, unlocked: rankUp ? unlockedAt(rankIndex(g)) : [], honor });
}
