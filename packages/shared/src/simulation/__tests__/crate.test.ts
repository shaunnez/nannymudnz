import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Crate } from '../types';

function idleInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false,
    jumpJustPressed: false, attackJustPressed: false, blockJustPressed: false,
    grabJustPressed: false, pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

function attackInput(): InputState {
  return { ...idleInput(), attack: true, attackJustPressed: true };
}

function makeCrate(x: number, y: number): Crate {
  return { id: 'crate_test', x, y, hp: 60, hpMax: 60, isAlive: true };
}

describe('crate hit detection', () => {
  it('melee attack within range damages crate', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.player.facing = 1;
    state.enemies = [];
    state.crates = [makeCrate(state.player.x + 40, state.player.y)];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].hp).toBeLessThan(60);
  });

  it('crate beyond attack range is not damaged', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.player.facing = 1;
    state.enemies = [];
    state.crates = [makeCrate(state.player.x + 200, state.player.y)];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].hp).toBe(60);
  });

  it('crate at 0 HP is marked dead and spawns pickups', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.player.facing = 1;
    state.enemies = [];
    state.crates = [{ ...makeCrate(state.player.x + 40, state.player.y), hp: 1 }];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].isAlive).toBe(false);
    expect(state.pickups.length).toBeGreaterThanOrEqual(1);
    expect(state.pickups.length).toBeLessThanOrEqual(2);
  });

  it('crate break loot roll is deterministic — same seed = same loot', () => {
    function runBreak(seed: number) {
      let state = createInitialState('adventurer', 'assembly', seed);
      state.timeMs = 1000;
      state.player.facing = 1;
      state.enemies = [];
      state.crates = [{ ...makeCrate(state.player.x + 40, state.player.y), hp: 1 }];
      state = tickSimulation(state, attackInput(), 16);
      return state.pickups.map(p => p.type);
    }
    expect(runBreak(42)).toEqual(runBreak(42));
    expect(runBreak(42)).toEqual(runBreak(42));
  });
});
