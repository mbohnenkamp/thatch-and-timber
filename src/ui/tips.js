import { BUILDINGS, NO_TOOL_JOBS } from '../config.js';
import { outputCap, slots, recipe } from '../entities/buildings.js';
import { growthFood } from '../economy.js';

const PREFS_KEY = 'siedler-dorf-tips';
const COOLDOWN = 180_000;
const CHECK_EVERY = 3000;

const of = (game, type) => game.buildings.filter((b) => b.type === type && !b.removed);
const done = (game, type) => of(game, type).filter((b) => b.done);
const has = (game, type) => of(game, type).length > 0;
const isSiteOpen = (b) => !b.removed && (!b.done || b.upgrading);

// Reihenfolge = Wichtigkeit. check() liefert null oder { target } (Gebäude zum Hinspringen)
const TIPS = [
  {
    id: 'controls',
    once: true,
    text: 'Willkommen! Ziehen verschiebt die Karte, Mausrad oder zwei Finger zoomen, Q und E drehen. Tippe Gebäude, Siedler oder Bäume an, um mehr zu erfahren.',
    check: () => ({}),
  },
  {
    id: 'first-woodcutter',
    text: 'Holz brauchst du für fast alles. Baue zuerst einen Holzfäller nahe am Wald. Der Kreis beim Platzieren zeigt, wie weit er läuft.',
    check: (g) => (!has(g, 'woodcutter') ? {} : null),
  },
  {
    id: 'hunger',
    text: 'Die Siedler hungern. Erntearbeiter arbeiten nur noch halb so schnell, und es ziehen keine neuen Siedler ein. Baue Sammler- oder Fischerhütten, eine Schäferei oder einen Bauernhof mit Mühle und Bäckerei.',
    check: (g) => (g.hungry ? {} : null),
  },
  {
    id: 'no-food-production',
    text: 'Noch produziert niemand Nahrung. Eine Sammlerhütte bei Beerensträuchern oder eine Fischerhütte am Wasser hilft schnell.',
    check: (g) => (g.time > 20 && !['gatherer', 'fisher', 'farm'].some((t) => has(g, t)) ? {} : null),
  },
  {
    id: 'no-tools',
    text: 'Das Werkzeug ist alle. Neue Holzfäller, Bauern und andere Berufe brauchen je ein Werkzeug. Ein Werkzeugmacher stellt es aus Brettern und Eisen her.',
    check: (g) => (g.available('tools') <= 0 && g.freeCount > 0 && g.buildings.some((b) => b.done && b.workers.length < slots(b) && !NO_TOOL_JOBS.includes(BUILDINGS[b.type].job)) ? {} : null),
  },
  {
    id: 'iron',
    text: 'Werkzeug braucht Eisen. Baue eine Erzmine bei den rostroten Felsen, eine Kohlemine bei den schwarzen und eine Schmelzhütte. Die Bergleute brauchen Nahrung. Liegt kein Erz in Reichweite, tauscht ein Markt andere Waren gegen Eisen.',
    check: (g) => (g.time > 240 && g.total('tools') <= 4 && !has(g, 'smelter') && !has(g, 'market') ? {} : null),
  },
  {
    id: 'planks',
    text: 'Für Ausbauten brauchst du Bretter. Ein Sägewerk macht sie aus Holz.',
    check: (g) => (g.time > 300 && !has(g, 'sawmill') ? {} : null),
  },
  {
    id: 'territory',
    text: 'Gebaut werden kann nur in deinem Gebiet, das die Grenzpfosten markieren. Außerhalb ist das Land dunkler. Ein Wachturm am Rand vergrößert das Gebiet, ein Ausbau des Turms noch mehr.',
    check: (g) => (g.time > 480 && !has(g, 'tower') ? {} : null),
  },
  {
    id: 'winter-coming',
    text: 'Der Winter naht. Dann wächst kein Getreide, es gibt keine Beeren und weniger Fische, die Siedler essen mehr und niemand zieht zu. Lege jetzt Vorräte an: Brot hält am längsten, Fischer und Schäferei arbeiten auch im Winter.',
    check: (g) => (g.seasonsOn && g.season.key === 'autumn' && g.season.progress > 0.4 ? {} : null),
  },
  {
    id: 'food-low',
    text: 'Neue Siedler ziehen nur ein, wenn je Einwohner mindestens 1 Nahrung auf Vorrat liegt (im Winter zieht niemand zu). Mehr Nahrung bekommst du mit weiteren Sammlern, Fischern, einer Schäferei oder einem Bauernhof. Brot zählt dreifach.',
    check: (g) => (g.time > 120 && g.settlers.length < g.housing && g.foodPoints() < growthFood(g) && g.season.key !== 'winter' ? {} : null),
  },
  {
    id: 'housing-full',
    text: 'Alle Wohnplätze sind belegt, deshalb kommen keine neuen Siedler. Baue ein Wohnhaus oder baue eines aus (Stufe 2 und 3 bieten mehr Platz).',
    check: (g) => (g.settlers.length >= g.housing && !of(g, 'house').some(isSiteOpen) ? {} : null),
  },
  {
    id: 'carriers-short',
    text: 'An mehreren Hütten ist die Ablage voll, weil die Träger nicht hinterherkommen. Baue das Lagerhaus aus (mehr Träger) oder baue ein zweites Lager.',
    check: (g) => {
      const full = g.buildings.filter((b) => b.done && b.workers.length && BUILDINGS[b.type].produces && b.output >= outputCap(b));
      return full.length >= 2 ? { target: g.warehouses[0] } : null;
    },
  },
  {
    id: 'builders-short',
    text: 'Alle Bauarbeiter sind beschäftigt, Baustellen warten. Baue die Bauhütte aus oder baue eine zweite.',
    check: (g) => {
      const builders = g.settlers.filter((s) => s.job === 'Bauarbeiter');
      const waiting = g.buildings.filter((b) => isSiteOpen(b) && b.builders.length === 0 && Object.keys(b.delivered).length);
      return builders.length && waiting.length >= 2 && builders.every((s) => /Baut|Geht zu/.test(s.status))
        ? { target: of(g, 'builderhut')[0] } : null;
    },
  },
  {
    id: 'no-builderhut',
    text: 'Es gibt keine Bauhütte. Ohne Bauarbeiter bauen nur freie Siedler, und das geht langsam. Baue eine Bauhütte.',
    check: (g) => (!has(g, 'builderhut') ? {} : null),
  },
  {
    id: 'nothing-in-range',
    text: 'Ein Arbeiter findet in seiner Reichweite nichts mehr. Reiß die Hütte ab (halbe Kosten zurück) und baue sie woanders neu, oder baue sie aus (größerer Radius).',
    check: (g) => {
      const s = g.settlers.find((s) => s.status === 'Findet nichts in der Nähe');
      return s ? { target: s.workplace } : null;
    },
  },
  {
    id: 'no-field-space',
    text: 'Der Bauer findet keinen Platz für Felder. Bauernhöfe brauchen flache, freie Fläche drumherum.',
    check: (g) => {
      const s = g.settlers.find((s) => s.status === 'Findet keinen Platz für Felder');
      return s ? { target: s.workplace } : null;
    },
  },
  {
    id: 'need-mill',
    text: 'Im Lager liegt Getreide, aber es gibt keine Mühle. Die Mühle macht daraus Mehl, die Bäckerei daraus Brot.',
    check: (g) => (g.total('grain') >= 4 && !has(g, 'mill') ? {} : null),
  },
  {
    id: 'need-bakery',
    text: 'Im Lager liegt Mehl, aber es gibt keine Bäckerei. Erst die Bäckerei macht daraus Brot (zählt dreifach als Nahrung).',
    check: (g) => (g.total('flour') >= 3 && !has(g, 'bakery') ? {} : null),
  },
  {
    id: 'processor-unstaffed',
    text: 'Eine Mühle oder Bäckerei hat Arbeit, aber keinen Arbeiter, weil kein Siedler frei ist. Mehr Wohnraum und Nahrung bringen neue Siedler.',
    check: (g) => {
      const b = g.buildings.find((b) => b.done && BUILDINGS[b.type].consumes && !b.workers.length && Object.keys(recipe(b)).every((k) => (b.inputs[k] || 0) > 0 || g.total(k) > 0));
      return b && g.freeCount === 0 ? { target: b } : null;
    },
  },
  {
    id: 'stone-low',
    text: 'Stein wird knapp. Baue einen Steinbruch in der Nähe von Felsen.',
    check: (g) => (g.time > 60 && g.available('stone') < 4 && !has(g, 'quarry') ? {} : null),
  },
  {
    id: 'roads',
    text: 'Wo deine Siedler oft laufen, entsteht ein Trampelpfad und später eine gepflasterte Straße. Auf Wegen sind sie schneller. Ab Lagerhaus Stufe 2 gibt es Pferdekarren, die viel laden, aber nur auf Straßen fahren.',
    check: (g) => (g.hadPath ? {} : null),
    once: true,
  },
  {
    id: 'cart-no-road',
    text: 'Ein Pferdekarren steht still, weil direkt am Lagerhaus noch keine Straße liegt. Straßen entstehen dort, wo viel gelaufen wird, also rund ums Lager meist bald von selbst.',
    check: (g) => {
      const c = g.carts.find((c) => c.status === 'Wartet auf eine Straße am Lagerhaus');
      return c && g.time - (c.waitSince ??= g.time) > 90 ? { target: c.workplace } : null;
    },
  },
  {
    id: 'upgrade-hint',
    text: 'Tipp: Fast jedes Gebäude lässt sich zweimal ausbauen. Werkstätten arbeiten dann schneller, Lager bekommen mehr Träger, Wohnhäuser mehr Platz. Tippe ein Gebäude an und wähle „Ausbauen".',
    check: (g) => (g.time > 400 && !g.buildings.some((b) => b.level > 1 || b.upgrading) ? {} : null),
  },
];

export class Advisor {
  constructor(root, { onShow }) {
    this.onShow = onShow;
    this.current = null;
    this.lastCheck = 0;
    this.prefs = { on: true, seen: {} };
    try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch { /* Standard */ }
    this.shownAt = {};

    const el = (this.el = document.createElement('div'));
    el.id = 'tip';
    el.hidden = true;
    el.innerHTML = `
      <div class="tip-head">Tipp</div>
      <p class="tip-text"></p>
      <div class="tip-actions">
        <button data-t="show">Zeigen</button>
        <button data-t="ok">Verstanden</button>
        <button data-t="off">Tipps aus</button>
      </div>`;
    root.appendChild(el);
    this.text = el.querySelector('.tip-text');
    this.showBtn = el.querySelector('[data-t=show]');
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (t === 'show' && this.current?.target) this.onShow(this.current.target);
      if (t === 'ok') this.dismiss();
      if (t === 'off') this.setOn(false);
    });
  }

  save() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch { /* egal */ }
  }

  get on() { return this.prefs.on; }

  setOn(value) {
    this.prefs.on = value;
    this.save();
    if (!value) this.hide();
    else this.lastCheck = 0;
  }

  hide() {
    this.current = null;
    this.el.hidden = true;
  }

  dismiss() {
    if (!this.current) return;
    this.shownAt[this.current.tip.id] = performance.now();
    if (this.current.tip.once) {
      this.prefs.seen[this.current.tip.id] = true;
      this.save();
    }
    this.hide();
  }

  update(game) {
    if (!this.prefs.on) return;
    const now = performance.now();
    if (now - this.lastCheck < CHECK_EVERY) return;
    this.lastCheck = now;

    // Angezeigter Tipp verschwindet, sobald das Problem gelöst ist
    if (this.current) {
      if (this.current.tip.once || this.current.tip.check(game)) return;
      this.shownAt[this.current.tip.id] = now;
      this.hide();
      return;
    }

    for (const tip of TIPS) {
      if (tip.once && this.prefs.seen[tip.id]) continue;
      if (now - (this.shownAt[tip.id] ?? -Infinity) < COOLDOWN) continue;
      const hit = tip.check(game);
      if (!hit) continue;
      this.current = { tip, target: hit.target };
      this.text.textContent = tip.text;
      this.showBtn.hidden = !hit.target;
      this.el.hidden = false;
      return;
    }
  }
}
