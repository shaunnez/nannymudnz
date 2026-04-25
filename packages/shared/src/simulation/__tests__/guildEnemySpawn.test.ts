import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState } from '../types';

function emptyInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false, jumpJustPressed: false,
    attackJustPressed: false, blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

describe('guild enemy spawning in story mode', () => {
  it('spawns guild actors from guild wave entries with isPlayer=false', () => {
    // kitchen level 3 has guild:'vampire' wave entries (wave at triggerX=900)
    let state = createInitialState('knight', 'kitchen', 12345);
    // Move player past second wave triggerX (900) - first wave at 400 must be cleared first
    // Trigger first wave at 400
    state.player.x = 450;
    state = tickSimulation(state, emptyInput(), 16);
    // Clear first wave by killing all enemies
    state.enemies.forEach(e => { e.isAlive = false; e.hp = 0; });
    state = tickSimulation(state, emptyInput(), 16);
    // Trigger second wave at 900
    state.player.x = 950;
    state = tickSimulation(state, emptyInput(), 16);

    const guildEnemies = state.enemies.filter(e => e.guildId !== null);
    expect(guildEnemies.length).toBeGreaterThan(0);
    guildEnemies.forEach(e => {
      expect(e.isPlayer).toBe(false);
      expect(e.team).toBe('enemy');
    });
  });

  it('applies level stat multiplier to spawned enemies', () => {
    // kitchen is level 3, hpMult = 1 + 2 * 0.15 = 1.3
    let state = createInitialState('knight', 'kitchen', 99999);
    state.player.x = 450;
    state = tickSimulation(state, emptyInput(), 16);

    const brutes = state.enemies.filter(e => e.kind === 'bandit_brute');
    brutes.forEach(b => {
      // base bandit_brute HP should be scaled by 1.3
      expect(b.hpMax).toBeGreaterThan(256);
    });
  });
});
