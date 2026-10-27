export const VERSION = '5.5';
export const ISSUES_URL = 'https://github.com/mbohnenkamp/thatch-and-timber/issues/new';

// Kartengrößen in Feldern; alte Spielstände ohne Angabe sind 64
export const MAP_SIZES = { small: { name: 'Klein', size: 64 }, medium: { name: 'Mittel', size: 96 }, large: { name: 'Groß', size: 128 } };
export const DEFAULT_MAP_SIZE = 'large';

export const START = { stock: { wood: 30, stone: 12, food: 20, tools: 16 }, settlers: 6 };

export const SETTLER_SPEED = 2.2;
export const CARRY_AMOUNT = 2;
export const FOOD_INTERVAL = 75;
export const GROWTH_INTERVAL = 25;
export const GROWTH_FOOD_MIN = 8;
export const GROWTH_FOOD_COST = 4;
// Zuzug nur, wenn je Einwohner so viel Nahrung auf Vorrat liegt (und nie im Winter)
export const GROWTH_RESERVE = 1;
export const AUTOSAVE_INTERVAL = 60;

// Werte je Ausbaustufe (Index 0 = Stufe 1)
export const MAX_LEVEL = 3;
export const WORK_RADIUS = [14, 17, 20];
export const WORK_SPEED = [1, 1.35, 1.7];
export const OUTPUT_CAP = [4, 6, 8];
export const MAX_BUILDERS_PER_SITE = 3;

// Landwirtschaft und Verarbeitung
export const GRAIN_GROW_TIME = 70;
export const FIELD_YIELD = 2;
export const BREAD_FOOD = 3;

// Jahreszeiten: Dauer je Jahreszeit (2 Spieltage) und Auswirkungen
export const SEASON_LENGTH = 1200;
export const SEASONS = [
  { key: 'spring', name: 'Frühling', grain: 1, berries: 1, fish: 1, trees: 1, hunger: 1, sow: true },
  { key: 'summer', name: 'Sommer', grain: 1.25, berries: 1, fish: 1, trees: 1, hunger: 1, sow: true },
  { key: 'autumn', name: 'Herbst', grain: 0.8, berries: 1.5, fish: 1, trees: 1, hunger: 1, sow: true },
  { key: 'winter', name: 'Winter', grain: 0, berries: 0, fish: 0.6, trees: 0, hunger: 1.15, sow: false },
];

// Wege entstehen, wo viel gelaufen wird. Stufe 0 = Wiese, 1 = Trampelpfad, 2 = Straße
export const ROAD = {
  pathAt: 15, roadAt: 60,
  decayEvery: 10, decay: 0.5,
  speed: [1, 1.25, 1.5],
  cost: [1, 0.8, 0.6],
  buildCost: 1,      // Stein je selbst gebautem Straßenfeld
  buildTime: 1.5,    // Sekunden Pflasterarbeit je Feld
};
export const CART = { capacity: 6, speed: 4.2, perLevel: [0, 1, 2] };

export const ITEMS = { wood: 'Holz', stone: 'Stein', food: 'Nahrung', grain: 'Getreide', flour: 'Mehl', bread: 'Brot', planks: 'Bretter', tools: 'Werkzeug', ore: 'Erz', coal: 'Kohle', iron: 'Eisen' };
// Berufe ohne Werkzeug
export const NO_TOOL_JOBS = ['Träger', 'Bauarbeiter', 'Werkzeugmacher', 'Bergmann', 'Schmelzer', 'Händler'];

// Tauschwert am Markt; der Händler nimmt die Hälfte als Aufschlag
export const TRADE_VALUE = { wood: 1, stone: 2, food: 1, grain: 1, flour: 2, bread: 3, planks: 2, tools: 8, ore: 2, coal: 2, iron: 4 };
export const TRADE_FEE = 1.5;

export const RESOURCES = {
  tree: { name: 'Baum', item: 'wood', amount: 3, workTime: 4, regrow: 150 },
  rock: { name: 'Felsen', item: 'stone', amount: 8, workTime: 5, regrow: 0 },
  berry: { name: 'Beerenbusch', item: 'food', amount: 3, workTime: 3, regrow: 60 },
  fish: { name: 'Fischgrund', item: 'food', amount: 4, workTime: 5, regrow: 30, gradual: true },
  ore: { name: 'Erzader', item: 'ore', amount: 12, workTime: 6, regrow: 0 },
  coal: { name: 'Kohleflöz', item: 'coal', amount: 12, workTime: 6, regrow: 0 },
};

export const BUILDINGS = {
  warehouse: {
    name: 'Lagerhaus', group: 'base', unlock: 3, cost: { wood: 10, stone: 6 }, buildTime: 16, job: 'Träger', territory: [10, 10, 10],
    housing: [8, 10, 12], carriers: [2, 3, 4],
    upgrades: [{ planks: 4, stone: 6 }, { planks: 8, stone: 10 }],
  },
  builderhut: {
    name: 'Bauhütte', group: 'base', unlock: 0, cost: { wood: 6, stone: 2 }, buildTime: 10, job: 'Bauarbeiter',
    builders: [2, 3, 4],
    upgrades: [{ planks: 3, stone: 4 }, { planks: 6, stone: 8 }],
  },
  woodcutter: {
    name: 'Holzfäller', group: 'base', unlock: 0, cost: { wood: 4 }, buildTime: 8, job: 'Holzfäller', resource: 'tree', produces: 'wood',
    upgrades: [{ planks: 3, stone: 3 }, { planks: 6, stone: 6 }],
  },
  quarry: {
    name: 'Steinbruch', group: 'base', unlock: 0, cost: { wood: 5 }, buildTime: 10, job: 'Steinmetz', resource: 'rock', produces: 'stone',
    upgrades: [{ planks: 4, stone: 2 }, { planks: 7, stone: 5 }],
  },
  gatherer: {
    name: 'Sammlerhütte', group: 'food', unlock: 0, cost: { wood: 4 }, buildTime: 8, job: 'Sammler', resource: 'berry', produces: 'food',
    upgrades: [{ planks: 3, stone: 3 }, { planks: 6, stone: 6 }],
  },
  fisher: {
    name: 'Fischerhütte', group: 'food', unlock: 0, cost: { wood: 5 }, buildTime: 8, job: 'Fischer', resource: 'fish', produces: 'food', needsWater: true,
    upgrades: [{ planks: 3, stone: 3 }, { planks: 6, stone: 6 }],
  },
  sawmill: {
    name: 'Sägewerk', group: 'craft', unlock: 0, cost: { wood: 6, stone: 3 }, buildTime: 14, job: 'Säger',
    consumes: { wood: 1 }, produces: 'planks', workTime: 4, stockLimit: 30,
    upgrades: [{ wood: 6, stone: 4 }, { planks: 6, stone: 6 }],
  },
  toolmaker: {
    name: 'Werkzeugmacher', group: 'craft', unlock: 2, cost: { wood: 4, stone: 4, planks: 4 }, buildTime: 14, job: 'Werkzeugmacher',
    consumes: { planks: 1, iron: 1 }, produces: 'tools', workTime: 8, stockLimit: 12,
    upgrades: [{ planks: 4, stone: 4 }, { planks: 6, stone: 6 }],
  },
  // Bergleute fördern nur, wenn Nahrung angeliefert wird (1 Nahrung je Fuhre)
  oremine: {
    name: 'Erzmine', group: 'craft', unlock: 2, cost: { wood: 6, stone: 4 }, buildTime: 14, job: 'Bergmann', resource: 'ore', produces: 'ore', consumes: { food: 1 },
    upgrades: [{ planks: 3, stone: 4 }, { planks: 6, stone: 6 }],
  },
  coalmine: {
    name: 'Kohlemine', group: 'craft', unlock: 2, cost: { wood: 6, stone: 4 }, buildTime: 14, job: 'Bergmann', resource: 'coal', produces: 'coal', consumes: { food: 1 },
    upgrades: [{ planks: 3, stone: 4 }, { planks: 6, stone: 6 }],
  },
  smelter: {
    name: 'Schmelzhütte', group: 'craft', unlock: 2, cost: { wood: 4, stone: 6 }, buildTime: 14, job: 'Schmelzer',
    consumes: { ore: 1, coal: 1 }, produces: 'iron', workTime: 8, stockLimit: 12,
    upgrades: [{ planks: 3, stone: 5 }, { planks: 6, stone: 8 }],
  },
  // Tauscht laufend eine Ware gegen eine andere; lässt keep Stück der abgegebenen Ware im Lager
  market: {
    name: 'Markt', group: 'craft', unlock: 2, cost: { wood: 6, stone: 4, planks: 4 }, buildTime: 16, job: 'Händler',
    trade: true, workTime: 6, stockLimit: 40, keep: 10,
    upgrades: [{ planks: 4, stone: 4 }, { planks: 6, stone: 6 }],
  },
  // Eigene Herde am Hof; der Schäfer melkt, Milch zählt direkt als Nahrung
  sheepfarm: {
    name: 'Schäferei', group: 'food', unlock: 0, cost: { wood: 6, stone: 2 }, buildTime: 12, job: 'Schäfer', produces: 'food',
    sheep: [4, 6, 8], milkTime: 7, herdRadius: 3,
    upgrades: [{ planks: 3, stone: 4 }, { planks: 6, stone: 6 }],
  },
  farm: {
    name: 'Bauernhof', group: 'food', unlock: 1, cost: { wood: 6, stone: 2 }, buildTime: 12, job: 'Bauer', produces: 'grain',
    fields: [4, 6, 8], fieldRadius: [3, 3, 4],
    upgrades: [{ planks: 3, stone: 4 }, { planks: 6, stone: 6 }],
  },
  mill: {
    name: 'Mühle', group: 'food', unlock: 1, cost: { wood: 6, stone: 6 }, buildTime: 16, job: 'Müller',
    consumes: { grain: 1 }, produces: 'flour', workTime: 6,
    upgrades: [{ planks: 3, stone: 6 }, { planks: 6, stone: 8 }],
  },
  bakery: {
    name: 'Bäckerei', group: 'food', unlock: 1, cost: { wood: 5, stone: 5 }, buildTime: 14, job: 'Bäcker',
    consumes: { flour: 1 }, produces: 'bread', workTime: 6,
    upgrades: [{ planks: 3, stone: 5 }, { planks: 6, stone: 8 }],
  },
  house: {
    name: 'Wohnhaus', group: 'base', unlock: 0, cost: { wood: 6, stone: 4 }, buildTime: 14, housing: [4, 7, 10],
    upgrades: [{ planks: 3, stone: 5 }, { planks: 6, stone: 8 }],
  },
  // Vergrößert das eigene Gebiet; kein Arbeiter. Stufe 1 nur aus Holz, damit man bei Steinmangel zu neuen Felsen kommt
  tower: {
    name: 'Wachturm', group: 'base', unlock: 0, cost: { wood: 10 }, buildTime: 14, territory: [8, 10, 12],
    upgrades: [{ planks: 2, stone: 8 }, { planks: 5, stone: 10 }],
  },
  // Kein Arbeiter, kein Ausbau: Wohnhäuser im Umkreis bekommen mehr Platz (mehrere Brunnen zählen einmal)
  well: {
    name: 'Brunnen', group: 'base', unlock: 1, cost: { wood: 2, stone: 4 }, buildTime: 8, radius: 6, houseBonus: 2,
  },
  // Erst als Stadt: alle Arbeiter schneller, nur einmal baubar
  townhall: {
    name: 'Rathaus', group: 'base', unlock: 4, cost: { planks: 10, stone: 16, iron: 4 }, buildTime: 30, unique: true, speedBonus: 0.15,
  },
  // Krönung der Stadt: kein Arbeiter, nur einmal; fertig gebaut wird die Stadt zur Großstadt
  monument: {
    name: 'Denkmal', group: 'base', unlock: 4, cost: { stone: 30, planks: 20, iron: 8 }, buildTime: 60, unique: true,
  },
  // Vom Ufer geradeaus übers Wasser (höchstens span Felder); am anderen Ufer ein kleines Gebiet als Brückenkopf
  bridge: {
    name: 'Brücke', group: 'base', unlock: 0, cost: { wood: 8, stone: 4 }, buildTime: 16, span: 8, territory: [5],
  },
};

// Bauleiste: Gruppen in dieser Reihenfolge
export const BUILD_GROUPS = { base: 'Grundbau', food: 'Nahrung', craft: 'Handwerk' };

export const MAPS = {
  forest: {
    name: 'Waldtal',
    desc: 'Dichte Wälder in einem geschützten Tal mit See. Viel Holz, wenig Stein.',
    waterLevel: 1.0, forestThreshold: 0.45, treeDensity: 0.6,
    rockHeight: 4, rockDensity: 0.12, rockScatter: 0.003, berry: 0.03, fish: 0.25,
    grass: ['#5f9b3f', '#3f7a2e'], sky: '#bfd9ea',
  },
  mountains: {
    name: 'Bergland',
    desc: 'Raue Hänge voller Felsen. Viel Stein, wenig fruchtbares Land.',
    waterLevel: 0.9, forestThreshold: 0.55, treeDensity: 0.5,
    rockHeight: 3.2, rockDensity: 0.25, rockScatter: 0.015, berry: 0.008, fish: 0.3,
    grass: ['#7d9a4d', '#5b7a3c'], sky: '#c8d6e2',
  },
  river: {
    name: 'Flussebene',
    desc: 'Weites, flaches Land an einem Fluss. Viel Platz, Fisch und Beeren, wenig Stein.',
    waterLevel: 1.0, forestThreshold: 0.58, treeDensity: 0.55,
    rockHeight: 99, rockDensity: 0, rockScatter: 0.004, berry: 0.045, fish: 0.3,
    grass: ['#78b04c', '#5a9440'], sky: '#cfe6f2',
  },
};
