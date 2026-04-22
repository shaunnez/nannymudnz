import { Schema, type } from '@colyseus/schema';
import type { DamageType, StatusEffectType } from '../simulation/types';

export class StatusEffectSchema extends Schema {
  @type('string') id!: string;
  @type('string') type!: StatusEffectType;
  @type('number') magnitude!: number;
  @type('number') durationMs!: number;
  @type('number') remainingMs!: number;
  @type('string') source!: string;
  @type('string') damageType?: DamageType;
  @type('number') tickIntervalMs?: number;
  @type('number') lastTickMs?: number;
}
