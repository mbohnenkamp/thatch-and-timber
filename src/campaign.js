import { START } from './config.js';

const count = (g, type, ok = (b) => b.done) => g.buildings.filter((b) => b.type === type && !b.removed && ok(b)).length;

// Kampagne (V7): aus einer Residenzstadt Siedler aussenden. Jede Karte ist ein Kapitel mit eigenen Zielen.
// Die Dorfstufen schalten hier nichts frei (alles bis zur Großstadt ist sofort baubar), sie wachsen nur mit.
export const CHAPTERS = [
  {
    map: 'pass', name: 'Bergpass', prefix: 'Neu-',
    intro: 'Ein enges Tal zwischen hohen Bergen. Erz und Kohle gibt es reichlich, der Boden ist karg: Getreide wächst langsamer. Was euch fehlt, holt ihr über den Markt.',
    goals: [
      { text: 'Wachse auf 15 Siedler', progress: (g) => [g.settlers.length, 15], reward: { wood: 10, food: 10 }, rank: 0 },
      { text: 'Baue eine Erzmine und eine Kohlemine', progress: (g) => [Math.min(1, count(g, 'oremine')) + Math.min(1, count(g, 'coalmine')), 2], reward: { planks: 10 }, rank: 1 },
      { text: 'Schmelze Eisen: lege 10 Eisen auf Vorrat', progress: (g) => [g.total('iron'), 10], reward: { stone: 10, food: 10 }, rank: 1 },
      { text: 'Handle am Markt: tausche 40 Waren ein', progress: (g) => [Math.floor(g.traded || 0), 40], reward: { planks: 10, stone: 10 }, rank: 2 },
      { text: 'Wachse auf 40 Siedler', progress: (g) => [g.settlers.length, 40], reward: { wood: 20, stone: 20 }, rank: 2 },
      { text: 'Baue 3 Schmelzhütten', progress: (g) => [count(g, 'smelter'), 3], reward: { wood: 25, stone: 25, planks: 10 }, rank: 3 },
      { text: 'Kapitelziel: Wachse auf 80 Siedler', progress: (g) => [g.settlers.length, 80], reward: { wood: 50, stone: 50 }, rank: 4 },
    ],
  },
  {
    map: 'swamp', name: 'Sumpf', prefix: 'Klein-',
    intro: 'Eine nasse Niederung voller Tümpel. Auf Sumpf kann man weder bauen noch Felder anlegen, und die Siedler kommen dort nur langsam voran. Ein Grabenbauer legt das Land trocken, danach ist der Boden besonders fruchtbar. Stein ist knapp.',
    goals: [
      { text: 'Baue einen Grabenbauer', progress: (g) => [count(g, 'ditcher'), 1], reward: { wood: 10, planks: 5 }, rank: 0 },
      { text: 'Lege 40 Felder Sumpf trocken', progress: (g) => [g.drained, 40], reward: { stone: 10, food: 10 }, rank: 1 },
      { text: 'Wachse auf 30 Siedler', progress: (g) => [g.settlers.length, 30], reward: { wood: 15, stone: 10 }, rank: 1 },
      { text: 'Lege 250 Felder Sumpf trocken', progress: (g) => [g.drained, 250], reward: { stone: 15, planks: 10 }, rank: 2 },
      { text: 'Wachse auf 80 Siedler', progress: (g) => [g.settlers.length, 80], reward: { wood: 25, stone: 25 }, rank: 3 },
      { text: 'Kapitelziel: Wachse auf 120 Siedler', progress: (g) => [g.settlers.length, 120], reward: { wood: 50, stone: 50 }, rank: 4 },
    ],
  },
];

// Erbe der Mutterstadt: ein Zehntel des Lagers (gedeckelt) und mehr Siedler, je größer die Stadt
const HERITAGE_CAP = { wood: 60, stone: 40, food: 40, planks: 30, tools: 20, iron: 10, bread: 20, cloth: 10 };
export const HERITAGE_SETTLERS = { base: START.settlers, per: 25, max: 12 };

export function heritageOf(g) {
  const stock = {};
  for (const [k, cap] of Object.entries(HERITAGE_CAP)) {
    const n = Math.min(cap, Math.floor(g.total(k) * 0.1));
    if (n > 0) stock[k] = n;
  }
  const { base, per, max } = HERITAGE_SETTLERS;
  return { settlers: Math.min(max, base + Math.floor(g.settlers.length / per)), stock };
}

// Nächstes Kapitel nach dieser Stadt (Residenzstadt: das erste), null wenn es keins gibt
export function nextChapter(g) {
  if (g.campaign) return g.campaign.doneAt != null && CHAPTERS[g.campaign.chapter + 1] ? g.campaign.chapter + 1 : null;
  return g.castleAt != null ? 0 : null;
}

export const canSendOut = (g) => nextChapter(g) != null;
// Ehrentafel abgeschlossen, aber das nächste Kapitel gibt es noch nicht
export const chapterPending = (g) => g.campaign?.doneAt != null && !CHAPTERS[g.campaign.chapter + 1];

// Wappen: Schildfarbe, Zeichen und Zeichenfarbe aus dem Seed der Mutterstadt
const FIELDS = ['#b3472f', '#2f5d8a', '#3f7a2e', '#6a3f9a', '#c9a227', '#2b2b2b'];
const CHARGES = ['tower', 'tree', 'wheat', 'fish', 'star', 'key'];
export function crestOf(seed) {
  const n = Math.abs(Math.floor(seed));
  const field = FIELDS[n % FIELDS.length];
  const light = field === '#c9a227';
  return { field, charge: CHARGES[Math.floor(n / FIELDS.length) % CHARGES.length], color: light ? '#2b2b2b' : '#f2ead8' };
}

const CHARGE_SVG = {
  tower: (c) => `<rect x="12" y="11" width="8" height="12" fill="${c}"/><path d="M11 11V8h2v2h2V8h2v2h2V8h2v3z" fill="${c}"/>`,
  tree: (c) => `<circle cx="16" cy="13" r="6" fill="${c}"/><rect x="15" y="17" width="2" height="7" fill="${c}"/>`,
  wheat: (c) => `<path d="M16 8v16M16 12l-3-3M16 12l3-3M16 16l-3-3M16 16l3-3M16 20l-3-3M16 20l3-3" stroke="${c}" stroke-width="1.8" fill="none"/>`,
  fish: (c) => `<path d="M9 16q6-6 12 0q-6 6-12 0zM21 16l4-3v6z" fill="${c}"/>`,
  star: (c) => `<path d="M16 7l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="${c}"/>`,
  key: (c) => `<circle cx="16" cy="11" r="3.5" fill="none" stroke="${c}" stroke-width="2"/><path d="M16 14.5V24M16 20h3M16 23h3" stroke="${c}" stroke-width="2"/>`,
};
export const crestSvg = (cr) => `<svg class="crest" viewBox="0 0 32 32"><path d="M5 4h22v11c0 7-5 11-11 13C10 26 5 22 5 15z" fill="${cr.field}" stroke="#4a3a28" stroke-width="1.2"/>${CHARGE_SVG[cr.charge](cr.color)}</svg>`;
