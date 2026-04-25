import { describe, it, expect } from 'vitest';
import { createMpBattleState } from '../battleSimulation';
import { tickSimulation, makeEmptyInputState } from '../simulation';
import type { BattleSlot } from '../types';

const TWO_HUMAN_SLOTS: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: 'A' },
  { guildId: 'knight',     type: 'human', team: 'B' },
];

const HUMAN_PLUS_CPU: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: 'A' },
  { guildId: 'knight',     type: 'cpu',   team: 'B' },
];

describe('createMpBattleState', () => {
  it('returns state + actorIdBySlotIndex with entry per active slot', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    expect(Object.keys(actorIdBySlotIndex)).toHaveLength(2);
    expect(state.player.guildId).toBe('adventurer');
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].guildId).toBe('knight');
  });

  it('slot 0 actor id is "player"', () => {
    const { actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    expect(actorIdBySlotIndex[0]).toBe('player');
  });

  it('cpu slot actor has aiState behavior chaser', () => {
    const { state } = createMpBattleState(HUMAN_PLUS_CPU, 'assembly', 1);
    expect(state.enemies[0].aiState.behavior).toBe('chaser');
  });

  it('human slot actors have no aiState chaser behavior', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    const slot1ActorId = actorIdBySlotIndex[1];
    const slot1Actor = state.enemies.find(e => e.id === slot1ActorId)!;
    expect(slot1Actor.aiState.behavior).toBe('none');
  });
});

describe('tickSimulation extraInputs', () => {
  it('routes extraInputs to the correct actor without crashing', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    const extraInputs = { [actorIdBySlotIndex[1]]: { ...makeEmptyInputState(), right: true } };
    expect(() => tickSimulation(state, makeEmptyInputState(), 16, undefined, extraInputs)).not.toThrow();
  });
});
