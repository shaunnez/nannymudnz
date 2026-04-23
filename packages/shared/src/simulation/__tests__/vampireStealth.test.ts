import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import { addStatusEffect } from '../combat';
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

describe('vampire stealth', () => {
  it('enemy AI does not target a stealthed player', () => {
    let state = createInitialState('vampire', 1);
    const enemy = state.enemies[0];
    if (!enemy) return;
    enemy.x = state.player.x + 100;

    addStatusEffect(state, state.player, 'stealth', 1, 5000, 'test');
    state = tickSimulation(state, emptyInput(), 16);

    expect(enemy.state).not.toBe('attacking');
  });

  it('first attack from stealth breaks stealth', () => {
    let state = createInitialState('vampire', 1);
    state.player.mp = state.player.mpMax;
    addStatusEffect(state, state.player, 'stealth', 1, 5000, 'test');

    const hadStealth = state.player.statusEffects.some(e => e.type === 'stealth');
    expect(hadStealth).toBe(true);

    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 1 }, 16);

    const stillStealthed = state.player.statusEffects.some(e => e.type === 'stealth');
    expect(stillStealthed).toBe(false);
  });
});
