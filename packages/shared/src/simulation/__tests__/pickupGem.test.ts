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
  return { id: 'gem_1', type, x, y, z: 0, hitsLeft: 999, heldBy: null };
}

describe('gem passive buff', () => {
  it('picking up ruby adds damage_boost status effect with source gem', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('ruby', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effect = state.player.statusEffects.find(e => e.type === 'damage_boost' && e.source === 'gem');
    expect(effect).toBeDefined();
    expect(effect?.magnitude).toBeCloseTo(0.2);
    expect(state.player.heldPickup?.type).toBe('ruby');
  });

  it('picking up sapphire adds speed_boost', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('sapphire', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effect = state.player.statusEffects.find(e => e.type === 'speed_boost' && e.source === 'gem');
    expect(effect).toBeDefined();
  });

  it('swapping gems removes old bonus and applies new one', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [{ id: 'gem_ruby', type: 'ruby', x: state.player.x, y: state.player.y, z: 0, hitsLeft: 999, heldBy: null }];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.statusEffects.some(e => e.type === 'damage_boost' && e.source === 'gem')).toBe(true);

    // Drop ruby (press grab again — non-throwable drops to ground)
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.statusEffects.some(e => e.source === 'gem')).toBe(false);

    // Pick up sapphire
    state.pickups = [makePickup('sapphire', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effects = state.player.statusEffects.filter(e => e.source === 'gem');
    expect(effects).toHaveLength(1);
    expect(effects[0].type).toBe('speed_boost');
  });
});
