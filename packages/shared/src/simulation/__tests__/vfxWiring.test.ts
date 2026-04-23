import { describe, it, expect } from 'vitest';
import { tickSimulation } from '../simulation';
import { createVsState } from '../vsSimulation';
import type { InputState } from '../types';

function idleInput(): InputState {
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

describe('projectile hit_spark carries guildId and assetKey', () => {
  it('frostbolt hit_spark has guildId=mage and assetKey=frostbolt_impact', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);

    // Advance past intro phase (1500ms) so handlePlayerInput is active
    for (let i = 0; i < 120; i++) state = tickSimulation(state, idleInput(), 16);

    state.player.mp = state.player.mpMax;

    // frostbolt is mage ability index 1 → slot 2
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 2 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles[0].guildId).toBe('mage');

    // Tick until the projectile hits (≤400u range, speed 450/s ≈ 56 ticks @ 16ms)
    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'mage' && e.assetKey === 'frostbolt_impact',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No enriched hit_spark found after 60 ticks');
  });
});
