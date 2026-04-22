import { Schema, type, ArraySchema } from '@colyseus/schema';
import type {
  ActorTeam,
  DamageType,
  StatusEffectType,
} from '../simulation/types';

export class ProjectileSchema extends Schema {
  @type('string') id!: string;
  @type('string') ownerId!: string;
  @type('string') team!: ActorTeam;
  @type('number') x!: number;
  @type('number') y!: number;
  @type('number') z!: number;
  @type('number') vx!: number;
  @type('number') vy!: number;
  @type('number') vz!: number;
  @type('number') damage!: number;
  @type('string') damageType!: DamageType;
  @type('number') range!: number;
  @type('number') traveled!: number;
  @type('number') radius!: number;
  @type('boolean') knockdown!: boolean;
  @type('number') knockbackForce!: number;

  // Untracked: Partial<Record<K, {...}>> doesn't map cleanly to a MapSchema of
  // primitives and is only read by the simulation core when applying hits;
  // it's fine to keep it as a plain object and not sync it.
  effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>> = {};

  @type('boolean') piercing!: boolean;
  @type('string') color!: string;
  @type('string') type!: string;
  @type({ array: 'string' }) hitActorIds: string[] = new ArraySchema<string>();
}
