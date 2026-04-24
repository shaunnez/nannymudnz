import { describe, it, expect } from 'vitest';
import { createSurvivalState } from '../simulation';
import { tickSurvivalWaves } from '../survivalWaves';

describe('tickSurvivalWaves', () => {
  it('spawns enemies when none are alive (initial empty state)', () => {
    const s = createSurvivalState('adventurer', 1);
    expect(s.enemies.length).toBe(0);
    tickSurvivalWaves(s);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.currentWave).toBe(1);
  });

  it('does not spawn when enemies are still alive', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s);
    const count = s.enemies.length;
    tickSurvivalWaves(s);
    expect(s.enemies.length).toBe(count);
    expect(s.currentWave).toBe(1);
  });

  it('advances wave and respawns when all enemies are dead', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s);
    s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
    tickSurvivalWaves(s);
    expect(s.currentWave).toBe(2);
    expect(s.enemies.some(e => e.isAlive)).toBe(true);
  });

  it('adds survivalScore when advancing wave', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s);
    const enemyCount = s.enemies.length;
    s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
    tickSurvivalWaves(s);
    expect(s.survivalScore).toBe(enemyCount * 100 * 1);
  });

  it('enemy count scales with wave number', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s);
    const w1Count = s.enemies.length;
    for (let w = 1; w < 10; w++) {
      s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
      tickSurvivalWaves(s);
    }
    expect(s.enemies.filter(e => e.isAlive).length).toBeGreaterThan(w1Count);
  });
});
