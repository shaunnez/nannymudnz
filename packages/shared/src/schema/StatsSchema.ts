import { Schema, type } from '@colyseus/schema';

export class StatsSchema extends Schema {
  @type('number') STR!: number;
  @type('number') DEX!: number;
  @type('number') CON!: number;
  @type('number') INT!: number;
  @type('number') WIS!: number;
  @type('number') CHA!: number;
}
