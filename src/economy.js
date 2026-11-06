import { FOOD_INTERVAL, GROWTH_INTERVAL, GROWTH_FOOD_MIN, GROWTH_FOOD_COST, GROWTH_RESERVE, WARMTH } from './config.js';

// So viel Nahrung muss im Lager liegen, damit jemand zuzieht
export const growthFood = (game) => Math.max(GROWTH_FOOD_MIN, Math.ceil(game.settlers.length * GROWTH_RESERVE));
import { housingOf } from './entities/buildings.js';

function setHungry(game, value) {
  if (game.hungry === value) return;
  game.hungry = value;
  if (value && game.time - (game.hungerToastAt ?? -Infinity) > 60) {
    game.hungerToastAt = game.time;
    game.emit('toast', 'Hunger! Die Erntearbeiter arbeiten nur noch halb so schnell.');
  }
}

// Im Winter essen alle mehr, außer sie haben warme Kleidung
export const hungerFactor = (game) => 1 + (game.season.hunger - 1) * (1 - (game.warmth || 0));

// Winter: Tuch aus dem Lager wird zu warmer Kleidung, je Siedler WARMTH.perSettler.
// Kommt im Lauf des Winters Tuch dazu, werden weitere Siedler versorgt. Im Frühling beginnt es von vorn.
export function updateWarmth(game, dt) {
  if (game.season.key !== 'winter') {
    game.warmth = 0;
    game.clothGot = 0;
    game.warmToast = false;
    return;
  }
  game.warmTimer = (game.warmTimer || 0) + dt;
  if (game.warmTimer < 5) return;
  game.warmTimer = 0;
  const need = Math.ceil(game.settlers.length * WARMTH.perSettler);
  if (!need) return;
  while (game.clothGot < need && game.available('cloth') > 0 && game.takeItem('cloth')) game.clothGot++;
  game.warmth = Math.min(1, game.clothGot / need);
  if (!game.warmToast && game.clothGot > 0) {
    game.warmToast = true;
    game.emit('toast', `Warme Kleidung aus ${game.clothGot} Tuch: ${Math.round(game.warmth * 100)} % der Siedler frieren nicht und essen nicht mehr als sonst.`);
  }
}

// Gegessen wird nur, was im Lager liegt
export function updateEconomy(game, dt) {
  if (game.foodPoints() > 0) setHungry(game, false);

  game.hunger += (dt * game.settlers.length * hungerFactor(game)) / FOOD_INTERVAL;
  while (game.hunger >= 1) {
    const paid = game.eat(1);
    if (paid) game.hunger -= paid;
    else {
      game.hunger = 0;
      setHungry(game, true);
    }
  }

  // Nahrungsvorrat jede Minute vergleichen: schrumpft er, zieht niemand zu
  game.foodCheck = (game.foodCheck || 0) + dt;
  if (game.foodCheck >= 60) {
    game.foodCheck = 0;
    const now = game.foodPoints();
    game.foodRising = now >= (game.foodLast ?? now);
    game.foodLast = now;
  }

  game.growthTimer += dt;
  if (game.growthTimer < GROWTH_INTERVAL) return;
  game.growthTimer = 0;
  if (game.settlers.length >= game.housing || game.foodPoints() < growthFood(game) || game.season.key === 'winter' || game.foodRising === false) return;

  game.eat(GROWTH_FOOD_COST);
  game.foodLast = (game.foodLast ?? 0) - GROWTH_FOOD_COST;
  const homes = game.buildings.filter((b) => housingOf(b) > 0);
  const home = homes[Math.floor(Math.random() * homes.length)];
  const s = game.spawnSettler(home);
  game.emit('toast', `${s.name} ist ins Dorf gezogen`);
  game.emit('sfx', { name: 'arrive', x: s.x, z: s.z });
}
