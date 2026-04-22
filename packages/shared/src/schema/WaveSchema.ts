import { Schema, type, ArraySchema } from '@colyseus/schema';
import type { ActorKind } from '../simulation/types';

export class WaveEnemySchema extends Schema {
  @type('string') kind!: ActorKind;
  @type('number') count!: number;
  @type('number') offsetX?: number;
  @type('number') offsetY?: number;
}

export class WaveSchema extends Schema {
  @type('number') triggerX!: number;
  @type({ array: WaveEnemySchema }) enemies: {
    kind: ActorKind;
    count: number;
    offsetX?: number;
    offsetY?: number;
  }[] = new ArraySchema<WaveEnemySchema>() as unknown as {
    kind: ActorKind;
    count: number;
    offsetX?: number;
    offsetY?: number;
  }[];
  @type('boolean') triggered!: boolean;
  @type('boolean') cleared!: boolean;
}
