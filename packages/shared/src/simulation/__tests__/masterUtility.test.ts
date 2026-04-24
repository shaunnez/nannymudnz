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

describe('master class_swap', () => {
  it('emits a status_text VFX showing the new primed class', () => {
    let state = createInitialState('master', 1);
    state.player.primedClass = 'knight';
    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    const textEvent = state.vfxEvents.find(e => e.type === 'status_text' && e.text?.includes('mage'));
    expect(textEvent).toBeDefined();
  });
});

describe('master chosen_utility', () => {
  it('applies damage_reduction when primed as knight', () => {
    let state = createInitialState('master', 1);
    state.player.primedClass = 'knight';
    state.player.mp = state.player.mpMax;
    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 2 }, 16);
    const buffed = state.player.statusEffects.some(e => e.type === 'damage_reduction');
    expect(buffed).toBe(true);
  });

  it('applies teleport behaviour when primed as mage', () => {
    let state = createInitialState('master', 1);
    state.player.primedClass = 'mage';
    state.player.mp = state.player.mpMax;
    const startX = state.player.x;
    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 2 }, 16);
    expect(state.player.x).not.toBe(startX);
  });
});
