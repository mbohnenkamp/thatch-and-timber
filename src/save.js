import { Game } from './game.js';
import { MAPS, MAP_SIZES } from './config.js';
import { rankOf } from './goals.js';

// Mehrere Spielstände: eine Liste mit Kurzinfos, die Daten je Spiel unter eigenem Schlüssel
const LIST_KEY = 'siedler-dorf-saves';
const DATA_KEY = (id) => `siedler-dorf-save-${id}`;
const OLD_KEY = 'siedler-dorf-save-v1';
export const MAX_SAVES = 6;

function readList() {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY)) || [];
    // Alter Einzelspielstand wird einmalig übernommen
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const d = JSON.parse(old);
      const id = Math.max(0, ...list.map((s) => s.id)) + 1;
      localStorage.setItem(DATA_KEY(id), old);
      list.push({ id, map: d.mapType, size: d.size || 64, year: 1, settlers: d.settlers?.length || 0, rank: '', savedAt: Date.now() });
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
      localStorage.removeItem(OLD_KEY);
    }
    return list;
  } catch {
    return [];
  }
}

export function listSaves() {
  return readList().sort((a, b) => b.savedAt - a.savedAt);
}

export const canCreate = () => readList().length < MAX_SAVES;
export const newSaveId = () => Math.max(0, ...readList().map((s) => s.id)) + 1;

export function saveGame(game) {
  if (!game.saveId) return false;
  try {
    localStorage.setItem(DATA_KEY(game.saveId), JSON.stringify(game.serialize()));
    const list = readList().filter((s) => s.id !== game.saveId);
    list.push({
      id: game.saveId, map: game.mapType, size: game.size, year: game.season.year,
      settlers: game.settlers.length, rank: rankOf(game), savedAt: Date.now(),
    });
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(id) {
  const g = Game.deserialize(JSON.parse(localStorage.getItem(DATA_KEY(id))));
  g.saveId = id;
  return g;
}

export function deleteSave(id) {
  try {
    localStorage.removeItem(DATA_KEY(id));
    localStorage.setItem(LIST_KEY, JSON.stringify(readList().filter((s) => s.id !== id)));
  } catch { /* egal */ }
}

export function describeSave(s) {
  const size = Object.values(MAP_SIZES).find((m) => m.size === s.size)?.name || '';
  const when = new Date(s.savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return {
    title: `${MAPS[s.map]?.name || s.map}${size ? ` · ${size}` : ''}`,
    detail: [s.rank, `Jahr ${s.year}`, `${s.settlers} Siedler`].filter(Boolean).join(' · '),
    when: `gespeichert ${when}`,
  };
}
