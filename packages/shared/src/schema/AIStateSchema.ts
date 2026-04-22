import { Schema, type } from '@colyseus/schema';
import type { AIBehavior } from '../simulation/types';

export class AIStateSchema extends Schema {
  @type('string') behavior!: AIBehavior;
  @type('string') targetId!: string | null;
  @type('number') lastActionMs!: number;
  @type('boolean') retreating!: boolean;
  @type('string') packRole!: 'leader' | 'circler' | null;
  @type('number') phase!: number;
  @type('number') patrolDir!: 1 | -1;
  @type('number') leapCooldown!: number;
  @type('boolean') windupActive!: boolean;
  @type('number') windupTimeMs!: number;
  @type('number') lungeMs!: number;
}
