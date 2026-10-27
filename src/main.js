import './style.css';
import { Game } from './game.js';
import { Renderer } from './render/scene.js';
import { Hud, showMenu } from './ui/hud.js';
import { setupInput } from './input.js';
import { saveGame, loadGame, listSaves, describeSave, deleteSave, canCreate, newSaveId, MAX_SAVES } from './save.js';
import { audio } from './audio.js';
import { Advisor } from './ui/tips.js';
import { Intro, introDone } from './ui/intro.js';
import { Minimap } from './ui/minimap.js';
import { loadAssets } from './render/assets.js';
import { renderPreview } from './render/preview.js';

const SETTINGS_KEY = 'siedler-dorf-settings';
function loadSettings() {
  const st = { graphics: 'high', dayNight: true, seasons: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* Standard */ }
  return st;
}
function saveSettings(st) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(st)); } catch { /* egal */ }
}
import { AUTOSAVE_INTERVAL, ITEMS, BUILDINGS, FEST_TIME, VERSION } from './config.js';

const SEASON_TOAST = {
  spring: 'Frühling! Die Felder werden wieder bestellt, Beeren und Bäume wachsen nach.',
  summer: 'Sommer: Das Getreide wächst am schnellsten.',
  autumn: 'Herbst: Viele Beeren, das Getreide reift langsamer. Leg Vorräte für den Winter an.',
  winter: 'Winter! Nichts wächst, die Fische werden knapp und die Siedler brauchen mehr Nahrung.',
};

const app = document.getElementById('app');

// Statt schwarzem Bild eine Meldung, die man abschreiben kann (Handys ohne Konsole)
function showFatal(text) {
  let box = document.getElementById('fatal');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal';
    document.body.appendChild(box);
  }
  box.textContent = `${text}\n\nVersion ${VERSION} · ${navigator.userAgent}`;
}
window.addEventListener('error', (e) => showFatal(`Fehler: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => showFatal(`Fehler: ${e.reason?.message ?? e.reason}`));
if (!document.createElement('canvas').getContext('webgl2')) {
  showFatal('Dein Browser stellt kein WebGL 2 bereit, ohne das kann das Spiel keine 3D-Grafik zeichnen. '
    + 'Hilft oft: Hardwarebeschleunigung einschalten, Chrome oder Firefox statt Chromium nehmen, Browser aktualisieren.');
}

// Modelle laden, während das Menü schon sichtbar ist
const status = document.createElement('div');
status.id = 'loading';
status.textContent = 'Lade Modelle … 0 %';
const assetsReady = loadAssets((p) => { status.textContent = `Lade Modelle … ${Math.round(p * 100)} %`; })
  .then(() => { status.remove(); return true; })
  .catch((err) => {
    console.error(err);
    status.textContent = 'Die 3D-Modelle konnten nicht geladen werden. Bitte Seite neu laden.';
    return false;
  });

const whenReady = (fn) => async (...args) => {
  status.textContent = status.textContent.replace('Lade', 'Gleich geht es los, lade');
  if (await assetsReady) fn(...args);
};

showMenu(app, {
  saves: { max: MAX_SAVES, list: listSaves().map((s) => ({ id: s.id, ...describeSave(s) })) },
  canCreate,
  onStart: whenReady((mapType, seed, size) => {
    const game = Game.create(mapType, seed, size);
    game.saveId = newSaveId();
    saveGame(game);
    start(game, true);
  }),
  onContinue: whenReady((id) => start(loadGame(id))),
  onDelete: deleteSave,
  preview: async (map, seed, size) => ((await assetsReady) ? renderPreview(map, seed, size) : null),
});
app.appendChild(status);

function start(game, isNew = false) {
  audio.init();
  const view = document.createElement('div');
  view.id = 'view';
  app.prepend(view);

  const settings = loadSettings();
  game.seasonsOn = settings.seasons;
  game.update(0);
  const renderer = new Renderer(view, game, settings);
  let speed = 1, lastSpeed = 1, buildType = null, selection = null, autosave = 0;

  const select = (sel) => {
    selection = sel;
    renderer.setSelection(sel);
  };
  // Straßenmodus: roadStart ist das zuletzt angetippte Feld
  let roadStart = null;
  const setBuild = (type) => {
    buildType = type;
    roadStart = null;
    renderer.setRoadPreview(null);
    renderer.setGhost(type === 'road' ? null : type);
    hud.setMode(type);
    if (type) select(null);
  };
  const setSpeed = (s) => {
    if (s > 0) lastSpeed = s;
    speed = s;
  };

  const hud = new Hud(app, {
    game: () => game,
    onBuild: (t) => { audio.play('click'); setBuild(buildType === t ? null : t); },
    onSpeed: (s) => { audio.play('click'); setSpeed(s); },
    onSave: () => hud.toast(saveGame(game) ? 'Spiel gespeichert' : 'Speichern fehlgeschlagen'),
    onMenu: () => { saveGame(game); location.reload(); },
    onAction: (act, b) => {
      audio.play('click');
      if (act === 'demolish') {
        game.demolish(b);
        select(null);
      } else if (act === 'upgrade') game.startUpgrade(b);
      else if (act === 'cancel-upgrade') game.cancelUpgrade(b);
      else if (act === 'honor' || act === 'honor-metro') hud.showHonor(game, act === 'honor' ? 'city' : 'metro');
      else if (act.startsWith('give:') || act.startsWith('get:')) {
        const [side, item] = act.split(':');
        const next = { ...(b.trade || b.pending), [side]: item };
        if (next.give && next.give === next.get) hud.toast('Abgeben und Bekommen müssen verschieden sein');
        else if (next.give && next.get) {
          b.pending = null;
          game.setTrade(b, next.give, next.get);
        } else b.pending = next;
      }
    },
    onClose: () => select(null),
    onSetting: (key) => {
      audio.play('click');
      if (key === 'sound') audio.toggleSound();
      if (key === 'music') audio.toggleMusic();
      if (key === 'tips') advisor.setOn(!advisor.on);
      if (key === 'graphics') settings.graphics = settings.graphics === 'low' ? 'high' : 'low';
      if (key === 'dayNight') settings.dayNight = !settings.dayNight;
      if (key === 'seasons') game.seasonsOn = settings.seasons = !settings.seasons;
      saveSettings(settings);
      renderer.applySettings(settings);
      return settingsState();
    },
  });
  const settingsState = () => ({ sound: audio.soundOn, music: audio.musicOn, tips: advisor.on, ...settings });

  const advisor = new Advisor(app, {
    onShow: (b) => {
      if (b.removed) return;
      renderer.rig.target.x = b.x + 0.5;
      renderer.rig.target.z = b.z + 0.5;
      select({ kind: 'building', ref: b });
    },
  });  // Einführung nur beim allerersten neuen Spiel; der Willkommens-Tipp steckt schon darin
  const intro = isNew && !introDone() ? new Intro(app, hud) : null;
  if (intro) {
    advisor.prefs.seen.controls = true;
    advisor.save();
  }

  hud.showSettings(settingsState());
  const minimap = new Minimap(app, game, renderer.rig);
  renderer.flocks.onSound = (x, z) => audio.play('baa', x, z);
  renderer.flocks.listener = renderer.rig.target;
  game.on('toast', (m) => hud.toast(m));
  game.on('goal', ({ reward, rank, rankUp, unlocked, honor }) => {
    const gift = Object.entries(reward).map(([k, v]) => `${v} ${ITEMS[k]}`).join(' und ');
    hud.toast(rankUp ? `Aufgabe erfüllt! ${game.townName} ist jetzt ein${rank.endsWith('stadt') || rank === 'Stadt' ? 'e' : ''} ${rank}. Belohnung: ${gift}` : `Aufgabe erfüllt! Belohnung: ${gift}`);
    if (unlocked.length) {
      unlocked.forEach((t) => hud.fresh.add(t));
      hud.toast(`Neu in der Bauleiste: ${unlocked.map((t) => BUILDINGS[t].name).join(', ')}`);
    }
    audio.play(rankUp ? 'complete' : 'arrive');
    if (rankUp) {
      game.startFest();
      audio.fest(FEST_TIME / Math.max(1, speed));
      hud.toast(`${game.townName} feiert!`);
    }
    if (honor) hud.showHonor(game, honor);
  });
  game.on('season', (se) => { if (game.seasonsOn) hud.toast(SEASON_TOAST[se.key]); });
  game.on('sfx', (e) => audio.play(e.name, e.x, e.z));

  const pickAt = (x, y) => {
    const e = renderer.pickEntity(x, y);
    if (e) return e;
    const t = renderer.pickTile(x, y);
    if (!t) return null;
    const g = game.grid, i = g.idx(t.x, t.z);
    if (g.building[i] >= 0) {
      const b = game.buildings.find((b) => b.id === g.building[i]);
      if (b) return { kind: 'building', ref: b };
    }
    if (g.resource[i] >= 0) return { kind: 'resource', ref: game.resources[g.resource[i]] };
    if (g.field[i] >= 0) {
      const f = game.fields.find((f) => f.id === g.field[i]);
      if (f) return { kind: 'field', ref: f };
    }
    const plan = game.roadPlans.find((p) => p.x === t.x && p.z === t.z);
    if (plan) return { kind: 'roadPlan', ref: plan };
    if (g.road[i]) return { kind: 'road', ref: { x: t.x, z: t.z } };
    return null;
  };

  setupInput(renderer.renderer.domElement, renderer.rig, {
    onHover: (x, y) => {
      if (!buildType) return;
      const t = renderer.pickTile(x, y);
      if (buildType === 'road') {
        if (!t) return renderer.setRoadPreview(null);
        if (!roadStart) return renderer.setRoadPreview([t], game.canPaveTile(t.x, t.z));
        const route = game.roadRoute(roadStart, t);
        renderer.setRoadPreview(route ? route.tiles : [t], !game.roadError(roadStart, t));
        hud.setHint(route ? `Straße: ${route.fresh.length} neue Felder, ${route.cost} Stein` : 'Hier kann keine Straße entlang');
        return;
      }
      const err = t && game.placeError(buildType, t.x, t.z);
      renderer.updateGhost(t, t && !err);
      if (BUILDINGS[buildType].span && t) hud.setHint(err || `Brücke über ${game.bridgeSpan(t.x, t.z).len} Felder Wasser — tippen zum Bauen`);
    },
    onTap: (x, y) => {
      audio.init();
      if (buildType === 'road') {
        const t = renderer.pickTile(x, y);
        if (!t) return;
        if (!roadStart) {
          if (!game.canPaveTile(t.x, t.z)) {
            hud.toast('Hier kann keine Straße beginnen');
            audio.play('error');
            return;
          }
          roadStart = t;
          audio.play('click');
          hud.setHint('Jetzt das Zielfeld antippen. Rechtsklick oder Esc beendet.');
          return;
        }
        const err = game.roadError(roadStart, t);
        if (err) {
          hud.toast(err);
          audio.play('error');
          return;
        }
        game.planRoad(roadStart, t);
        roadStart = t;
        renderer.setRoadPreview(null);
        return;
      }
      if (buildType) {
        const t = renderer.pickTile(x, y);
        if (!t) return;
        const err = game.placeError(buildType, t.x, t.z);
        if (err) {
          renderer.updateGhost(t, false);
          hud.toast(err);
          audio.play('error');
          return;
        }
        game.place(buildType, t.x, t.z);
        setBuild(null);
        return;
      }
      const sel = pickAt(x, y);
      if (sel) audio.play('click');
      select(sel);
    },
    onCancel: () => { setBuild(null); select(null); },
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { setBuild(null); select(null); }
    if (e.code === 'KeyQ') renderer.rig.rotate(-1);
    if (e.code === 'KeyE') renderer.rig.rotate(1);
    if (e.code === 'Space') {
      e.preventDefault();
      setSpeed(speed === 0 ? lastSpeed : 0);
    }
  });
  window.addEventListener('beforeunload', () => saveGame(game));

  let last = performance.now();
  function frame(now) {
    const raw = Math.min(0.1, (now - last) / 1000);
    last = now;
    let dt = raw * speed;
    while (dt > 0) {
      const step = Math.min(dt, 0.1);
      game.update(step);
      dt -= step;
    }
    autosave += raw;
    if (autosave >= AUTOSAVE_INTERVAL) {
      autosave = 0;
      saveGame(game);
    }
    if (selection?.ref.removed) select(null);
    renderer.update(raw);
    minimap.update(raw);
    const t = renderer.rig.target;
    audio.setListener(t.x, t.z, renderer.rig.az, renderer.rig.dist);
    audio.setAmbience(game.season.snow, 1 - renderer.dayNight.daylight);
    hud.update(game, buildType, selection, speed);
    if (intro?.active) intro.update(game);
    else advisor.update(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = game;
  if (import.meta.env.DEV) Object.assign(window, { __renderer: renderer, __audio: audio });
}
