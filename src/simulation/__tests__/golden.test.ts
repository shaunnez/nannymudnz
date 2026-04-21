import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, SimState } from '../types';

function emptyInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false, jumpJustPressed: false,
    attackJustPressed: false, blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
  };
}

function stripFunctions(state: SimState): Omit<SimState, 'rng'> {
  const rest: Partial<SimState> = { ...state };
  delete rest.rng;
  return rest as Omit<SimState, 'rng'>;
}

function scriptedRun(frames: number, seed: number): Omit<SimState, 'rng'> {
  let state = createInitialState('knight', seed);
  for (let i = 0; i < frames; i++) {
    const input = emptyInput();
    // Every 30 frames, press right; every 60, attack.
    if (i % 30 === 0) { input.right = true; input.rightJustPressed = true; }
    if (i % 60 === 0) { input.attack = true; input.attackJustPressed = true; }
    state = tickSimulation(state, input, 16);
  }
  return stripFunctions(state);
}

describe('golden-state reproducibility', () => {
  it('produces identical SimState for the same seed + same inputs', () => {
    const a = scriptedRun(600, 987654321);
    const b = scriptedRun(600, 987654321);
    expect(a).toEqual(b);
  });

  it('produces different SimState for different seeds', () => {
    const a = scriptedRun(600, 1);
    const b = scriptedRun(600, 2);
    expect(a).not.toEqual(b);
  });
});
