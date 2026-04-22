import { Schema, type } from '@colyseus/schema';

export class PickupSchema extends Schema {
  @type('string') id!: string;
  @type('string') type!: 'rock' | 'club';
  @type('number') x!: number;
  @type('number') y!: number;
  @type('number') z!: number;
  @type('number') hitsLeft!: number;
  @type('string') heldBy!: string | null;
}
