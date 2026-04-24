import type { SimState } from './types';
import { createEnemyActor } from './simulation';

const SPAWN_Y_MIN = 80;
const SPAWN_Y_MAX = 340;

/** Weaker enemies used in early waves */
const TIER_1 = ['plains_bandit', 'bandit_archer', 'wolf'] as const;
/** Medium enemies introduced mid-game */
const TIER_2 = ['bandit_brute', 'wolf', 'drowned_spawn', 'rotting_husk'] as const;
/** Tougher enemies for late waves (boss-tier anchored by bandit_king) */
const TIER_3 = ['bandit_brute', 'drowned_spawn', 'rotting_husk', 'bandit_king'] as const;

function tierForWave(wave: number): readonly string[] {
  if (wave <= 4) return TIER_1;
  if (wave <= 9) return TIER_2;
  return TIER_3;
}

export function spawnSurvivalWave(state: SimState): void {
  const wave = state.currentWave;
  const count = Math.min(8, 2 + Math.floor(wave * 0.6));
  const tier = tierForWave(wave);
  const isBossWave = wave > 0 && wave % 5 === 0;

  state.enemies = [];

  for (let i = 0; i < count; i++) {
    const kindIndex = Math.floor(state.rng() * tier.length);
    const kind = tier[kindIndex];
    const spawnX = state.player.x + 350 + i * 90;
    const spawnY = SPAWN_Y_MIN + state.rng() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
    const enemy = createEnemyActor(kind, spawnX, spawnY, state);

    if (isBossWave && i === 0) {
      enemy.hp = Math.round(enemy.hp * 1.5);
      enemy.hpMax = enemy.hp;
      enemy.hpDark = enemy.hp;
    }

    state.enemies.push(enemy);
  }
}

export function tickSurvivalWaves(state: SimState): void {
  const anyAlive = state.enemies.some(e => e.isAlive);
  if (anyAlive) return;

  if (state.currentWave > 0) {
    const deadCount = state.enemies.length;
    state.survivalScore += deadCount * 100 * state.currentWave;
  }

  state.currentWave += 1;
  spawnSurvivalWave(state);
}
