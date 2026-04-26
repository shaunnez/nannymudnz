import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Crate, Projectile } from '../types';

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

  it('projectile hitting a crate damages and can break it (including different depth)', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.enemies = [];
    // Crate at different depth (y) than player — should still be hittable by projectile
    state.crates = [{ ...makeCrate(state.player.x + 40, state.player.y + 80), hp: 1 }];
    const proj: Projectile = {
      id: 'proj_test',
      ownerId: state.player.id,
      guildId: null,
      team: 'player',
      x: state.player.x,
      y: state.player.y,
      z: 0,
      vx: 200,
      vy: 0,
      vz: 0,
      damage: 20,
      damageType: 'physical',
      range: 200,
      traveled: 0,
      radius: 8,
      knockdown: false,
      knockbackForce: 0,
      effects: {},
      piercing: false,
      color: '#fff',
      type: 'basic_ranged',
      hitActorIds: [],
    };
    state.projectiles = [proj];
    // Tick enough times for the projectile to travel 40px to the crate
    for (let i = 0; i < 5; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }
    expect(state.crates[0].isAlive).toBe(false);
    expect(state.pickups.length).toBeGreaterThanOrEqual(1);
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
