import { describe, it, expect } from 'vitest';
import { createEnemyActor, createInitialState, tickBossPhases } from '../simulation';
import { ENEMY_DEFS } from '../enemyData';

describe('boss phase transitions', () => {
  it('increments bossPhase when HP drops below threshold', () => {
    const state = createInitialState('knight');
    const boss = createEnemyActor('warlord', 500, 200, state);
    const def = ENEMY_DEFS['warlord']!;
    boss.hp = Math.floor(boss.hpMax * 0.69); // below 0.7 threshold

    tickBossPhases(state, boss, def);

    expect(boss.bossPhase).toBe(1);
    expect(boss.attackSpeedMult).toBeCloseTo(1.2);
  });

  it('does not re-trigger a phase already passed', () => {
    const state = createInitialState('knight');
    const boss = createEnemyActor('warlord', 500, 200, state);
    const def = ENEMY_DEFS['warlord']!;
    boss.bossPhase = 1;
    boss.hp = Math.floor(boss.hpMax * 0.69);

    tickBossPhases(state, boss, def);

    expect(boss.bossPhase).toBe(1); // unchanged
  });

  it('does nothing for an enemy without phases', () => {
    const state = createInitialState('knight');
    const enemy = createEnemyActor('plains_bandit', 500, 200, state);
    const def = ENEMY_DEFS['plains_bandit']!;
    enemy.hp = 1;

    tickBossPhases(state, enemy, def);

    expect(enemy.bossPhase).toBe(0);
  });
});
