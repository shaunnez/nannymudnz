import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';
import type {
  ActorKind,
  ActorState,
  ActorTeam,
  AnimationId,
  GuildId,
  Pickup,
  StatusEffect,
  Stats,
  AIState,
} from '../simulation/types';
import { StatusEffectSchema } from './StatusEffectSchema';
import { StatsSchema } from './StatsSchema';
import { AIStateSchema } from './AIStateSchema';
import { PickupSchema } from './PickupSchema';

export class ActorSchema extends Schema {
  @type('string') id!: string;
  @type('string') kind!: ActorKind;
  @type('string') team!: ActorTeam;
  @type('number') x!: number;
  @type('number') y!: number;
  @type('number') z!: number;
  @type('number') vx!: number;
  @type('number') vy!: number;
  @type('number') vz!: number;
  @type('number') facing!: -1 | 1;
  @type('number') width!: number;
  @type('number') height!: number;
  @type('number') hp!: number;
  @type('number') hpMax!: number;
  @type('number') hpDark!: number;
  @type('number') mp!: number;
  @type('number') mpMax!: number;
  @type('number') armor!: number;
  @type('number') magicResist!: number;
  @type('number') moveSpeed!: number;

  @type(StatsSchema) stats: Stats = new StatsSchema();
  @type({ array: StatusEffectSchema }) statusEffects: StatusEffect[] =
    new ArraySchema<StatusEffectSchema>() as unknown as StatusEffect[];

  @type('string') animationId!: AnimationId;
  @type('number') animationFrame!: number;
  @type('number') animationTimeMs!: number;
  @type('string') state!: ActorState;
  @type('number') stateTimeMs!: number;
  @type('boolean') isPlayer!: boolean;
  @type('string') guildId!: GuildId | null;

  @type({ map: 'number' }) abilityCooldowns: Map<string, number> =
    new MapSchema<number>() as unknown as Map<string, number>;

  @type('number') rmbCooldown!: number;
  @type('number') comboHits!: number;
  @type('number') lastAttackTimeMs!: number;
  @type('number') knockdownTimeMs!: number;
  @type('number') getupTimeMs!: number;
  @type('number') invulnerableMs!: number;

  @type(PickupSchema) heldPickup: Pickup | null = null;

  @type(AIStateSchema) aiState: AIState = new AIStateSchema();

  @type('number') bossPhase!: number;
  @type('boolean') summonedByPlayer!: boolean;

  @type('number') bloodtally?: number;
  @type('number') chiOrbs?: number;
  @type('number') sanity?: number;
  @type('string') shapeshiftForm?: 'none' | 'wolf';
  @type('string') primedClass?: string;
  @type({ array: 'string' }) dishes?: string[];
  @type('boolean') miasmaActive?: boolean;
  @type('boolean') stealthed?: boolean;
  @type('string') petAiMode?: 'aggressive' | 'defensive' | 'passive';
  @type('string') fivePointPalmTarget?: string;

  @type('boolean') isAlive!: boolean;
  @type('number') deathTimeMs!: number;
  @type('number') score!: number;
}
