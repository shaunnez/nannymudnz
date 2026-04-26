import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Pickup } from '../types';

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

function grabInput(): InputState {
  return { ...idleInput(), grab: true, grabJustPressed: true };
}

function makePickup(type: Pickup['type'], x: number, y: number): Pickup {
  return { id: 'test_pickup_1', type, x, y, z: 0, hitsLeft: 999, heldBy: null };
}

describe('consumable auto-use', () => {
  it('health_potion heals instantHeal and is removed from state.pickups', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.hp = 100;
    state.player.hpMax = 500;
    // place potion at player position (within grab range)
    state.pickups = [makePickup('health_potion', state.player.x, state.player.y)];

    state = tickSimulation(state, grabInput(), 16);

    expect(state.player.hp).toBe(250); // 100 + 150
    expect(state.pickups).toHaveLength(0);
    expect(state.player.heldPickup).toBeNull();
  });

  it('health_potion caps at hpMax', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.hp = state.player.hpMax - 10;
    state.pickups = [makePickup('health_potion', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.hp).toBe(state.player.hpMax);
  });

  it('chi_flask restores instantResourceRestore to mp', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.mp = 0;
    state.player.mpMax = 100;
    state.pickups = [makePickup('chi_flask', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.mp).toBe(60);
    expect(state.player.heldPickup).toBeNull();
  });

  it('antidote removes dot, slow, stun but leaves speed_boost intact', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    // manually add effects
    state.player.statusEffects = [
      { id: 'e1', type: 'dot', magnitude: 5, durationMs: 5000, remainingMs: 5000, source: 'enemy1' },
      { id: 'e2', type: 'slow', magnitude: 0.5, durationMs: 3000, remainingMs: 3000, source: 'enemy1' },
      { id: 'e3', type: 'speed_boost', magnitude: 0.2, durationMs: 5000, remainingMs: 5000, source: 'ability' },
    ];
    state.pickups = [makePickup('antidote', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const types = state.player.statusEffects.map(e => e.type);
    expect(types).not.toContain('dot');
    expect(types).not.toContain('slow');
    expect(types).toContain('speed_boost');
  });

  it('rage_tonic applies damage_boost and speed_boost', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('rage_tonic', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const types = state.player.statusEffects.map(e => e.type);
    expect(types).toContain('damage_boost');
    expect(types).toContain('speed_boost');
    expect(state.player.heldPickup).toBeNull();
  });
});
