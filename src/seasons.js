import { SEASONS, SEASON_LENGTH } from './config.js';

const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// Jahreszeit zur Spielzeit. y läuft 0..4: Frühling, Sommer, Herbst, Winter.
// Ohne Jahreszeiten bleibt es dauerhaft Sommer.
export function seasonAt(time, enabled = true) {
  const y = enabled ? (time / SEASON_LENGTH) % 4 : 1.5;
  const index = Math.floor(y);
  return {
    index,
    ...SEASONS[index],
    progress: y - index,
    year: enabled ? Math.floor(time / SEASON_LENGTH / 4) + 1 : 1,
    // Fließende Übergänge für die Darstellung
    autumn: smooth(2.0, 2.35, y) * (1 - smooth(3.0, 3.3, y)),
    snow: smooth(3.0, 3.3, y) * (1 - smooth(3.85, 4.0, y)),
  };
}
