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

describe('tickGroundZones', () => {
  it('expires zones when remainingMs reaches 0', () => {
    let state = createInitialState('knight', 1);
    state.groundZones.push({
      id: 'gz_test',
      x: state.player.x,
      y: state.player.y,
      radius: 999,
      remainingMs: 32,   // 2 ticks of 16ms
      ownerTeam: 'enemy',
      effects: {},
      damagePerTick: 0,
      damageType: 'physical',
      vfxColor: '#fff',
      vfxStyle: 'dome',
      nextPulseMsDown: 1000,
    });
    state = tickSimulation(state, emptyInput(), 16);
    expect(state.groundZones).toHaveLength(1);
    state = tickSimulation(state, emptyInput(), 16);
    expect(state.groundZones).toHaveLength(0);
  });

  it('applies status effects to actors inside the zone each tick', () => {
    let state = createInitialState('knight', 1);
    state.groundZones.push({
      id: 'gz_silence',
      x: state.player.x,
      y: state.player.y,
      radius: 999,
      remainingMs: 5000,
      ownerTeam: 'enemy',
      effects: { silence: { magnitude: 1, durationMs: 1000 } },
      damagePerTick: 0,
      damageType: 'physical',
      vfxColor: '#fff',
      vfxStyle: 'dome',
      nextPulseMsDown: 1000,
    });
    state = tickSimulation(state, emptyInput(), 16);
    const silenced = state.player.statusEffects.some(e => e.type === 'silence');
    expect(silenced).toBe(true);
  });

  it('does not apply effects to actors on ownerTeam', () => {
    let state = createInitialState('knight', 1);
    state.groundZones.push({
      id: 'gz_friendly',
      x: state.player.x,
      y: state.player.y,
      radius: 999,
      remainingMs: 5000,
      ownerTeam: 'player',   // same team as player
      effects: { silence: { magnitude: 1, durationMs: 1000 } },
      damagePerTick: 0,
      damageType: 'physical',
      vfxColor: '#fff',
      vfxStyle: 'dome',
      nextPulseMsDown: 1000,
    });
    state = tickSimulation(state, emptyInput(), 16);
    const silenced = state.player.statusEffects.some(e => e.type === 'silence');
    expect(silenced).toBe(false);
  });
});
