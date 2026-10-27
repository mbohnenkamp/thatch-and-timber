// Balancing-Test: ein einfacher Testspieler spielt ohne Grafik und misst, wie das Spiel läuft.
// Aufruf: node tools/balance.mjs [Karte] [Jahre] [Seed]   z. B. node tools/balance.mjs forest 3 42
import { Game } from '../src/game.js';
import { SEASON_LENGTH } from '../src/config.js';
import { GOALS, rankOf } from '../src/goals.js';
import { makeBot } from './bot.mjs';
import { isSite } from '../src/entities/buildings.js';

const map = process.argv[2] || 'forest';
const years = Number(process.argv[3] || 3);
const seed = Number(process.argv[4] || 42);
const size = Number(process.argv[5] || 128);

const g = Game.create(map, seed, size);
const STEP = 0.1;
const { think, log, note, fmt } = makeBot(g);

const goalAt = [];
let goal = g.goal, hungry = 0, hungryWinter = 0, minFood = Infinity, think_t = 0, sample = 0;
const samples = [];
g.on('season', (se) => note(`--- ${se.name} Jahr ${se.year}: ${g.settlers.length} Siedler, Nahrung ${g.foodPoints()}, Holz ${g.total('wood')}, Stein ${g.total('stone')}, Bretter ${g.total('planks')}, Werkzeug ${g.total('tools')}`));
const end = years * 4 * SEASON_LENGTH;
const t0 = Date.now();
while (g.time < end) {
  g.update(STEP);
  think_t += STEP;
  if (think_t >= 5) { think_t = 0; think(); }
  if (g.hungry) { hungry += STEP; if (g.season.key === 'winter') hungryWinter += STEP; }
  if (g.time > 600) minFood = Math.min(minFood, g.foodPoints());
  if (g.goal !== goal) { goal = g.goal; goalAt.push([GOALS[goal - 1].text, g.time]); note(`AUFGABE ERFÜLLT: ${GOALS[goal - 1].text} -> ${rankOf(g)}`); }
  sample += STEP;
  if (sample >= 300) { sample = 0; samples.push([g.time, g.settlers.length, g.foodPoints(), g.hungry]); }
}

console.log(`Karte ${map}, Seed ${seed}, ${size}x${size}, ${years} Jahre, Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(log.join('\n'));
console.log('\nAufgaben:');
for (const [text, t] of goalAt) console.log(`  ${fmt(t)}  ${text}`);
const open = GOALS.slice(goalAt.length).map((x) => x.text);
if (open.length) console.log(`  offen: ${open.join(' | ')}`);
console.log(`\nHunger gesamt ${(hungry / 60).toFixed(1)} min, davon im Winter ${(hungryWinter / 60).toFixed(1)} min; kleinster Nahrungsvorrat nach 10 min: ${minFood}`);
console.log(`Ende: ${g.settlers.length} Siedler, Wohnraum ${g.housing}, Gebäude ${g.buildings.length}, Stufe ${rankOf(g)}`);
const sites = g.buildings.filter((b) => isSite(b));
if (sites.length) console.log('Offene Baustellen:', sites.map((b) => `${b.type}@${b.x},${b.z} geliefert ${JSON.stringify(b.delivered)} unterwegs ${JSON.stringify(b.incoming)} Bauer ${b.builders.length} Fortschritt ${Math.round((b.progress || 0) * 100) / 100}`).join(' | '));
const jobs = {};
for (const s of g.settlers) jobs[s.job || 'frei'] = (jobs[s.job || 'frei'] || 0) + 1;
const kinds = {}; for (const b of g.buildings) kinds[b.type] = (kinds[b.type] || 0) + 1; console.log('Gebäude:', JSON.stringify(kinds));
console.log('Berufe:', JSON.stringify(jobs), 'Karren:', g.carts.length, 'Lager:', JSON.stringify(Object.fromEntries(Object.entries(g.stock).filter(([, v]) => v))));
console.log('Verlauf (Zeit, Siedler, Nahrung, Hunger):', samples.map(([t, s, f, h]) => `${Math.round(t / 60)}m:${s}/${f}${h ? '!' : ''}`).join(' '));
