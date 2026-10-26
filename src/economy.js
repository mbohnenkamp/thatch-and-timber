import { FOOD_INTERVAL, GROWTH_INTERVAL, GROWTH_FOOD_MIN, GROWTH_FOOD_COST, GROWTH_RESERVE } from './config.js';

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

// Gegessen wird nur, was im Lager liegt
export function updateEconomy(game, dt) {
  if (game.foodPoints() > 0) setHungry(game, false);

  game.hunger += (dt * game.settlers.length * game.season.hunger) / FOOD_INTERVAL;
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
