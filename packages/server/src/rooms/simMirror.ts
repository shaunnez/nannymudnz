/**
 * Mirror between a plain (non-schema) SimState produced by the simulation
 * package and a Colyseus-tracked SimStateSchema. The simulation mutates plain
 * JS objects in place (push to arrays, assign to fields, etc.), which the
 * runtime type-enforcing schema setters in @colyseus/schema@4.x reject.
 *
 * Strategy: the authoritative sim lives as a plain object on the server.
 * After each tick we shallow-mirror the parts of it that clients need to
 * render into the schema, which Colyseus then diff-encodes onto the wire.
 */

import { ArraySchema, MapSchema } from '@colyseus/schema';
import type {
  Actor,
  AIState,
  LogEntry,
  Pickup,
  Projectile,
  RoundState,
  SimState,
  Stats,
  StatusEffect,
} from '@nannymud/shared/simulation/types';
import {
  ActorSchema,
  AIStateSchema,
  LogEntrySchema,
  PickupSchema,
  ProjectileSchema,
  RoundStateSchema,
  SimStateSchema,
  StatsSchema,
  StatusEffectSchema,
} from '@nannymud/shared';

export function createSimSchema(plain: SimState): SimStateSchema {
  const s = new SimStateSchema();
  s.player = new ActorSchema();
  s.opponent = plain.opponent ? new ActorSchema() : null;
  s.round = plain.round ? new RoundStateSchema() : null;
  mirrorSimToSchema(plain, s);
  return s;
}

export function mirrorSimToSchema(src: SimState, dst: SimStateSchema): void {
  dst.tick = src.tick;
  dst.timeMs = src.timeMs;
  dst.currentWave = src.currentWave;
  dst.cameraX = src.cameraX;
  dst.cameraLocked = src.cameraLocked;
  dst.phase = src.phase;
  dst.bossSpawned = src.bossSpawned;
  dst.score = src.score;
  dst.rngSeed = src.rngSeed;
  dst.nextActorId = src.nextActorId;
  dst.nextProjectileId = src.nextProjectileId;
  dst.nextPickupId = src.nextPickupId;
  dst.nextEffectId = src.nextEffectId;
  dst.bloodtallyDecayMs = src.bloodtallyDecayMs;
  dst.mode = src.mode;
  dst.nextLogId = src.nextLogId;
  dst.battleTimer = src.battleTimer ?? 0;

  mirrorActor(src.player, dst.player as ActorSchema);

  if (src.opponent) {
    if (!dst.opponent) dst.opponent = new ActorSchema();
    mirrorActor(src.opponent, dst.opponent as ActorSchema);
  } else {
    dst.opponent = null;
  }

  if (src.round) {
    if (!dst.round) dst.round = new RoundStateSchema();
    mirrorRound(src.round, dst.round as RoundStateSchema);
  } else {
    dst.round = null;
  }

  syncArray(dst.enemies as unknown as ArraySchema<ActorSchema>, src.enemies, makeActor, mirrorActor);
  syncArray(dst.allies as unknown as ArraySchema<ActorSchema>, src.allies, makeActor, mirrorActor);
  syncArray(dst.pickups as unknown as ArraySchema<PickupSchema>, src.pickups, makePickup, mirrorPickup);
  syncArray(dst.projectiles as unknown as ArraySchema<ProjectileSchema>, src.projectiles, makeProjectile, mirrorProjectile);
  syncArray(dst.combatLog as unknown as ArraySchema<LogEntrySchema>, src.combatLog, makeLog, mirrorLog);
  // waves is story-only; empty in VS.
}

// ---------------------------------------------------------------------------
// Per-type mirrors
// ---------------------------------------------------------------------------

function mirrorActor(src: Actor, dst: ActorSchema): void {
  dst.id = src.id;
  dst.kind = src.kind;
  dst.team = src.team;
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.vx = src.vx;
  dst.vy = src.vy;
  dst.vz = src.vz;
  dst.facing = src.facing;
  dst.width = src.width;
  dst.height = src.height;
  dst.hp = src.hp;
  dst.hpMax = src.hpMax;
  dst.hpDark = src.hpDark;
  dst.mp = src.mp;
  dst.mpMax = src.mpMax;
  dst.armor = src.armor;
  dst.magicResist = src.magicResist;
  dst.moveSpeed = src.moveSpeed;
  dst.animationId = src.animationId;
  dst.animationFrame = src.animationFrame;
  dst.animationTimeMs = src.animationTimeMs;
  dst.state = src.state;
  dst.stateTimeMs = src.stateTimeMs;
  dst.isPlayer = src.isPlayer;
  dst.guildId = src.guildId ?? null;
  dst.rmbCooldown = src.rmbCooldown;
  dst.comboHits = src.comboHits;
  dst.lastAttackTimeMs = src.lastAttackTimeMs;
  dst.knockdownTimeMs = src.knockdownTimeMs;
  dst.getupTimeMs = src.getupTimeMs;
  dst.invulnerableMs = src.invulnerableMs;
  dst.bossPhase = src.bossPhase;
  dst.summonedByPlayer = src.summonedByPlayer;
  dst.isAlive = src.isAlive;
  dst.deathTimeMs = src.deathTimeMs;
  dst.score = src.score;

  if (src.bloodtally !== undefined) dst.bloodtally = src.bloodtally;
  if (src.chiOrbs !== undefined) dst.chiOrbs = src.chiOrbs;
  if (src.sanity !== undefined) dst.sanity = src.sanity;
  if (src.shapeshiftForm !== undefined) dst.shapeshiftForm = src.shapeshiftForm;
  if (src.primedClass !== undefined) dst.primedClass = src.primedClass;
  if (src.miasmaActive !== undefined) dst.miasmaActive = src.miasmaActive;
  dst.stealthed = src.statusEffects.some(e => e.type === 'stealth');
  if (src.petAiMode !== undefined) dst.petAiMode = src.petAiMode;
  if (src.fivePointPalmTarget !== undefined) dst.fivePointPalmTarget = src.fivePointPalmTarget;

  if (src.dishes) {
    if (!dst.dishes) dst.dishes = new ArraySchema<string>() as unknown as string[];
    syncPrimitiveArray(dst.dishes as unknown as ArraySchema<string>, src.dishes);
  }

  mirrorStats(src.stats, dst.stats as StatsSchema);
  mirrorAI(src.aiState, dst.aiState as AIStateSchema);

  syncArray(
    dst.statusEffects as unknown as ArraySchema<StatusEffectSchema>,
    src.statusEffects,
    makeStatusEffect,
    mirrorStatusEffect,
  );

  syncPrimitiveMap(dst.abilityCooldowns as unknown as MapSchema<number>, src.abilityCooldowns);

  if (src.heldPickup) {
    if (!dst.heldPickup) dst.heldPickup = new PickupSchema();
    mirrorPickup(src.heldPickup, dst.heldPickup as PickupSchema);
  } else {
    dst.heldPickup = null;
  }
}

function mirrorStats(src: Stats, dst: StatsSchema): void {
  dst.STR = src.STR;
  dst.DEX = src.DEX;
  dst.CON = src.CON;
  dst.INT = src.INT;
  dst.WIS = src.WIS;
  dst.CHA = src.CHA;
}

function mirrorAI(src: AIState, dst: AIStateSchema): void {
  dst.behavior = src.behavior;
  dst.targetId = src.targetId ?? null;
  dst.lastActionMs = src.lastActionMs;
  dst.retreating = src.retreating;
  dst.packRole = src.packRole ?? null;
  dst.phase = src.phase;
  dst.patrolDir = src.patrolDir;
  dst.leapCooldown = src.leapCooldown;
  dst.windupActive = src.windupActive;
  dst.windupTimeMs = src.windupTimeMs;
  dst.lungeMs = src.lungeMs;
}

function mirrorRound(src: RoundState, dst: RoundStateSchema): void {
  dst.index = src.index;
  dst.wins.p1 = src.wins.p1;
  dst.wins.p2 = src.wins.p2;
  dst.timeRemainingMs = src.timeRemainingMs;
  dst.phase = src.phase;
  dst.phaseStartedAtMs = src.phaseStartedAtMs;
  dst.winnerOfRound = src.winnerOfRound;
  dst.matchWinner = src.matchWinner;
}

function mirrorStatusEffect(src: StatusEffect, dst: StatusEffectSchema): void {
  dst.id = src.id;
  dst.type = src.type;
  dst.magnitude = src.magnitude;
  dst.durationMs = src.durationMs;
  dst.remainingMs = src.remainingMs;
  dst.source = src.source;
  if (src.damageType !== undefined) dst.damageType = src.damageType;
  if (src.tickIntervalMs !== undefined) dst.tickIntervalMs = src.tickIntervalMs;
  if (src.lastTickMs !== undefined) dst.lastTickMs = src.lastTickMs;
}

function mirrorPickup(src: Pickup, dst: PickupSchema): void {
  dst.id = src.id;
  dst.type = src.type;
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.hitsLeft = src.hitsLeft;
  dst.heldBy = src.heldBy ?? null;
}

function mirrorProjectile(src: Projectile, dst: ProjectileSchema): void {
  dst.id = src.id;
  dst.ownerId = src.ownerId;
  dst.team = src.team;
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.vx = src.vx;
  dst.vy = src.vy;
  dst.vz = src.vz;
  dst.damage = src.damage;
  dst.damageType = src.damageType;
  dst.range = src.range;
  dst.traveled = src.traveled;
  dst.radius = src.radius;
  dst.knockdown = src.knockdown;
  dst.knockbackForce = src.knockbackForce;
  dst.piercing = src.piercing;
  dst.color = src.color;
  dst.type = src.type;
  syncPrimitiveArray(dst.hitActorIds as unknown as ArraySchema<string>, src.hitActorIds);
}

function mirrorLog(src: LogEntry, dst: LogEntrySchema): void {
  dst.id = src.id;
  dst.tickId = src.tickId;
  dst.tag = src.tag;
  dst.tone = src.tone;
  dst.text = src.text;
}

// ---------------------------------------------------------------------------
// Array / map sync helpers
// ---------------------------------------------------------------------------

function makeActor(): ActorSchema { return new ActorSchema(); }
function makeStatusEffect(): StatusEffectSchema { return new StatusEffectSchema(); }
function makePickup(): PickupSchema { return new PickupSchema(); }
function makeProjectile(): ProjectileSchema { return new ProjectileSchema(); }
function makeLog(): LogEntrySchema { return new LogEntrySchema(); }

function syncArray<TPlain, TSchema>(
  dst: ArraySchema<TSchema>,
  src: TPlain[],
  makeFn: () => TSchema,
  mirrorFn: (p: TPlain, s: TSchema) => void,
): void {
  while (dst.length > src.length) dst.pop();
  while (dst.length < src.length) dst.push(makeFn());
  for (let i = 0; i < src.length; i++) mirrorFn(src[i]!, dst[i]!);
}

function syncPrimitiveArray<T>(dst: ArraySchema<T>, src: T[]): void {
  while (dst.length > src.length) dst.pop();
  for (let i = 0; i < src.length; i++) {
    if (i < dst.length) dst[i] = src[i]!;
    else dst.push(src[i]!);
  }
}

function syncPrimitiveMap<V>(dst: MapSchema<V>, src: Map<string, V>): void {
  for (const k of [...dst.keys()]) {
    if (!src.has(k)) dst.delete(k);
  }
  for (const [k, v] of src) {
    dst.set(k, v);
  }
}
