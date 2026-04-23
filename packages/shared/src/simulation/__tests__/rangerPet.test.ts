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

describe('ranger pet_command', () => {
  it('spawns a wolf into allies on first use when no pet exists', () => {
    let state = createInitialState('hunter', 1);
    const startAllies = state.allies.length;
    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    expect(state.allies.length).toBe(startAllies + 1);
    const wolf = state.allies.find(a => a.summonedBy === state.player.id);
    expect(wolf).toBeDefined();
    expect(wolf!.petAiMode).toBe('aggressive');
  });

  it('cycles pet AI mode on repeat uses', () => {
    let state = createInitialState('hunter', 1);
    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    const wolfId = state.allies.find(a => a.summonedBy === state.player.id)!.id;

    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    const pet1 = state.allies.find(a => a.id === wolfId)!;
    expect(pet1.petAiMode).toBe('defensive');

    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    const pet2 = state.allies.find(a => a.id === wolfId)!;
    expect(pet2.petAiMode).toBe('passive');

    state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
    const pet3 = state.allies.find(a => a.id === wolfId)!;
    expect(pet3.petAiMode).toBe('aggressive');
  });
});
