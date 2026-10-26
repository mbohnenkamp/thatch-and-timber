import {
  SETTLER_SPEED, CARRY_AMOUNT, RESOURCES, BUILDINGS, ITEMS, MAX_BUILDERS_PER_SITE, FIELD_YIELD, ROAD, CART, NO_TOOL_JOBS,
} from '../config.js';
import {
  isSite, siteNeeds, siteBuildTime, siteCap, slots, outputItem, outputAmount, outputCap, recipe, hasInputs, useInputs, workSpeed,
} from './buildings.js';

const NAMES = [
  'Anton', 'Berta', 'Carl', 'Dora', 'Emil', 'Frieda', 'Gustav', 'Hanna', 'Ida', 'Jakob',
  'Karl', 'Lene', 'Max', 'Nora', 'Otto', 'Paula', 'Rudi', 'Selma', 'Theo', 'Ute',
  'Vinzenz', 'Wilma', 'Xaver', 'Zenzi', 'Fritz', 'Greta', 'Heinz', 'Liesel', 'Bruno', 'Erna',
];

const WORK = {
  tree: { text: 'Fällt einen Baum', sound: 'chop' },
  rock: { text: 'Schlägt Stein', sound: 'stone' },
  berry: { text: 'Pflückt Beeren', sound: 'pick' },
  fish: { text: 'Angelt', sound: 'splash' },
  ore: { text: 'Schürft Erz', sound: 'stone' },
  coal: { text: 'Fördert Kohle', sound: 'stone' },
};

const go = (x, z, adj, status) => ({ type: 'go', x, z, adj, status });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createSettler(game, x, z, data = {}) {
  return {
    id: game.nextId++,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    x, z, dir: 0,
    job: null, workplace: null, carry: null,
    steps: [], step: null, onAbort: null,
    idle: false, moving: false, working: false,
    status: 'Wartet',
    ...data,
  };
}

export function abortSettler(s) {
  const fn = s.onAbort;
  s.onAbort = null;
  fn?.();
  s.steps = [];
  s.step = null;
  s.carry = null;
  s.idle = false;
  s.moving = false;
  s.working = false;
}

export function releaseJob(s) {
  abortSettler(s);
  if (s.workplace) s.workplace.workers = s.workplace.workers.filter((w) => w !== s);
  s.job = null;
  s.workplace = null;
}

export function updateSettler(game, s, dt) {
  // Hunger bremst nur die Erntearbeiter
  if (game.hungry && s.workplace && outputItem(s.workplace)) dt *= 0.5;
  if (!s.step) {
    if (!s.steps.length) plan(game, s);
    s.step = s.steps.shift() || null;
    if (!s.step || !beginStep(game, s, s.step)) return;
  }
  const st = s.step;
  if (st.type === 'go') {
    s.moving = true;
    const g = game.grid;
    const here = g.road[g.idx(Math.floor(s.x), Math.floor(s.z))];
    const speed = s.cart ? CART.speed : SETTLER_SPEED * ROAD.speed[here];
    if (moveAlong(s, st, speed * dt, game)) {
      s.moving = false;
      s.step = null;
    }
  } else if (st.type === 'work') {
    st.t += dt;
    st.tick?.(dt);
    if (st.sound) {
      st.soundT += dt;
      if (st.soundT >= 0.9) {
        st.soundT = 0;
        game.emit('sfx', { name: st.sound, x: s.x, z: s.z });
      }
    }
    if (st.t >= st.time || st.until?.()) {
      s.working = false;
      s.step = null;
    }
  } else {
    s.step = null;
    st.fn();
  }
}

function beginStep(game, s, st) {
  if (st.status) s.status = st.status;
  if (st.type === 'go') {
    const path = game.grid.findPath(Math.floor(s.x), Math.floor(s.z), st.x, st.z, st.adj, s.cart && !st.roadEntry);
    if (!path) {
      st.fail?.();
      abortSettler(s);
      s.status = 'Kommt nicht hin';
      return false;
    }
    st.path = path;
    st.i = 0;
  } else if (st.type === 'work') {
    st.t = 0;
    st.soundT = 0.6;
    s.working = !st.rest;
    if (st.face) s.dir = Math.atan2(st.face.x + 0.5 - s.x, st.face.z + 0.5 - s.z);
  }
  return true;
}

function moveAlong(s, st, d, game) {
  while (d > 0 && st.i < st.path.length) {
    const p = st.path[st.i];
    const dx = p.x + 0.5 - s.x, dz = p.z + 0.5 - s.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) s.dir = Math.atan2(dx, dz);
    if (len <= d) {
      s.x = p.x + 0.5;
      s.z = p.z + 0.5;
      d -= len;
      st.i++;
      game.addTraffic(p.x, p.z);
    } else {
      s.x += (dx / len) * d;
      s.z += (dz / len) * d;
      d = 0;
    }
  }
  return st.i >= st.path.length;
}

function plan(game, s) {
  s.idle = false;
  if (s.cart) planCart(game, s);
  else if (s.job === 'Träger') planCarrier(game, s);
  else if (s.job === 'Bauarbeiter') planBuilder(game, s, s.workplace);
  else if (s.job) {
    const def = BUILDINGS[s.workplace.type];
    if (def.fields) planFarmer(game, s);
    else if (def.sheep) planShepherd(game, s);
    else if (!def.resource && (def.consumes || def.trade)) planProcessor(game, s);
    else planWorker(game, s);
  }
  else planFree(game, s);
}

function wander(game, s, around, status) {
  s.idle = true;
  for (let i = 0; i < 10; i++) {
    const x = around.x + Math.round(Math.random() * 6 - 3);
    const z = around.z + Math.round(Math.random() * 6 - 3);
    if (game.grid.walkable(x, z)) {
      s.steps.push(go(x, z, false, status));
      break;
    }
  }
  s.steps.push({ type: 'work', time: 2 + Math.random() * 3, rest: true, status });
}

// --- Arbeiter: ernten und an der eigenen Hütte ablegen ---

function planWorker(game, s) {
  const b = s.workplace;
  const def = BUILDINGS[b.type];
  const res = RESOURCES[def.resource];

  if (b.output + 1 > outputCap(b)) {
    s.steps.push(
      go(b.x, b.z, true, 'Ablage voll, wartet auf Träger'),
      { type: 'work', time: 3, rest: true, face: b },
    );
    return;
  }

  // Bergwerk: ohne angelieferte Nahrung keine Förderung
  if (!hasInputs(b)) {
    s.steps.push(go(b.x, b.z, true, `Wartet auf ${missing(b)}`), { type: 'work', time: 3, rest: true, face: b });
    return;
  }

  const node = game.findResource(def.resource, b);
  if (!node) {
    s.steps.push(
      go(b.x, b.z, true, 'Findet nichts in der Nähe'),
      { type: 'work', time: 5, rest: true, face: b },
    );
    return;
  }

  node.reserved = true;
  s.onAbort = () => { node.reserved = false; };
  s.steps.push(
    { ...go(node.x, node.z, true, `Geht zum ${res.name}`), fail: () => { node.blockedUntil = game.time + 30; } },
    {
      type: 'work', time: res.workTime / workSpeed(game, b), face: node,
      status: WORK[def.resource].text, sound: WORK[def.resource].sound,
    },
    {
      type: 'call',
      fn: () => {
        node.reserved = false;
        s.onAbort = null;
        if (!node.gone && node.amount > 0 && hasInputs(b)) {
          useInputs(b);
          game.harvest(node);
          s.carry = res.item;
        }
      },
    },
    go(b.x, b.z, true, `Bringt ${ITEMS[res.item]} zur Hütte`),
    {
      type: 'call',
      fn: () => {
        if (!s.carry) return;
        b.output += 1;
        s.carry = null;
        game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
      },
    },
    { type: 'work', time: 1, rest: true, face: b, status: 'Legt ab' },
  );
}

// --- Schäfer: geht zur Herde am Hof, melkt, bringt die Milch zur Hütte ---

function planShepherd(game, s) {
  const b = s.workplace;
  const def = BUILDINGS[b.type];
  if (b.output + 1 > outputCap(b)) {
    s.steps.push(go(b.x, b.z, true, 'Ablage voll, wartet auf Träger'), { type: 'work', time: 3, rest: true, face: b });
    return;
  }
  const g = game.grid;
  let spot = null;
  for (let i = 0; i < 12 && !spot; i++) {
    const x = b.x + Math.round((Math.random() * 2 - 1) * def.herdRadius);
    const z = b.z + Math.round((Math.random() * 2 - 1) * def.herdRadius);
    if (g.walkable(x, z) && g.field[g.idx(x, z)] < 0 && g.resource[g.idx(x, z)] < 0) spot = { x, z };
  }
  if (!spot) {
    s.steps.push(go(b.x, b.z, true, 'Kein Platz für die Herde'), { type: 'work', time: 5, rest: true, face: b });
    return;
  }
  s.onAbort = () => { s.milkAt = null; };
  s.steps.push(
    go(spot.x, spot.z, false, 'Geht zur Herde'),
    { type: 'call', fn: () => { s.milkAt = { x: s.x, z: s.z }; } },
    { type: 'work', time: def.milkTime / workSpeed(game, b), status: 'Melkt ein Schaf', sound: 'milk' },
    {
      type: 'call',
      fn: () => {
        s.milkAt = null;
        s.onAbort = null;
        s.carry = 'food';
      },
    },
    go(b.x, b.z, true, 'Bringt Milch zur Hütte'),
    {
      type: 'call',
      fn: () => {
        if (!s.carry) return;
        b.output += 1;
        s.carry = null;
        game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
      },
    },
    { type: 'work', time: 1, rest: true, face: b, status: 'Legt ab' },
  );
}

// --- Bauer: Felder anlegen, wachsen lassen, ernten ---

function planFarmer(game, s) {
  const b = s.workplace;
  const def = BUILDINGS[b.type];
  const fields = game.fields.filter((f) => f.farm === b);
  const full = b.output + FIELD_YIELD > outputCap(b);

  const ripe = !full && nearest(s, fields.filter((f) => f.state === 'ripe' && !f.reserved));
  if (ripe) {
    ripe.reserved = true;
    s.onAbort = () => { ripe.reserved = false; };
    s.steps.push(
      go(ripe.x, ripe.z, false, 'Geht zum reifen Feld'),
      { type: 'work', time: 3 / workSpeed(game, b), status: 'Erntet Getreide', sound: 'scythe' },
      {
        type: 'call',
        fn: () => {
          s.onAbort = null;
          if (ripe.removed) return;
          game.removeField(ripe);
          s.carry = 'grain';
        },
      },
      go(b.x, b.z, true, 'Bringt Getreide zum Hof'),
      {
        type: 'call',
        fn: () => {
          if (!s.carry) return;
          b.output += FIELD_YIELD;
          s.carry = null;
          game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
        },
      },
      { type: 'work', time: 1, rest: true, face: b, status: 'Legt ab' },
    );
    return;
  }

  if (fields.length < def.fields[b.level - 1] && game.season.sow) {
    const spot = game.findFieldSpot(b);
    if (spot) {
      const field = game.addField(spot.x, spot.z, b);
      s.onAbort = () => game.removeField(field);
      s.steps.push(
        go(spot.x, spot.z, false, 'Geht ein Feld anlegen'),
        { type: 'work', time: 2.5 / workSpeed(game, b), status: 'Sät Getreide', sound: 'pick' },
        { type: 'call', fn: () => { s.onAbort = null; game.sowField(field); } },
      );
      return;
    }
  }

  const status = full ? 'Ablage voll, wartet auf Träger'
    : !game.season.sow ? 'Winterpause, im Frühling wird wieder gesät'
      : fields.length ? 'Wartet, bis das Getreide reif ist' : 'Findet keinen Platz für Felder';
  s.steps.push(go(b.x, b.z, true, status), { type: 'work', time: 3, rest: true, face: b });
}

// --- Müller und Bäcker: verarbeiten, was die Träger anliefern ---

const PROCESS = {
  mill: { text: 'Mahlt Getreide', sound: 'grind' },
  bakery: { text: 'Backt Brot', sound: 'bake' },
  sawmill: { text: 'Sägt Bretter', sound: 'saw' },
  toolmaker: { text: 'Schmiedet Werkzeug', sound: 'hammer' },
  smelter: { text: 'Schmilzt Eisen', sound: 'hammer' },
  market: { text: 'Handelt', sound: 'drop' },
};

const missing = (b) => Object.entries(recipe(b)).filter(([k, n]) => (b.inputs[k] || 0) < n).map(([k]) => ITEMS[k]).join(' und ');
// Liegt alles für einen Arbeitsgang bereit oder im Lager?
const inputsReachable = (game, b) => (!BUILDINGS[b.type].trade || b.trade)
  && Object.keys(recipe(b)).every((k) => (b.inputs[k] || 0) > 0 || game.total(k) > 0);

// Sägewerk und Werkzeugmacher pausieren, wenn genug auf Lager liegt
const stockFull = (game, b) => {
  const limit = BUILDINGS[b.type].stockLimit;
  return limit && game.total(outputItem(b)) + b.output >= limit;
};

function planProcessor(game, s) {
  const b = s.workplace;
  const def = BUILDINGS[b.type];
  const item = outputItem(b);
  if (!item) {
    s.steps.push(go(b.x, b.z, true, 'Wartet: am Markt ist noch kein Tausch eingestellt'), { type: 'work', time: 5, rest: true, face: b });
    return;
  }
  if (stockFull(game, b) && !hasInputs(b)) {
    s.steps.push(go(b.x, b.z, true, `Genug ${ITEMS[item]} auf Lager, wartet`), { type: 'work', time: 5, rest: true, face: b });
    return;
  }
  if (!hasInputs(b) || b.output + outputAmount(b) > outputCap(b)) {
    const status = !hasInputs(b) ? `Wartet auf ${missing(b)}` : 'Ablage voll, wartet auf Träger';
    s.steps.push(go(b.x, b.z, true, status), { type: 'work', time: 3, rest: true, face: b });
    return;
  }
  s.steps.push(
    go(b.x, b.z, true, 'Geht an die Arbeit'),
    { type: 'work', time: def.workTime / workSpeed(game, b), face: b, status: PROCESS[b.type].text, sound: PROCESS[b.type].sound },
    {
      type: 'call',
      fn: () => {
        if (b.removed || !hasInputs(b) || outputItem(b) !== item) return;
        useInputs(b);
        b.output += outputAmount(b);
      },
    },
  );
}

// --- Träger: Hütte -> Lager, Lager -> Baustelle, Lager -> Mühle/Bäckerei ---

function planCarrier(game, s) {
  const reach = (b) => !game.cartWillServe(b);
  if (!planTransport(game, s, CARRY_AMOUNT, reach, () => true)) wander(game, s, s.workplace, 'Wartet auf Aufträge');
}

// Pferdekarren: viel Ladung, aber nur zwischen Gebäuden mit Straßenanschluss
function planCart(game, s) {
  const g = game.grid;
  const start = { x: Math.floor(s.x), z: Math.floor(s.z) };
  if (g.road[g.idx(start.x, start.z)] !== 2) {
    const home = s.workplace;
    let entry = null;
    for (let dz = -1; dz <= 1 && !entry; dz++)
      for (let dx = -1; dx <= 1 && !entry; dx++)
        if ((dx || dz) && g.roadAt(home.x + dx, home.z + dz) === 2 && g.walkable(home.x + dx, home.z + dz)) entry = { x: home.x + dx, z: home.z + dz };
    if (!entry) {
      s.steps.push({ type: 'work', time: 4, rest: true, status: 'Wartet auf eine Straße am Lagerhaus' });
      return;
    }
    s.steps.push({ ...go(entry.x, entry.z, false, 'Fährt auf die Straße'), roadEntry: true });
    return;
  }
  const comp = game.compAt(s.x, s.z);
  const reach = (b) => game.accessComps(b).has(comp);
  s.waiting = false;
  if (!planTransport(game, s, CART.capacity, reach, reach)) {
    s.waiting = true;
    s.steps.push({ type: 'work', time: 1.5, rest: true, status: 'Wartet auf Aufträge' });
  }
}

// Gemeinsame Auftragswahl für Träger und Karren; gibt false zurück, wenn nichts zu tun ist.
// reach: welche Ziele (Hütten, Baustellen, Verarbeiter) in Frage kommen; reachWarehouse: welche Lager
function planTransport(game, s, cap, reach, reachWarehouse) {
  const minPickup = 1;
  const warehouses = game.warehouses.filter(reachWarehouse);
  if (!warehouses.length) return false;
  const huts = game.buildings.filter((b) => b.done && !b.removed && outputItem(b) && b.output - b.outReserved >= minPickup && reach(b));
  const fullHut = nearest(s, huts.filter((b) => b.output >= outputCap(b)));
  if (fullHut) return collect(game, s, fullHut, cap, warehouses), true;

  const task = findDelivery(game, s, cap, reach, warehouses);
  if (task) return deliver(game, s, task), true;

  const supply = findSupply(game, s, cap, reach, warehouses);
  if (supply) return deliverInput(game, s, supply), true;

  const hut = nearest(s, huts);
  if (hut) return collect(game, s, hut, cap, warehouses), true;
  return false;
}

function nearest(from, list) {
  let best = null, bd = Infinity;
  for (const b of list) {
    const d = dist(from, b);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function collect(game, s, hut, cap, warehouses) {
  const item = outputItem(hut);
  const amount = Math.min(cap, hut.output - hut.outReserved);
  const wh = nearest(hut, warehouses);
  let got = 0;
  hut.outReserved += amount;
  s.onAbort = () => { hut.outReserved -= amount; };
  s.steps.push(
    go(hut.x, hut.z, true, `Holt ${ITEMS[item]} ab`),
    { type: 'work', time: 0.6, rest: true, face: hut },
    {
      type: 'call',
      fn: () => {
        hut.outReserved -= amount;
        got = Math.min(amount, hut.output);
        hut.output -= got;
        if (!got || hut.removed) {
          s.onAbort = null;
          s.steps = [];
          return;
        }
        s.carry = item;
        s.carryAmount = got;
        s.onAbort = () => game.store(s, item, got);
      },
    },
    go(wh.x, wh.z, true, `Bringt ${ITEMS[item]} ins Lager`),
    {
      type: 'call',
      fn: () => {
        s.onAbort = null;
        s.carry = null;
        game.store(wh, item, got);
        game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
      },
    },
  );
}

function findDelivery(game, s, cap, reach, warehouses) {
  let best = null, bd = Infinity;
  for (const site of game.buildings) {
    if (!reach(site)) continue;
    for (const [item, rest] of siteNeeds(site)) {
      const wh = nearest(site, warehouses.filter((w) => w.stock[item] > 0));
      if (!wh) continue;
      const d = dist(s, wh) + dist(wh, site);
      if (d < bd) {
        bd = d;
        best = { site, item, wh, amount: Math.min(cap, rest, wh.stock[item]) };
      }
    }
  }
  return best;
}

function findSupply(game, s, cap, reach, warehouses) {
  let best = null, bd = Infinity;
  for (const b of game.buildings) {
    if (!b.done || b.removed || !reach(b) || stockFull(game, b)) continue;
    for (const [item, need] of Object.entries(recipe(b))) {
      const room = outputCap(b) * need - (b.inputs[item] || 0) - (b.inIncoming[item] || 0);
      if (room <= 0) continue;
      // Was für Baustellen zurückgelegt ist, wird nicht verarbeitet; der Markt lässt einen Rest im Lager
      const free = game.available(item) - (BUILDINGS[b.type].keep || 0);
      if (free <= 0) continue;
      const wh = nearest(b, warehouses.filter((w) => w.stock[item] > 0));
      if (!wh) continue;
      // Was am meisten fehlt, zuerst
      const d = dist(s, wh) + dist(wh, b) + (b.inputs[item] || 0) * 3;
      if (d < bd) {
        bd = d;
        best = { b, item, wh, amount: Math.min(cap, room, wh.stock[item], free) };
      }
    }
  }
  return best;
}

function deliverInput(game, s, { b, item, wh, amount }) {
  wh.stock[item] -= amount;
  b.inIncoming[item] = (b.inIncoming[item] || 0) + amount;
  s.onAbort = () => {
    b.inIncoming[item] -= amount;
    game.store(wh, item, amount);
  };
  s.steps.push(
    go(wh.x, wh.z, true, `Holt ${ITEMS[item]} aus dem Lager`),
    { type: 'work', time: 0.6, rest: true, face: wh },
    { type: 'call', fn: () => { s.carry = item; s.carryAmount = amount; } },
    go(b.x, b.z, true, `Bringt ${ITEMS[item]} zur ${BUILDINGS[b.type].name}`),
    {
      type: 'call',
      fn: () => {
        s.onAbort = null;
        s.carry = null;
        b.inIncoming[item] -= amount;
        // Abgerissen oder am Markt inzwischen anderer Tausch: zurück ins Lager
        if (b.removed || !(item in recipe(b))) game.store(b, item, amount);
        else b.inputs[item] = (b.inputs[item] || 0) + amount;
        game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
      },
    },
  );
}

function deliver(game, s, { site, item, wh, amount }) {
  const token = site.siteToken;
  const current = () => !site.removed && site.siteToken === token && isSite(site);
  wh.stock[item] -= amount;
  site.incoming[item] = (site.incoming[item] || 0) + amount;
  s.onAbort = () => {
    if (site.siteToken === token) site.incoming[item] -= amount;
    game.store(wh, item, amount);
  };
  s.steps.push(
    go(wh.x, wh.z, true, `Holt ${ITEMS[item]} für eine Baustelle`),
    { type: 'work', time: 0.6, rest: true, face: wh },
    { type: 'call', fn: () => { s.carry = item; s.carryAmount = amount; } },
    go(site.x, site.z, true, `Bringt ${ITEMS[item]} zur Baustelle`),
    {
      type: 'call',
      fn: () => {
        s.onAbort = null;
        s.carry = null;
        if (site.siteToken === token) site.incoming[item] -= amount;
        if (current()) site.delivered[item] = (site.delivered[item] || 0) + amount;
        else game.store(site, item, amount);
        game.emit('sfx', { name: 'drop', x: s.x, z: s.z });
      },
    },
  );
}

// --- Freie Siedler: Stelle annehmen, sonst bauen ---

// Neue Berufe brauchen ein Werkzeug aus dem Lager (außer Träger und Bauarbeiter)
export const needsTool = (b) => !NO_TOOL_JOBS.includes(BUILDINGS[b.type].job);

const FOOD_CHAIN = ['food', 'grain', 'flour', 'bread'];
const makesFood = (b) => FOOD_CHAIN.includes(outputItem(b));

function openWorkplace(game, s) {
  // Verarbeiter werden erst besetzt, wenn es etwas zu verarbeiten gibt
  const hasInput = (b) => inputsReachable(game, b);
  const hasTool = s?.tool || game.available('tools') > 0;
  const open = game.buildings.filter((b) => !b.removed && b.workers.length < slots(b) && hasInput(b) && (hasTool || !needsTool(b)));
  // Wird die Nahrung knapp, gehen freie Siedler zuerst in Nahrungsbetriebe
  const short = game.foodPoints() < game.settlers.length;
  return (
    open.find((b) => b.type === 'warehouse' && b.workers.length === 0) ||
    open.find((b) => b.type === 'builderhut' && b.workers.length === 0) ||
    (short && open.find((b) => makesFood(b))) ||
    open.find((b) => b.type !== 'warehouse' && b.type !== 'builderhut') ||
    open[0]
  );
}

// Hunger und niemand frei: ein Arbeiter aus einem anderen Betrieb wechselt in einen leeren Nahrungsbetrieb
export function rebalanceJobs(game) {
  if (!game.hungry || game.freeCount > 0) return;
  const hasInput = (b) => inputsReachable(game, b);
  const target = game.buildings.find((b) => b.done && !b.removed && makesFood(b) && b.workers.length < slots(b) && hasInput(b));
  if (!target) return;
  const donors = game.buildings.filter((b) => b.done && !b.removed && b.workers.length && outputItem(b) && !makesFood(b));
  if (!donors.length) return;
  donors.sort((a, b) => b.workers.length - a.workers.length);
  const w = donors[0].workers[donors[0].workers.length - 1];
  releaseJob(w);
  w.tool = true;
  game.emit('toast', `${w.name} hilft jetzt bei der Nahrung (${BUILDINGS[target.type].name})`);
}

export function hasOpenWorkplace(game) {
  return !!openWorkplace(game);
}

function planFree(game, s) {
  if (game.freeCount > game.jobReserve) {
    const b = openWorkplace(game, s);
    if (b) {
      if (needsTool(b) && !s.tool) {
        game.takeItem('tools');
        s.tool = true;
      }
      s.job = BUILDINGS[b.type].job;
      s.workplace = b;
      b.workers.push(s);
      s.steps.push(go(b.x, b.z, true, 'Zieht zum Arbeitsplatz'));
      return;
    }
  }
  // Ohne Bauhütte bauen freie Siedler, damit nichts stehen bleibt
  if (!game.hasBuilders) return planBuilder(game, s, game.nearestWarehouse(s));
  wander(game, s, game.nearestWarehouse(s), 'Hat nichts zu tun');
}

function paveRoad(game, s, plan) {
  plan.builder = s;
  s.onAbort = () => { plan.builder = null; };
  s.steps.push(
    { ...go(plan.x, plan.z, false, 'Geht eine Straße pflastern'), fail: () => { plan.blockedUntil = game.time + 20; } },
    { type: 'work', time: ROAD.buildTime * (game.grid.resource[game.grid.idx(plan.x, plan.z)] >= 0 ? 2 : 1), status: 'Pflastert eine Straße', sound: 'stone' },
    {
      type: 'call',
      fn: () => {
        s.onAbort = null;
        plan.builder = null;
        if (game.roadPlans.includes(plan)) game.paveRoad(plan);
      },
    },
  );
}

// --- Bauarbeiter: bauen, soweit Material geliefert ist; mehrere pro Baustelle ---

export const canBuildOn = (b) => isSite(b) && b.builders.length < MAX_BUILDERS_PER_SITE && b.progress < siteCap(b) - 1e-6;

function planBuilder(game, s, home) {
  const sites = game.buildings.filter(canBuildOn)
    .sort((a, b) => a.builders.length - b.builders.length || dist(s, a) - dist(s, b));
  const b = sites[0];
  if (!b) {
    const plan = nearest(s, game.roadPlans.filter((p) => !p.builder && !(p.blockedUntil > game.time)));
    if (plan) return paveRoad(game, s, plan);
    return wander(game, s, home, s.job ? 'Wartet auf Bauaufträge' : 'Hat nichts zu tun');
  }

  const time = siteBuildTime(b);
  const token = b.siteToken;
  const leave = () => { b.builders = b.builders.filter((x) => x !== s); };
  b.builders.push(s);
  s.onAbort = leave;
  s.steps.push(
    go(b.x, b.z, true, b.done ? 'Geht zum Ausbau' : 'Geht zur Baustelle'),
    {
      type: 'work',
      time: Infinity,
      face: b,
      status: b.done ? 'Baut aus' : 'Baut',
      sound: 'hammer',
      tick: (dt) => { if (b.siteToken === token) b.progress = Math.min(siteCap(b), b.progress + dt / time); },
      until: () => b.removed || b.siteToken !== token || b.progress >= siteCap(b) - 1e-6,
    },
    {
      type: 'call',
      fn: () => {
        leave();
        s.onAbort = null;
        if (!b.removed && b.siteToken === token && b.progress >= 1 - 1e-6) game.completeSite(b);
      },
    },
  );
}
