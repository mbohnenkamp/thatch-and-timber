import { SEASON_LENGTH, BUILD_GROUPS, TRADE_VALUE, NO_TOOL_JOBS, MAP_SIZES, DEFAULT_MAP_SIZE, BUILDINGS, ITEMS, MAPS, RESOURCES, MAX_LEVEL, WORK_RADIUS, BREAD_FOOD, ROAD, CART } from '../config.js';

const ROAD_ICON = '<svg viewBox="0 0 32 32"><path d="M6 28L13 4h6l7 24z" fill="#9b9384"/><path d="M15.2 8h1.6l.4 4h-2.4zM14.6 16h2.8l.5 5h-3.8z" fill="#efe6d2"/></svg>';
import { currentGoal, rankOf, isUnlocked, RANKS } from '../goals.js';
import { siteCost, siteCap, upgradeCost, slots, housingOf, nearWell, outputItem, outputCap, recipe, tradeRate, workSpeed } from '../entities/buildings.js';

const ICONS = {
  wood: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4" fill="#8a5a32"/><circle cx="19" cy="12" r="3.2" fill="#d9b07a"/><circle cx="19" cy="12" r="1.2" fill="#8a5a32"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M4 17l3-8 6-3 6 4 1 7z" fill="#a29f96"/><path d="M7 9l6-3 6 4-6 1z" fill="#c7c4bb"/></svg>',
  food: '<svg viewBox="0 0 24 24"><circle cx="9" cy="14" r="5" fill="#c6283c"/><circle cx="15.5" cy="13" r="4.5" fill="#d9404f"/><path d="M12 8c0-3 2-4 4-4" stroke="#3f7a33" stroke-width="2" fill="none"/></svg>',
  planks: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="4" rx="1" fill="#d9b07a"/><rect x="3" y="11" width="18" height="4" rx="1" fill="#c79a62"/><rect x="3" y="16" width="18" height="4" rx="1" fill="#d9b07a"/></svg>',
  tools: '<svg viewBox="0 0 24 24"><path d="M5 19l9-9" stroke="#8a5a32" stroke-width="3" stroke-linecap="round"/><path d="M12 5l6 6-3 1-4-4z" fill="#8a8f95"/></svg>',
  iron: '<svg viewBox="0 0 24 24"><path d="M3 15l4-6h10l4 6z" fill="#8d949c"/><path d="M7 9h10l1.5 2.2h-13z" fill="#b9bfc5"/><rect x="3" y="15" width="18" height="3" fill="#6f7680"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.5" fill="#f0c39b"/><path d="M6 21c0-5 3-8 6-8s6 3 6 8z" fill="#7a6a55"/></svg>',
};

const ROOF = { townhall: '#b3472f', oremine: '#6d6a64', coalmine: '#3b3735', smelter: '#b3472f', market: '#c6283c', sawmill: '#7a5230', toolmaker: '#b3472f', tower: '#b3472f', sheepfarm: '#c9a24a', well: '#a2612f', warehouse: '#b3472f', builderhut: '#7a5230', farm: '#c9a24a', mill: '#8a5a32', bakery: '#b3472f', woodcutter: '#c9a24a', quarry: '#6d6a64', gatherer: '#c9a24a', fisher: '#5d7d95', house: '#b3472f' };
const WALL = { townhall: '#ece0c4', oremine: '#c0714a', coalmine: '#a29f96', smelter: '#a29f96', market: '#e8c440', sawmill: '#c9a77a', toolmaker: '#a29f96', tower: '#c9c9c6', sheepfarm: '#c9a77a', well: '#c9c9c6', warehouse: '#ece0c4', builderhut: '#c9a77a', farm: '#e2d2a8', mill: '#ece0c4', bakery: '#ece0c4', woodcutter: '#c9a77a', quarry: '#a29f96', gatherer: '#d8c49a', fisher: '#b9a27e', house: '#ece0c4' };
const WELL_ICON = '<svg viewBox="0 0 32 32"><rect x="8" y="10" width="2.5" height="12" fill="#9a5a30"/><rect x="21.5" y="10" width="2.5" height="12" fill="#9a5a30"/><path d="M5 12L16 5l11 7z" fill="#a2612f"/><rect x="7" y="19" width="18" height="9" rx="1.5" fill="#c9c9c6"/><path d="M7 23h18M12 19v4M20 19v4M16 23v5" stroke="#97979a" stroke-width="1"/><rect x="14.5" y="13" width="3" height="3.5" fill="#7a4a28"/></svg>';
const BRIDGE_ICON = '<svg viewBox="0 0 32 32"><rect x="2" y="22" width="28" height="6" fill="#5d9bd0"/><path d="M3 18q13-8 26 0v3q-13-7-26 0z" fill="#a0703f"/><path d="M3 13q13-8 26 0" stroke="#8a5a32" stroke-width="1.5" fill="none"/><path d="M9 11v7M16 8.5v6M23 11v7" stroke="#8a5a32" stroke-width="1.5"/></svg>';
const houseIcon = (t) => t === 'well' ? WELL_ICON : t === 'bridge' ? BRIDGE_ICON :
  `<svg viewBox="0 0 32 32"><rect x="7" y="15" width="18" height="12" fill="${WALL[t]}"/><path d="M4 16L16 6l12 10z" fill="${ROOF[t]}"/><rect x="14" y="20" width="4" height="7" fill="#5b3a1e"/></svg>`;

const costText = (cost) => Object.entries(cost).map(([k, v]) => `${v} ${ITEMS[k]}`).join(', ');

export function showMenu(root, { saves, canCreate, onStart, onContinue, onDelete, preview }) {
  const el = document.createElement('div');
  el.id = 'menu';
  el.innerHTML = `
    <div class="menu-box">
      <h1>Thatch &amp; Timber</h1>
      <p class="sub">Wähle eine Landschaft für deine Siedlung</p>
      <div class="sizes">
        <span>Kartengröße:</span>
        ${Object.entries(MAP_SIZES).map(([k, m]) => `<button data-size="${k}">${m.name} <small>${m.size}×${m.size}</small></button>`).join('')}
      </div>
      <div class="maps">
        ${Object.entries(MAPS).map(([k, m]) => `
          <button class="map-card" data-map="${k}">
            <span class="map-pic loading"><span class="reroll" data-reroll="${k}" title="Andere Karte">Andere Karte</span></span>
            <strong>${m.name}</strong>
            <span>${m.desc}</span>
          </button>`).join('')}
      </div>
      <p class="full-note" hidden>Alle ${saves.max} Plätze für Spielstände sind belegt. Lösche unten zuerst einen, dann kannst du neu anfangen.</p>
      <div class="saves" ${saves.list.length ? '' : 'hidden'}>
        <h2>Deine Spielstände</h2>
        ${saves.list.map((s) => `
          <div class="save-row" data-id="${s.id}">
            <div class="save-info"><strong>${s.title}</strong><span>${s.detail}</span><small>${s.when}</small></div>
            <button class="btn" data-a="load">Fortsetzen</button>
            <button class="btn secondary" data-a="del">Löschen</button>
            <span class="del-ask" hidden>Wirklich löschen? <button class="btn danger" data-a="del-yes">Ja</button><button class="btn secondary" data-a="del-no">Nein</button></span>
          </div>`).join('')}
      </div>
      <p class="credits">3D-Modelle: Kenney.nl (CC0)</p>
    </div>`;
  root.appendChild(el);
  // Jede Landschaft hat eine ausgewürfelte Karte; die Vorschau zeigt genau diese
  const seeds = {};
  const newSeed = () => Math.floor(Math.random() * 1e9);
  let sizeKey = DEFAULT_MAP_SIZE;
  try { sizeKey = MAP_SIZES[localStorage.getItem('siedler-dorf-size')] ? localStorage.getItem('siedler-dorf-size') : DEFAULT_MAP_SIZE; } catch { /* Standard */ }
  const size = () => MAP_SIZES[sizeKey].size;
  const markSize = () => el.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === sizeKey));
  markSize();
  // Vorschauen nacheinander zeichnen; ein neuer Durchlauf bricht den alten ab
  let run = 0;
  const showAll = async () => {
    const mine = ++run;
    for (const map of Object.keys(MAPS)) {
      if (mine !== run) return;
      seeds[map] ??= newSeed();
      await showPreview(map);
    }
  };
  el.querySelectorAll('[data-size]').forEach((b) => {
    b.onclick = () => {
      sizeKey = b.dataset.size;
      try { localStorage.setItem('siedler-dorf-size', sizeKey); } catch { /* egal */ }
      markSize();
      showAll();
    };
  });
  const showPreview = async (map) => {
    const pic = el.querySelector(`.map-card[data-map=${map}] .map-pic`);
    pic.classList.add('loading');
    const url = await preview?.(map, seeds[map], size());
    if (url) pic.style.backgroundImage = `url(${url})`;
    pic.classList.remove('loading');
  };
  showAll();
  el.querySelectorAll('[data-reroll]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      seeds[b.dataset.reroll] = newSeed();
      showPreview(b.dataset.reroll);
    };
  });
  const begin = (map) => {
    el.remove();
    onStart(map, seeds[map] ?? newSeed(), size());
  };
  // Neues Spiel bekommt einen eigenen Platz; nichts wird überschrieben
  const note = el.querySelector('.full-note');
  el.querySelectorAll('.map-card').forEach((b) => {
    b.onclick = () => {
      if (!canCreate()) {
        note.hidden = false;
        note.scrollIntoView({ block: 'nearest' });
        return;
      }
      begin(b.dataset.map);
    };
  });
  // Eigene Rückfrage statt confirm(): eingebaute Browser unterdrücken solche Fenster
  el.querySelectorAll('.save-row').forEach((row) => {
    const id = Number(row.dataset.id);
    const ask = row.querySelector('.del-ask');
    row.querySelector('[data-a=load]').onclick = () => {
      el.remove();
      onContinue(id);
    };
    row.querySelector('[data-a=del]').onclick = () => { ask.hidden = false; };
    row.querySelector('[data-a=del-no]').onclick = () => { ask.hidden = true; };
    row.querySelector('[data-a=del-yes]').onclick = () => {
      onDelete(id);
      row.remove();
      note.hidden = true;
      if (!el.querySelector('.save-row')) el.querySelector('.saves').hidden = true;
    };
  });
}

export class Hud {
  constructor(root, handlers) {
    this.h = handlers;
    this.last = 0;
    this.infoHtml = '';
    this.sel = null;

    const types = Object.keys(BUILDINGS).filter((t) => BUILDINGS[t].placeable !== false);
    const el = (this.el = document.createElement('div'));
    el.id = 'hud';
    el.innerHTML = `
      <div id="topbar">
        <div class="res" data-k="wood">${ICONS.wood}<b></b><span>Holz</span></div>
        <div class="res" data-k="stone">${ICONS.stone}<b></b><span>Stein</span></div>
        <div class="res" data-k="food">${ICONS.food}<b></b><span>Nahrung</span></div>
        <div class="res" data-k="planks">${ICONS.planks}<b></b><span>Bretter</span></div>
        <div class="res" data-k="tools">${ICONS.tools}<b></b><span>Werkzeug</span></div>
        <div class="res" data-k="iron">${ICONS.iron}<b></b><span>Eisen</span></div>
        <div class="res" data-k="pop">${ICONS.people}<b></b><span></span></div>
        <div class="crew" data-k="builders" title="Bauarbeiter: beschäftigt / vorhanden"></div>
        <div class="crew" data-k="carriers" title="Träger: beschäftigt / vorhanden"></div>
        <div class="season" title=""><i></i><b></b><span></span></div>
        <div class="hunger" hidden>Hunger!</div>
        <div class="spacer"></div>
        <div class="group speed">
          <button data-s="0" title="Pause (Leertaste)">II</button>
          <button data-s="1">1×</button>
          <button data-s="2">2×</button>
          <button data-s="4">4×</button>
        </div>
        <div class="group">
          <button data-a="settings">Einstellungen</button>
          <button data-a="save">Speichern</button>
          <button data-a="menu">Menü</button>
        </div>
      </div>
      <div id="settings" hidden>
        <h3>Einstellungen</h3>
        <button data-set="sound"></button>
        <button data-set="music"></button>
        <button data-set="tips"></button>
        <button data-set="graphics"></button>
        <button data-set="dayNight"></button>
        <button data-set="seasons"></button>
      </div>
      <div id="goal"><b></b><span></span><small></small><i><u></u></i></div>
      <div id="info" hidden></div>
      <div id="hint" hidden></div>
      <div id="toasts"></div>
      <div id="buildbar">
        <div class="cats">${Object.entries(BUILD_GROUPS).map(([k, name]) => `<button data-g="${k}">${name}</button>`).join('')}</div>
        <div class="items">
        ${types.map((t) => `
          <button class="build" data-t="${t}" data-g="${BUILDINGS[t].group}">
            ${houseIcon(t)}
            <span class="name">${BUILDINGS[t].name}</span>
            <span class="cost">${costText(BUILDINGS[t].cost)}</span>
          </button>`).join('')}
        <button class="build" data-t="road" data-g="base">
          ${ROAD_ICON}
          <span class="name">Straße</span>
          <span class="cost">${ROAD.buildCost} Stein je Feld</span>
        </button>
        </div>
      </div>`;
    root.appendChild(el);

    this.res = {};
    el.querySelectorAll('.res').forEach((r) => { this.res[r.dataset.k] = r; });
    this.hunger = el.querySelector('.hunger');
    this.season = el.querySelector('.season');
    this.goalEl = el.querySelector('#goal');
    this.crew = {};
    el.querySelectorAll('.crew').forEach((c) => { this.crew[c.dataset.k] = c; });
    this.info = el.querySelector('#info');
    this.hint = el.querySelector('#hint');
    this.toasts = el.querySelector('#toasts');
    this.buildButtons = [...el.querySelectorAll('.build')];
    this.speedButtons = [...el.querySelectorAll('.speed button')];

    this.buildButtons.forEach((b) => { b.onclick = () => handlers.onBuild(b.dataset.t); });
    // Gruppen der Bauleiste; neu freigeschaltete Gebäude markieren ihre Gruppe
    this.group = 'base';
    this.fresh = new Set();
    this.catButtons = [...el.querySelectorAll('.cats button')];
    this.catButtons.forEach((b) => {
      b.onclick = () => {
        this.group = b.dataset.g;
        for (const t of [...this.fresh]) if (BUILDINGS[t].group === this.group) this.fresh.delete(t);
        this.last = 0;
      };
    });
    this.speedButtons.forEach((b) => { b.onclick = () => handlers.onSpeed(+b.dataset.s); });
    el.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'save') handlers.onSave();
        else if (a === 'menu') handlers.onMenu();
        else if (a === 'settings') this.settings.hidden = !this.settings.hidden;
      };
    });
    this.settings = el.querySelector('#settings');
    this.settings.addEventListener('click', (e) => {
      const key = e.target.closest('[data-set]')?.dataset.set;
      if (key) this.showSettings(handlers.onSetting(key));
    });
    this.info.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') handlers.onClose();
      if (act && act !== 'close' && this.sel) handlers.onAction(act, this.sel.ref);
    });
  }

  // Starthinweis für den gewählten Bau- oder Straßenmodus
  setMode(buildType) {
    this.hintFor = buildType;
    this.hint.hidden = !buildType;
    if (buildType === 'road') this.hint.textContent = 'Straße bauen: Startfeld antippen, dann Zielfeld. Weitere Ziele verlängern die Straße. Rechtsklick oder Esc beendet.';
    else if (BUILDINGS[buildType]?.span) this.hint.textContent = `Brücke bauen: auf das Ufer direkt am Wasser tippen. Sie führt geradeaus zum Ufer gegenüber (höchstens ${BUILDINGS.bridge.span} Felder Wasser).`;
    else if (buildType) this.hint.textContent = `${BUILDINGS[buildType].name} platzieren: auf einen freien Platz tippen. Rechtsklick oder Esc bricht ab.`;
  }

  // Ehrentafel beim Erreichen der Stadt (und später über das Rathaus)
  showHonor(game) {
    this.el.querySelector('#honor')?.remove();
    const t = game.cityAt ?? game.time;
    const days = Math.max(1, Math.round(t / (SEASON_LENGTH / 2)));
    const size = Object.values(MAP_SIZES).find((m) => m.size === game.size)?.name || '';
    const rows = [
      ['Karte', `${MAPS[game.mapType].name}${size ? `, ${size}` : ''}`],
      ['Stadt nach', `${days} Spieltag${days === 1 ? '' : 'en'} (Jahr ${Math.floor(t / SEASON_LENGTH / 4) + 1})`],
      ['Spielzeit bei 1×', `${Math.round(t / 60)} Minuten`],
      ['Siedler', game.settlers.length],
      ['Gebäude', game.buildings.filter((b) => b.done && !b.removed).length],
      ['Hunger insgesamt', `${Math.round(game.hungerTime / 60)} Minuten`],
    ];
    const el = document.createElement('div');
    el.id = 'honor';
    el.innerHTML = `<div class="card">
      <h2>Ehrentafel</h2>
      <p class="town">${game.townName} ist eine Stadt!</p>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p>Du kannst weiterspielen. Neu freigeschaltet: das Rathaus.</p>
      <button class="btn">Weiterspielen</button>
    </div>`;
    el.querySelector('button').onclick = () => el.remove();
    this.el.appendChild(el);
  }

  setHint(text) {
    this.hint.textContent = text;
  }

  showSettings(st) {
    const labels = {
      sound: `Ton: ${st.sound ? 'an' : 'aus'}`,
      music: `Musik: ${st.music ? 'an' : 'aus'}`,
      tips: `Tipps: ${st.tips ? 'an' : 'aus'}`,
      graphics: `Grafik: ${st.graphics === 'low' ? 'einfach' : 'hoch'}`,
      dayNight: `Tag und Nacht: ${st.dayNight ? 'an' : 'aus'}`,
      seasons: `Jahreszeiten: ${st.seasons ? 'an' : 'aus'}`,
    };
    for (const [k, text] of Object.entries(labels)) this.settings.querySelector(`[data-set=${k}]`).textContent = text;
  }

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3300);
  }

  update(game, buildType, sel, speed) {
    const now = performance.now();
    if (now - this.last < 200) return;
    this.last = now;

    const stock = game.stock;
    this.res.wood.querySelector('b').textContent = stock.wood;
    this.res.stone.querySelector('b').textContent = stock.stone;
    this.res.planks.querySelector('b').textContent = stock.planks;
    this.res.tools.querySelector('b').textContent = stock.tools;
    this.res.iron.querySelector('b').textContent = stock.iron;
    this.res.iron.title = `Eisen ${stock.iron}, Erz ${stock.ore}, Kohle ${stock.coal}`;
    this.res.food.querySelector('b').textContent = game.foodPoints();
    this.res.food.title = `Nahrung ${game.total('food')}, Brot ${game.total('bread')} (je ${BREAD_FOOD}), Getreide ${game.total('grain')}, Mehl ${game.total('flour')}`;
    this.res.pop.querySelector('b').textContent = `${game.settlers.length}/${game.housing}`;
    this.res.pop.querySelector('span').textContent = `Siedler, ${game.freeCount} frei`;
    this.hunger.hidden = !game.hungry;
    const goal = currentGoal(game);
    this.goalEl.querySelector('b').textContent = rankOf(game);
    if (goal) {
      const [have, need] = goal.progress(game);
      this.goalEl.querySelector('span').textContent = `${goal.text} (${Math.min(have, need)}/${need})`;
      const next = goal.rank > RANKS.indexOf(rankOf(game)) ? Object.keys(BUILDINGS).filter((t) => BUILDINGS[t].unlock === goal.rank) : [];
      this.goalEl.querySelector('small').textContent = next.length ? `Danach ${RANKS[goal.rank]}: ${next.map((t) => BUILDINGS[t].name).join(', ')}` : '';
      this.goalEl.querySelector('u').style.width = `${Math.min(1, have / need) * 100}%`;
    } else {
      this.goalEl.querySelector('span').textContent = 'Alle Aufgaben erfüllt!';
      this.goalEl.querySelector('small').textContent = '';
      this.goalEl.querySelector('u').style.width = '100%';
    }
    const bar = this.el.querySelector('#topbar');
    this.goalEl.style.top = `${bar.offsetHeight + 8}px`;
    const narrow = window.innerWidth < 700;
    this.toasts.style.top = `${bar.offsetHeight + 8 + (narrow ? this.goalEl.offsetHeight + 8 : 0)}px`;
    const se = game.season;
    this.season.hidden = !game.seasonsOn;
    this.season.dataset.k = se.key;
    this.season.querySelector('b').textContent = se.name;
    this.season.querySelector('span').textContent = `Jahr ${se.year}`;
    this.season.querySelector('i').style.setProperty('--p', se.progress);
    this.season.title = `${se.name}: ${Math.round(se.progress * 100)} % vorbei`;
    this.updateCrew(game);

    for (const b of this.buildButtons) {
      const t = b.dataset.t;
      const cost = t === 'road' ? { stone: ROAD.buildCost } : BUILDINGS[t].cost;
      b.hidden = b.dataset.g !== this.group || (t !== 'road' && !isUnlocked(game, t));
      b.classList.toggle('disabled', !game.canAfford(cost));
      b.classList.toggle('on', t === buildType);
      b.classList.toggle('fresh', this.fresh.has(t));
    }
    for (const c of this.catButtons) {
      c.classList.toggle('on', c.dataset.g === this.group);
      c.classList.toggle('fresh', [...this.fresh].some((t) => BUILDINGS[t].group === c.dataset.g));
    }
    for (const b of this.speedButtons) b.classList.toggle('on', +b.dataset.s === speed);

    if (buildType !== this.hintFor) this.setMode(buildType);

    this.renderInfo(game, sel);
  }

  updateCrew(game) {
    const sites = game.buildings.filter((b) => !b.removed && (!b.done || b.upgrading));
    const waitingSites = sites.some((b) => b.builders.length === 0 && b.progress < siteCap(b) - 1e-6);
    const crews = [
      ['builders', 'Bauarbeiter', (s) => /Baut|Geht zu/.test(s.status), waitingSites],
      ['carriers', 'Träger', (s) => s.status !== 'Wartet auf Aufträge', sites.length > 0],
    ];
    for (const [key, label, isBusy, demand] of crews) {
      const job = key === 'builders' ? 'Bauarbeiter' : 'Träger';
      const team = game.settlers.filter((s) => s.job === job);
      const busy = team.filter(isBusy).length;
      const short = demand && (team.length === 0 || busy === team.length);
      const el = this.crew[key];
      el.textContent = `${label} ${busy}/${team.length}`;
      el.classList.toggle('short', short);
      el.title = short
        ? (team.length ? `Alle ${label} sind beschäftigt` : `Keine ${label}`)
        : `${label}: beschäftigt / vorhanden`;
    }
  }

  renderInfo(game, sel) {
    this.sel = sel;
    if (!sel || sel.ref.removed || sel.ref.gone || (sel.kind === 'cart' && !game.carts.includes(sel.ref))
      || (sel.kind === 'roadPlan' && !game.roadPlans.includes(sel.ref))) {
      this.info.hidden = true;
      this.infoHtml = '';
      return;
    }
    const html = this.infoFor(game, sel);
    if (html !== this.infoHtml) {
      this.info.innerHTML = `<button class="close" data-act="close" title="Schließen">×</button>${html}`;
      this.infoHtml = html;
    }
    this.info.hidden = false;
  }

  siteReason(game, b) {
    if (b.builders.length) return `<em>Es bauen:</em> ${b.builders.map((s) => s.name).join(', ')}`;
    if (b.progress < siteCap(b) - 1e-6) {
      if (!game.settlers.some((s) => s.job === 'Bauarbeiter')) {
        return '<span class="warn-text">Keine Bauarbeiter. Bauhütte bauen oder Siedler frei halten.</span>';
      }
      return '<span class="warn-text">Wartet auf einen freien Bauarbeiter, alle sind beschäftigt</span>';
    }
    const onWay = Object.entries(b.incoming).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${ITEMS[k]}`);
    if (onWay.length) return `Material unterwegs: ${onWay.join(', ')}`;
    const carriers = game.settlers.filter((s) => s.job === 'Träger');
    if (!carriers.length) return '<span class="warn-text">Keine Träger am Lagerhaus</span>';
    return '<span class="warn-text">Wartet auf Träger, alle sind beschäftigt</span>';
  }

  infoFor(game, { kind, ref }) {
    if (kind === 'cart') {
      return `<h3>Pferdekarren</h3>
        <p>Lädt bis zu ${CART.capacity} Waren und fährt nur auf Straßen.</p>
        <p><em>Tätigkeit:</em> ${ref.status}</p>
        ${ref.carry ? `<p><em>Geladen:</em> ${ref.carryAmount} ${ITEMS[ref.carry]}</p>` : ''}`;
    }
    if (kind === 'roadPlan') {
      return `<h3>Geplante Straße</h3><p>${ref.builder ? `${ref.builder.name} pflastert gerade` : 'Wartet auf einen Bauarbeiter'}</p>`;
    }
    if (kind === 'road') {
      const level = game.grid.road[game.grid.idx(ref.x, ref.z)];
      const pct = Math.round((ROAD.speed[level] - 1) * 100);
      if (level === 2) return `<h3>Straße</h3><p>Siedler sind hier ${pct} % schneller. Pferdekarren können hier fahren.</p>`;
      if (level === 1) return `<h3>Trampelpfad</h3><p>Siedler sind hier ${pct} % schneller. Wird viel gelaufen, entsteht daraus eine Straße. Unbenutzt verwildert er wieder.</p>`;
      return '<h3>Wiese</h3>';
    }
    if (kind === 'settler') {
      return `<h3>${ref.name}</h3>
        <p><em>Beruf:</em> ${ref.job || 'Bauarbeiter / frei'}</p>
        <p><em>Tätigkeit:</em> ${ref.status}</p>
        ${ref.carry ? `<p><em>Trägt:</em> ${ITEMS[ref.carry]}</p>` : ''}`;
    }
    if (kind === 'field') {
      const text = { planned: 'Wird angelegt', growing: `Wächst: ${Math.round(ref.growth * 100)} %`, ripe: 'Reif zur Ernte' }[ref.state];
      return `<h3>Getreidefeld</h3><p>${text}</p><p><em>Gehört zu:</em> Bauernhof</p>`;
    }
    if (kind === 'resource') {
      const def = RESOURCES[ref.type];
      if (ref.amount > 0) return `<h3>${def.name}</h3><p>Vorrat: ${ref.amount} ${ITEMS[def.item]}</p>`;
      if (def.regrow) return `<h3>${def.name}</h3><p>Wächst nach: ${Math.round((ref.timer / def.regrow) * 100)} %</p>`;
      return `<h3>${def.name}</h3><p>Erschöpft</p>`;
    }

    const def = BUILDINGS[ref.type];
    const p = [];
    const mats = (cost) => Object.entries(cost)
      .map(([k, v]) => `${ITEMS[k]} ${Math.min(v, ref.delivered[k] || 0)}/${v}`).join(' · ');

    if (!ref.done) {
      p.push(`<p><em>Baustelle:</em> ${Math.round(ref.progress * 100)} %</p>`);
      p.push(`<p><em>Material:</em> ${mats(siteCost(ref))}</p>`);
      p.push(`<p>${this.siteReason(game, ref)}</p>`);
      p.push('<button class="danger" data-act="demolish">Baustelle abbrechen</button>');
      return `<h3>${def.name}</h3>${p.join('')}`;
    }

    if (def.upgrades) p.push(`<p><em>Stufe:</em> ${ref.level} von ${MAX_LEVEL}</p>`);
    if (def.job) {
      const names = ref.workers.map((w) => w.name).join(', ') || 'noch niemand';
      p.push(`<p><em>${def.job}:</em> ${names} (${ref.workers.length}/${slots(ref)})</p>`);
      if (ref.workers.length < slots(ref) && !NO_TOOL_JOBS.includes(def.job) && game.available('tools') <= 0) {
        p.push('<p class="warn-text">Kein Werkzeug im Lager — ohne Werkzeug fängt niemand neu an. Baue einen Werkzeugmacher.</p>');
      }
    }
    if (def.produces) {
      if (ref.workers[0]) p.push(`<p>${ref.workers[0].status}</p>`);
      if (def.consumes) p.push(`<p><em>Vorrat:</em> ${Object.entries(recipe(ref)).map(([k, n]) => `${ITEMS[k]} ${ref.inputs[k] || 0}/${outputCap(ref) * n}`).join(' · ')}</p>`);
      if (def.sheep) p.push(`<p><em>Schafe:</em> ${def.sheep[ref.level - 1]}</p>`);
      if (def.fields) {
        const mine = game.fields.filter((f) => f.farm === ref);
        p.push(`<p><em>Felder:</em> ${mine.length}/${def.fields[ref.level - 1]}, davon reif: ${mine.filter((f) => f.state === 'ripe').length}</p>`);
      }
      p.push(`<p><em>Ablage:</em> ${ref.output}/${outputCap(ref)} ${ITEMS[outputItem(ref)]}</p>`);
      const radius = def.resource ? ` · <em>Radius:</em> ${WORK_RADIUS[ref.level - 1]}` : '';
      p.push(`<p><em>Tempo:</em> ${Math.round(workSpeed(game, ref) * 100)} %${radius}</p>`);
    }
    if (def.trade) {
      if (ref.workers[0]) p.push(`<p>${ref.workers[0].status}</p>`);
      const chips = (side, current) => Object.keys(TRADE_VALUE)
        .map((k) => `<button class="chip${k === current ? ' on' : ''}" data-act="${side}:${k}">${ITEMS[k]}</button>`).join('');
      const t = ref.trade, sel = t || ref.pending || {};
      p.push(`<p><em>Gibt ab:</em></p><div class="chips">${chips('give', sel.give)}</div>`);
      p.push(`<p><em>Bekommt:</em></p><div class="chips">${chips('get', sel.get)}</div>`);
      if (t) {
        const r = tradeRate(t.give, t.get);
        p.push(`<p><em>Kurs:</em> ${r.give} ${ITEMS[t.give]} → ${r.get} ${ITEMS[t.get]}</p>`);
        p.push(`<p><em>Vorrat:</em> ${ref.inputs[t.give] || 0} ${ITEMS[t.give]} · <em>Ablage:</em> ${ref.output} ${ITEMS[t.get]}</p>`);
        p.push(`<p>Der Händler lässt immer ${def.keep} ${ITEMS[t.give]} im Lager und pausiert ab ${def.stockLimit} ${ITEMS[t.get]}.</p>`);
      } else p.push('<p>Wähle, was abgegeben wird und was du dafür bekommst.</p>');
    }
    if (housingOf(ref)) {
      const bonus = ref.type === 'house' && nearWell(game, ref) ? ` (davon ${BUILDINGS.well.houseBonus} durch Brunnen)` : '';
      p.push(`<p><em>Wohnraum:</em> ${housingOf(ref, game)} Siedler${bonus}</p>`);
    }
    if (ref.type === 'townhall') {
      p.push(`<p>Alle Arbeiter in ${game.townName} arbeiten ${Math.round(def.speedBonus * 100)} % schneller.</p>`);
      if (game.cityAt != null) p.push('<button class="secondary" data-act="honor">Ehrentafel ansehen</button>');
    }
    if (def.territory) p.push(`<p><em>Gebiet:</em> Radius ${def.territory[ref.level - 1]} Felder</p>`);
    if (ref.type === 'well') {
      const homes = game.buildings.filter((h) => h.type === 'house' && h.done && Math.hypot(h.x - ref.x, h.z - ref.z) <= def.radius).length;
      p.push(`<p>Wohnhäuser im Umkreis von ${def.radius} Feldern haben ${def.houseBonus} Plätze mehr.</p><p><em>Versorgt:</em> ${homes} Wohnh${homes === 1 ? 'aus' : 'äuser'}</p>`);
    }
    if (ref.type === 'warehouse') {
      const carts = game.carts.filter((c) => c.workplace === ref).length;
      const next = CART.perLevel[ref.level];
      p.push(`<p><em>Pferdekarren:</em> ${carts}${next > carts ? ` (Stufe ${ref.level + 1}: ${next})` : ''}</p>`);
      if (carts && !game.grid.hasRoadAccess(ref.x, ref.z)) p.push('<p class="warn-text">Die Karren brauchen eine Straße direkt am Lagerhaus.</p>');
      p.push(`<p><em>Im Lager:</em> ${Object.entries(ref.stock).filter(([k, v]) => v > 0 || ['wood', 'stone', 'food'].includes(k)).map(([k, v]) => `${ITEMS[k]} ${v}`).join(' · ')}</p>`);
    }

    if (ref.upgrading) {
      p.push(`<p><em>Ausbau auf Stufe ${ref.level + 1}:</em> ${Math.round(ref.progress * 100)} %</p>`);
      p.push(`<p><em>Material:</em> ${mats(siteCost(ref))}</p>`);
      p.push(`<p>${this.siteReason(game, ref)}</p>`);
      p.push('<button class="secondary" data-act="cancel-upgrade">Ausbau abbrechen</button>');
    } else {
      const cost = upgradeCost(ref);
      if (cost) {
        const ok = game.canAfford(cost);
        p.push(`<button class="upgrade" data-act="upgrade" ${ok ? '' : 'disabled'}>Ausbauen auf Stufe ${ref.level + 1}<small>${costText(cost)}${ok ? '' : ' (fehlt)'}</small></button>`);
      }
    }
    const err = game.demolishError(ref);
    if (!err) p.push('<button class="danger" data-act="demolish">Abreißen (halbe Baukosten zurück)</button>');
    return `<h3>${def.name}</h3>${p.join('')}`;
  }
}
