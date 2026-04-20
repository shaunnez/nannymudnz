import type { AnimationId } from '../../simulation/types';

const FALLBACK: Record<AnimationId, readonly AnimationId[]> = {
  idle:        ['idle'],
  walk:        ['walk', 'idle'],
  run:         ['run', 'walk', 'idle'],
  jump:        ['jump', 'idle'],
  fall:        ['jump', 'idle'],
  land:        ['jump', 'idle'],
  attack_1:    ['attack_1', 'idle'],
  attack_2:    ['attack_2', 'attack_1', 'idle'],
  attack_3:    ['attack_3', 'attack_2', 'attack_1', 'idle'],
  run_attack:  ['attack_1', 'idle'],
  jump_attack: ['attack_1', 'idle'],
  block:       ['block', 'idle'],
  dodge:       ['idle'],
  hurt:        ['hurt', 'idle'],
  knockdown:   ['hurt', 'idle'],
  getup:       ['hurt', 'idle'],
  death:       ['death', 'hurt', 'idle'],
  ability_1:   ['ability_1', 'attack_1', 'idle'],
  ability_2:   ['ability_2', 'attack_2', 'attack_1', 'idle'],
  ability_3:   ['ability_3', 'attack_3', 'attack_1', 'idle'],
  ability_4:   ['ability_4', 'attack_1', 'idle'],
  ability_5:   ['ability_5', 'attack_1', 'idle'],
  channel:     ['ability_5', 'idle'],
  grab:        ['ability_3', 'attack_1', 'idle'],
  throw:       ['attack_3', 'attack_1', 'idle'],
  pickup:      ['idle'],
};

export function resolveAnimation(
  requested: AnimationId,
  available: Partial<Record<AnimationId, unknown>>,
): AnimationId {
  const chain = FALLBACK[requested] ?? ['idle'];
  for (const id of chain) {
    if (available[id] !== undefined) return id;
  }
  return 'idle';
}
