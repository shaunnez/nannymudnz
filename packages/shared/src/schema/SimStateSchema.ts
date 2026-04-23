import { Schema, type, ArraySchema } from '@colyseus/schema';
import type {
  Actor,
  LogEntry,
  Pickup,
  PlayerController,
  Projectile,
  RoundState,
  SimMode,
  Wave,
} from '../simulation/types';
import { ActorSchema } from './ActorSchema';
import { PickupSchema } from './PickupSchema';
import { ProjectileSchema } from './ProjectileSchema';
import { LogEntrySchema } from './LogEntrySchema';
import { RoundStateSchema } from './RoundStateSchema';
import { WaveSchema } from './WaveSchema';

export class SimStateSchema extends Schema {
  @type('number') tick!: number;
  @type('number') timeMs!: number;

  @type(ActorSchema) player: Actor = new ActorSchema();
  @type({ array: ActorSchema }) enemies: Actor[] =
    new ArraySchema<ActorSchema>() as unknown as Actor[];
  @type({ array: ActorSchema }) allies: Actor[] =
    new ArraySchema<ActorSchema>() as unknown as Actor[];
  @type({ array: PickupSchema }) pickups: Pickup[] =
    new ArraySchema<PickupSchema>() as unknown as Pickup[];
  @type({ array: ProjectileSchema }) projectiles: Projectile[] =
    new ArraySchema<ProjectileSchema>() as unknown as Projectile[];
  @type({ array: WaveSchema }) waves: Wave[] =
    new ArraySchema<WaveSchema>() as unknown as Wave[];

  @type('number') currentWave!: number;
  @type('number') cameraX!: number;
  @type('boolean') cameraLocked!: boolean;
  @type('string') phase!: 'playing' | 'victory' | 'defeat' | 'paused';
  @type('boolean') bossSpawned!: boolean;
  @type('number') score!: number;
  @type('number') rngSeed!: number;

  // Untracked: function-typed; never synced. The server owns rng; clients
  // never call this and will receive pre-rolled values via synced state.
  rng: () => number = () => 0;

  @type('number') nextActorId!: number;
  @type('number') nextProjectileId!: number;
  @type('number') nextPickupId!: number;
  @type('number') nextEffectId!: number;
  @type('number') bloodtallyDecayMs!: number;
  @type('string') mode!: SimMode;

  @type(ActorSchema) opponent: Actor | null = null;
  @type(RoundStateSchema) round: RoundState | null = null;

  @type({ array: LogEntrySchema }) combatLog: LogEntry[] =
    new ArraySchema<LogEntrySchema>() as unknown as LogEntry[];
  @type('number') nextLogId!: number;

  // Untracked: per-player server-side input / combo buffers. The server uses
  // these authoritatively; clients only ever see their own local input state
  // (PhaserInputAdapter), so nothing needs to be synced.
  controllers: Record<string, PlayerController> = {};
}
