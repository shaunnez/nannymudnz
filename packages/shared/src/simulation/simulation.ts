import type {
  SimState, Actor, InputState, GuildId, Projectile, DamageType,
  AbilityDef, ActorKind, AnimationId, PlayerController, StatusEffectType, VFXEvent, GroundZone,
  MatchStats, StageId, EnemyDef,
} from './types';
import { getGuild, DRUID_WOLF_ABILITIES, DRUID_WOLF_RMB } from './guildData';
import { makeRng } from './rng';
import { ENEMY_DEFS, STAGE_WAVES } from './enemyData';
import {
  PLAYER_SPAWN_X, PLAYER_SPAWN_Y, ENEMY_SPAWN_Y_RANGE,
  DOUBLE_TAP_MS, COMBO_ATTACK_WINDOW_MS, KNOCKDOWN_THRESHOLD,
  PICKUP_GRAB_RANGE, HP_REGEN_RATE, HP_DARK_REGEN_RATE, BLOCK_STAMINA_DRAIN,
  PARRY_WINDOW_MS, DODGE_DURATION_MS, DODGE_DISTANCE, DODGE_INVULN_MS, RUN_SPEED_MULT,
  ATTACK_Y_TOLERANCE,
} from './constants';
import {
  calcDamage, checkCrit, applyDamage, applyHeal, addStatusEffect,
  tickStatusEffects, isStunned, isRooted, isSilenced, getDamageMultiplier, isInRange,
  applyKnockback,
} from './combat';
import { tickPhysics, tickKnockdown, tickGetup, tickProjectile, updateCamera, getEffectiveMoveSpeed } from './physics';
import { createComboBuffer, pushComboKey, detectComboFromInput, clearCombo } from './comboBuffer';
import { tickAI, spawnEnemyAt } from './ai';
import { synthesizeVsCpuInput, createEmptyCpuInput } from './vsAI';
import { tickRound } from './vsSimulation';
import { appendLog as appendCombatLog } from './combatLog';
import { tickSurvivalWaves } from './survivalWaves';

export function createPlayerActor(guildId: GuildId): Actor {
  const guild = getGuild(guildId);
  return {
    id: 'player',
    kind: guildId as ActorKind,
    team: 'player',
    x: PLAYER_SPAWN_X,
    y: PLAYER_SPAWN_Y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 1,
    width: 40,
    height: 60,
    hp: guild.hpMax,
    hpMax: guild.hpMax,
    hpDark: guild.hpMax,
    mp: guild.resource.startValue,
    mpMax: guild.resource.max,
    armor: guild.armor,
    magicResist: guild.magicResist,
    moveSpeed: guild.moveSpeed,
    stats: { ...guild.stats },
    statusEffects: [],
    animationId: 'idle',
    animationFrame: 0,
    animationTimeMs: 0,
    state: 'idle',
    stateTimeMs: 0,
    isPlayer: true,
    guildId,
    abilityCooldowns: new Map(),
    rmbCooldown: 0,
    comboHits: 0,
    lastAttackTimeMs: 0,
    knockdownTimeMs: 0,
    getupTimeMs: 0,
    invulnerableMs: 0,
    heldPickup: null,
    aiState: {
      behavior: 'chaser',
      targetId: null,
      lastActionMs: 0,
      retreating: false,
      packRole: null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
    bossPhase: 0,
    summonedByPlayer: false,
    bloodtally: 0,
    chiOrbs: 0,
    sanity: 0,
    shapeshiftForm: 'none',
    primedClass: 'knight',
    dishes: ['hearty_stew', 'hearty_stew', 'hearty_stew', 'fiery_chili', 'fiery_chili'],
    miasmaActive: false,
    isAlive: true,
    deathTimeMs: 0,
    score: 0,
  };
}

export function enterWolfForm(actor: Actor): void {
  actor.baseHpMax = actor.hpMax;
  actor.baseMoveSpeed = actor.moveSpeed;
  actor.hpMax = Math.round(actor.hpMax * 1.5);
  actor.hp = Math.min(actor.hp + Math.round(actor.baseHpMax * 0.3), actor.hpMax);
  actor.moveSpeed = Math.round(actor.moveSpeed * 0.8);
  actor.kind = 'wolf_form';
  actor.shapeshiftForm = 'wolf';
}

export function revertWolfForm(actor: Actor): void {
  actor.hpMax = actor.baseHpMax ?? actor.hpMax;
  actor.hp = Math.min(actor.hp, actor.hpMax);
  actor.moveSpeed = actor.baseMoveSpeed ?? actor.moveSpeed;
  actor.baseHpMax = undefined;
  actor.baseMoveSpeed = undefined;
  actor.kind = 'druid';
  actor.shapeshiftForm = 'none';
  actor.statusEffects = actor.statusEffects.filter(e => !(e.type === 'damage_boost' && e.source === 'wolf_form'));
}

export function createEnemyActor(kind: string, x: number, y: number, state: SimState): Actor {
  const def = ENEMY_DEFS[kind];
  if (!def) throw new Error(`Unknown enemy: ${kind}`);

  return {
    id: `actor_${state.nextActorId++}`,
    kind: def.kind,
    team: 'enemy',
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: -1,
    width: def.width,
    height: def.height,
    hp: def.hp,
    hpMax: def.hp,
    hpDark: def.hp,
    mp: 0,
    mpMax: 0,
    armor: def.armor,
    magicResist: def.magicResist,
    moveSpeed: def.moveSpeed,
    stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    statusEffects: [],
    animationId: 'idle',
    animationFrame: 0,
    animationTimeMs: 0,
    state: 'idle',
    stateTimeMs: 0,
    isPlayer: false,
    guildId: null,
    abilityCooldowns: new Map(),
    rmbCooldown: 0,
    comboHits: 0,
    lastAttackTimeMs: 0,
    knockdownTimeMs: 0,
    getupTimeMs: 0,
    invulnerableMs: 0,
    heldPickup: null,
    aiState: {
      behavior: def.ai,
      targetId: null,
      lastActionMs: state.rng() * 600,
      retreating: false,
      packRole: kind === 'wolf' ? (state.rng() > 0.5 ? 'leader' : 'circler') : null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
    bossPhase: 0,
    summonedByPlayer: false,
    isAlive: true,
    deathTimeMs: 0,
    score: 0,
  };
}

const STAGE_LEVELS: Record<StageId, number> = {
  assembly: 1, market: 2, kitchen: 3, tower: 4, grove: 5,
  catacombs: 6, throne: 7, docks: 8, rooftops: 9,
};

// eslint-disable-next-line no-restricted-globals -- seed is chosen once at boot, outside the tick loop
export function createInitialState(
  guildId: GuildId,
  stageIdOrSeed: StageId | number = 'assembly',
  seed: number = Date.now(),  // eslint-disable-line no-restricted-globals
): SimState {
  let resolvedStageId: StageId = 'assembly';
  let resolvedSeed = seed;
  if (typeof stageIdOrSeed === 'number') {
    resolvedSeed = stageIdOrSeed;
  } else {
    resolvedStageId = stageIdOrSeed;
  }
  return {
    tick: 0,
    timeMs: 0,
    player: createPlayerActor(guildId),
    enemies: [],
    allies: [],
    pickups: [],
    projectiles: [],
    groundZones: [],
    vfxEvents: [],
    waves: STAGE_WAVES[resolvedStageId].map(w => ({ ...w, enemies: w.enemies.map(e => ({ ...e })), triggered: false, cleared: false })),
    currentWave: -1,
    cameraX: 0,
    cameraLocked: false,
    phase: 'playing',
    bossSpawned: false,
    score: 0,
    rngSeed: resolvedSeed,
    rng: makeRng(resolvedSeed),
    nextActorId: 1,
    nextProjectileId: 1000,
    nextPickupId: 1,
    nextEffectId: 1,
    bloodtallyDecayMs: 0,
    mode: 'story',
    opponent: null,
    round: null,
    combatLog: [],
    nextLogId: 1,
    controllers: {},
    matchStats: makeEmptyMatchStats(),
    survivalMode: false,
    survivalScore: 0,
    battleMode: false,
    battleSlots: [],
    battleTimer: 0,
    battleDifficulty: 2,
    battStats: null,
    stageLevel: STAGE_LEVELS[resolvedStageId],
  };
}

// eslint-disable-next-line no-restricted-globals -- seed chosen once at boot, outside tick loop
export function createSurvivalState(guildId: GuildId, seed: number = Date.now()): SimState {
  return {
    ...createInitialState(guildId, seed),
    waves: [],
    currentWave: 0,
    survivalMode: true,
    survivalScore: 0,
  };
}

function emptyActorStats() {
  return { damageDealt: 0, damageTaken: 0, abilitiesCast: 0, maxCombo: 0, critHits: 0, totalHits: 0, healingDone: 0, _comboRun: 0 };
}

function makeEmptyMatchStats(): MatchStats {
  return { p1: emptyActorStats(), p2: emptyActorStats() };
}

function statSide(actorId: string): 'p1' | 'p2' | null {
  if (actorId === 'player') return 'p1';
  if (actorId === 'opponent') return 'p2';
  return null;
}

function trackDamage(state: SimState, attackerId: string, targetId: string, amount: number, isCrit: boolean): void {
  if (amount <= 0) return;
  const ms = state.matchStats;
  const aSide = statSide(attackerId);
  const tSide = statSide(targetId);
  if (aSide) {
    const as = ms[aSide];
    as.damageDealt += amount;
    as.totalHits++;
    if (isCrit) as.critHits++;
    as._comboRun++;
    if (as._comboRun > as.maxCombo) as.maxCombo = as._comboRun;
  }
  if (tSide) {
    ms[tSide].damageTaken += amount;
    ms[tSide]._comboRun = 0;
  }
  if (state.battleMode && state.battStats) {
    const entry = state.battStats[attackerId];
    if (entry) entry.dmgDealt += amount;
    const allActors = [state.player, ...state.enemies, ...state.allies];
    const target = allActors.find((a) => a.id === targetId);
    if (target) target.lastAttackedBy = attackerId;
  }
}

function trackHeal(state: SimState, actorId: string, amount: number): void {
  if (amount <= 0) return;
  const side = statSide(actorId);
  if (side) state.matchStats[side].healingDone += amount;
  if (state.battleMode && state.battStats) {
    const entry = state.battStats[actorId];
    if (entry) entry.healing += amount;
  }
}

function trackAbility(state: SimState, actorId: string): void {
  const side = statSide(actorId);
  if (side) state.matchStats[side].abilitiesCast++;
}

export function getOrCreateController(state: SimState, playerId: string, input: InputState): PlayerController {
  let ctrl = state.controllers[playerId];
  if (!ctrl) {
    ctrl = {
      input,
      comboBuffer: createComboBuffer(),
      lastAttackMs: 0,
      blockingMs: 0,
      dodgeMs: 0,
      parryWindowMs: 0,
      channelMs: 0,
      channelingAbility: null,
      castingAbility: null,
      castMs: 0,
      groundTargetX: 500,
      groundTargetY: 220,
      attackChain: 0,
      runningDir: 0,
    };
    state.controllers[playerId] = ctrl;
  }
  ctrl.input = input;
  return ctrl;
}

export function resetController(state: SimState, playerId: string): void {
  delete state.controllers[playerId];
}

/**
 * Neutral InputState — no keys held, no just-pressed edges. Used by the server
 * as a baseline when a client hasn't yet sent its first `InputMsg` (e.g. the
 * joiner seat before they've pressed anything, or a disconnected slot).
 */
export function makeEmptyInputState(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false,
    jumpJustPressed: false, attackJustPressed: false, blockJustPressed: false,
    grabJustPressed: false, pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

function consumeResource(player: Actor, cost: number): boolean {
  const guild = getGuild(player.guildId!);
  const isSanityGuild = player.guildId === 'cultist';

  if (isSanityGuild) {
    const newSanity = (player.sanity || 0) + Math.abs(cost);
    player.sanity = Math.min(guild.resource.max, newSanity);
    return true;
  }

  if (player.guildId === 'monk') {
    const chiCost = Math.ceil(cost);
    if ((player.chiOrbs || 0) < chiCost) return false;
    player.chiOrbs = (player.chiOrbs || 0) - chiCost;
    player.mp = (player.chiOrbs || 0);
    return true;
  }

  if (player.mp < cost) return false;
  player.mp = Math.max(0, player.mp - cost);
  return true;
}

function getAbilityAnimationId(player: Actor, ability: AbilityDef): AnimationId | null {
  if (!player.guildId) return null;
  const guild = getGuild(player.guildId);
  const idx = guild.abilities.findIndex(a => a.id === ability.id);
  if (idx < 0 || idx >= 5) return null;
  return `ability_${idx + 1}` as AnimationId;
}

function getAbilityAssetKey(abilityId: string, eventType: VFXEvent['type']): string | undefined {
  switch (abilityId) {
    case 'axe_swing':
      return eventType === 'hit_spark' ? 'axe_swing_impact' : undefined;
    case 'shield_bash':
      return eventType === 'hit_spark' ? 'shield_bash_impact' : undefined;
    case 'holy_rebuke':
      return eventType === 'aoe_pop' ? 'holy_rebuke_burst' : undefined;
    case 'valorous_strike':
      return eventType === 'hit_spark' ? 'valorous_strike_impact' : undefined;
    case 'taunt':
      return eventType === 'aoe_pop' ? 'taunt_shout' : undefined;
    case 'shield_wall':
      return eventType === 'aura_pulse' ? 'shield_wall_barrier' : undefined;
    case 'last_stand':
      return eventType === 'aura_pulse' ? 'last_stand_aura' : undefined;
    case 'plague_vomit':
      return eventType === 'aoe_pop' ? 'plague_vomit_burst' : undefined;
    case 'diseased_claw':
      return eventType === 'hit_spark' ? 'diseased_claw_impact' : undefined;
    case 'necrotic_embrace':
      return eventType === 'heal_glow' ? 'necrotic_embrace_drain' : undefined;
    case 'contagion':
      return eventType === 'status_mark' ? 'contagion_mark' : undefined;
    case 'rotting_tide':
      if (eventType === 'aoe_pop') return 'rotting_tide_burst';
      if (eventType === 'channel_pulse') return 'rotting_tide_channel';
      return undefined;
    case 'miasma':
      return eventType === 'aura_pulse' ? 'miasma_aura' : undefined;
    case 'rallying_cry':    return eventType === 'aura_pulse' ? 'rallying_cry_aura'    : undefined;
    case 'slash':           return eventType === 'hit_spark'  ? 'slash_impact'         : undefined;
    case 'bandage':         return eventType === 'heal_glow'  ? 'bandage_glow'         : undefined;
    case 'adrenaline_rush': return eventType === 'aura_pulse' ? 'adrenaline_rush_aura' : undefined;
    case 'second_wind':     return eventType === 'aura_pulse' ? 'second_wind_glow'     : undefined;
    case 'ice_nova': return eventType === 'aoe_pop' ? 'ice_nova_burst' : undefined;
    case 'meteor':   return eventType === 'aoe_pop' ? 'meteor_impact'  : undefined;
    case 'wild_growth':  return eventType === 'heal_glow'     ? 'wild_growth_bloom'  : undefined;
    case 'rejuvenate':   return eventType === 'heal_glow'     ? 'rejuvenate_glow'    : undefined;
    case 'cleanse':      return eventType === 'heal_glow'     ? 'cleanse_glow'       : undefined;
    case 'tranquility':  return eventType === 'channel_pulse' ? 'tranquility_pulse'  : undefined;
    case 'shapeshift':   return eventType === 'aoe_pop'       ? 'shapeshift_burst'   : undefined;
    case 'serenity':        return eventType === 'aura_pulse'    ? 'serenity_aura'      : undefined;
    case 'flying_kick':     return eventType === 'hit_spark'     ? 'flying_kick_impact' : undefined;
    case 'jab':             return eventType === 'hit_spark'     ? 'jab_impact'         : undefined;
    case 'five_point_palm': return eventType === 'hit_spark'     ? 'five_point_impact'  : undefined;
    case 'dragons_fury':    return eventType === 'channel_pulse' ? 'dragons_fury_pulse' : undefined;
    case 'monk_parry':      return eventType === 'aoe_pop'       ? 'parry_flash'        : undefined;
    case 'berserker_charge': return eventType === 'hit_spark' ? 'charge_impact'       : undefined;
    case 'execute':          return eventType === 'hit_spark' ? 'execute_impact'       : undefined;
    case 'cleaver':          return eventType === 'hit_spark' ? 'cleaver_impact'       : undefined;
    case 'skullsplitter':    return eventType === 'aoe_pop'   ? 'skullsplitter_burst'  : undefined;
    case 'tithe_of_blood':   return eventType === 'heal_glow' ? 'tithe_glow'           : undefined;
    case 'challenge':        return eventType === 'aoe_pop'   ? 'challenge_mark'       : undefined;
    case 'disengage':       return eventType === 'aoe_pop'       ? 'disengage_burst' : undefined;
    case 'bear_trap':       return eventType === 'aoe_pop'       ? 'bear_trap_snap'  : undefined;
    case 'rain_of_arrows':  return eventType === 'channel_pulse' ? 'rain_pulse'      : undefined;
    case 'prophetic_shield':    return eventType === 'aura_pulse' ? 'prophetic_shield_aura'    : undefined;
    case 'bless':               return eventType === 'aura_pulse' ? 'bless_aura'               : undefined;
    case 'curse':               return eventType === 'aoe_pop'    ? 'curse_mark'               : undefined;
    case 'divine_insight':      return eventType === 'aoe_pop'    ? 'divine_insight_burst'      : undefined;
    case 'divine_intervention': return eventType === 'aura_pulse' ? 'divine_intervention_aura' : undefined;
    case 'blood_drain':  return eventType === 'heal_glow'  ? 'blood_drain_glow'   : undefined;
    case 'fang_strike':  return eventType === 'hit_spark'  ? 'fang_strike_impact' : undefined;
    case 'nocturne':     return eventType === 'aura_pulse' ? 'nocturne_aura'      : undefined;
    case 'darkness':      return eventType === 'aoe_pop'    ? 'darkness_burst'      : undefined;
    case 'soul_leech':    return eventType === 'hit_spark'  ? 'soul_leech_drain'    : undefined;
    case 'eternal_night': return eventType === 'aoe_pop'    ? 'eternal_night_burst' : undefined;
    case 'shadow_cloak':  return eventType === 'aura_pulse' ? 'shadow_cloak_aura'   : undefined;
    case 'summon_spawn':  return eventType === 'aoe_pop'       ? 'summon_burst'  : undefined;
    case 'madness':       return eventType === 'aoe_pop'       ? 'madness_burst' : undefined;
    case 'tendril_grasp': return eventType === 'aoe_pop'       ? 'tendril_burst' : undefined;
    case 'open_the_gate': return eventType === 'channel_pulse' ? 'gate_pulse'    : undefined;
    case 'gaze_abyss':    return eventType === 'aura_pulse'    ? 'gaze_aura'     : undefined;
    case 'feast':          return eventType === 'aoe_pop'       ? 'feast_burst'          : undefined;
    case 'ladle_bash':     return eventType === 'hit_spark'     ? 'ladle_impact'         : undefined;
    case 'hot_soup':       return eventType === 'heal_glow'     ? 'hot_soup_glow'        : undefined;
    case 'signature_dish': return eventType === 'channel_pulse' ? 'signature_dish_pulse' : undefined;
    case 'chosen_strike':  return eventType === 'hit_spark'  ? 'chosen_strike_impact' : undefined;
    case 'chosen_nuke':    return eventType === 'aoe_pop'    ? 'chosen_nuke_burst'    : undefined;
    case 'eclipse':        return eventType === 'aura_pulse' ? 'eclipse_aura'         : undefined;
    case 'apotheosis':     return eventType === 'aura_pulse' ? 'apotheosis_aura'      : undefined;
    case 'frostbolt':      return eventType === 'hit_spark'  ? 'frostbolt_impact'     : undefined;
    case 'arcane_shard':   return eventType === 'hit_spark'  ? 'arcane_shard_impact'  : undefined;
    case 'piercing_volley': return eventType === 'hit_spark' ? 'piercing_volley_impact' : undefined;
    // Mage teleport flashes (event pushed in Task 3's isTeleport block)
    case 'blink':            return eventType === 'aoe_pop'    ? 'blink_flash'             : undefined;
    case 'short_teleport':   return eventType === 'aoe_pop'    ? 'short_teleport_flash'    : undefined;
    // Hunter projectile impact (bear_trap flash comes from Task 5's ground-target detonation)
    case 'aimed_shot':       return eventType === 'hit_spark'  ? 'aimed_shot_impact'       : undefined;
    // Adventurer
    case 'quickshot':        return eventType === 'hit_spark'  ? 'quickshot_impact'        : undefined;
    // Knight rmb buff
    case 'shield_block':     return eventType === 'aura_pulse' ? 'shield_block_flash'      : undefined;
    // Druid projectile
    case 'entangle':         return eventType === 'hit_spark'  ? 'entangle_burst'          : undefined;
    // Viking projectile
    case 'harpoon':          return eventType === 'hit_spark'  ? 'harpoon_impact'          : undefined;
    // Prophet projectile
    case 'smite':            return eventType === 'hit_spark'  ? 'smite_burst'             : undefined;
    // Chef projectile
    case 'spice_toss':       return eventType === 'hit_spark'  ? 'spice_toss_impact'       : undefined;
    // Master teleport flash
    case 'chosen_utility':   return eventType === 'aoe_pop'    ? 'chosen_utility_glow'     : undefined;
    case 'class_swap':       return eventType === 'aoe_pop'    ? 'class_swap_burst'        : undefined;
    // Darkmage projectile impacts
    case 'grasping_shadow':  return eventType === 'hit_spark'  ? 'grasping_shadow_burst'   : undefined;
    case 'shadow_bolt':      return eventType === 'hit_spark'  ? 'shadow_bolt_impact'      : undefined;
    // Vampire misplaced-PNG abilities
    case 'hemorrhage':  return eventType === 'hit_spark' ? 'hemorrhage_burst'  : undefined;
    case 'shadow_step': return eventType === 'aoe_pop'   ? 'shadow_step_flash' : undefined;
    case 'mist_step':   return eventType === 'aoe_pop'   ? 'mist_step_flash'   : undefined;
    // Cultist misplaced-PNG ability
    case 'whispers':    return eventType === 'hit_spark' ? 'whispers_aura'     : undefined;
    default:
      return undefined;
  }
}

function getPrimaryAreaVfxType(abilityId: string): 'aoe_pop' | 'aura_pulse' {
  switch (abilityId) {
    case 'shield_wall':
    case 'rallying_cry':
      return 'aura_pulse';
    default:
      return 'aoe_pop';
  }
}

function pushAbilityVfx(
  events: VFXEvent[],
  player: Actor,
  ability: AbilityDef,
  event: Omit<VFXEvent, 'guildId' | 'abilityId' | 'ownerId' | 'color'> & { color?: string },
): void {
  events.push({
    ...event,
    z: event.z ?? player.z + player.height * 0.5,
    color: event.color ?? ability.vfxColor,
    facing: event.facing ?? player.facing,
    guildId: player.guildId,
    abilityId: ability.id,
    ownerId: player.id,
    assetKey: event.assetKey ?? getAbilityAssetKey(ability.id, event.type),
  });
}

/**
 * Enemies from the perspective of `actor`. In VS mode both the player and the
 * opponent are human-controlled; story mode uses the existing team-based
 * enemy lookup. Keeps the subject-actor abstraction out of every call site.
 */
function getEnemiesOf(state: SimState, actor: Actor): Actor[] {
  if (state.battleMode) {
    return [state.player, ...state.enemies].filter(
      (a) => a.id !== actor.id &&
        !(a.battleTeam != null && actor.battleTeam != null && a.battleTeam === actor.battleTeam),
    );
  }
  if (state.mode === 'vs') {
    if (actor.id === 'player') {
      return state.opponent ? [state.opponent] : [];
    }
    if (actor.id === 'opponent') {
      return [state.player, ...state.allies];
    }
  }
  if (actor.team === 'enemy') {
    return [state.player, ...state.allies];
  }
  return state.enemies;
}

function detonateGroundTarget(player: Actor, ability: AbilityDef, state: SimState, ctrl: PlayerController): void {
  const cx = ctrl.groundTargetX;
  const cy = ctrl.groundTargetY;
  const dmgMult = getDamageMultiplier(player);
  const enemies = getEnemiesOf(state, player).filter(
    e => e.isAlive && Math.hypot(e.x - cx, e.y - cy) <= ability.aoeRadius,
  );
  for (const target of enemies) {
    const isCrit = checkCrit(player, state.rng);
    const dmg = Math.round(calcDamage(ability, player.stats, target, isCrit, state.rng) * dmgMult);
    trackDamage(state, player.id, target.id, applyDamage(target, dmg, state.vfxEvents, isCrit), isCrit);
    applyEffects(ability, target, player, state);
    if (ability.knockdown || dmg >= KNOCKDOWN_THRESHOLD) {
      applyKnockback(target, ability.knockbackForce || 100, player.facing, ability.knockdown, state.vfxEvents);
    }
  }
  pushAbilityVfx(state.vfxEvents, player, ability, {
    type: 'aoe_pop',
    x: cx,
    y: cy,
    radius: ability.aoeRadius,
  });

  if (ability.id === 'eternal_night') {
    state.groundZones.push({
      id: `gz_${state.nextEffectId++}`,
      x: cx,
      y: cy,
      radius: 240,
      remainingMs: 6000,
      ownerTeam: player.team as 'player' | 'enemy',
      ownerBattleTeam: player.battleTeam,
      effects: { silence: { magnitude: 1, durationMs: 1200 } },
      damagePerTick: 8,
      damageType: 'shadow',
      vfxColor: '#1a0033',
      vfxStyle: 'ring',
      nextPulseMsDown: 1000,
    });
  }

  if (ability.id === 'bear_trap') {
    const trapId = `bear_trap_${player.id}`;
    // Lift existing trap before placing a new one
    state.groundZones = state.groundZones.filter(z => z.id !== trapId);
    state.groundZones.push({
      id: trapId,
      x: cx,
      y: cy,
      radius: 40,
      remainingMs: 300000,
      ownerTeam: player.team as 'player' | 'enemy',
      ownerBattleTeam: player.battleTeam,
      effects: { root: { magnitude: 1, durationMs: 2000 } },
      damagePerTick: 0,
      triggerDamage: 40,
      damageType: 'physical',
      vfxColor: '#78350f',
      vfxStyle: 'puddle',
      nextPulseMsDown: 1500,
      triggerOnce: true,
    });
  }
}

function fireAbility(player: Actor, ability: AbilityDef, state: SimState, ctrl: PlayerController): void {
  if (isSilenced(player)) {
    state.vfxEvents.push({ type: 'status_text', color: '#ef4444', x: player.x, y: player.y - 80, text: 'Silenced!' });
    return;
  }

  // Stealth break: first damaging ability from stealth gets +100% damage bonus
  const wasStealthed = player.statusEffects.some(e => e.type === 'stealth');
  if (wasStealthed && ability.baseDamage > 0) {
    player.statusEffects = player.statusEffects.filter(e => e.type !== 'stealth');
    ctrl.fromStealthAttack = true;
  }

  const now = state.timeMs;
  const cdKey = ability.id;
  const cdRemaining = (player.abilityCooldowns.get(cdKey) ?? 0) - now;
  if (cdRemaining > 0) {
    state.vfxEvents.push({ type: 'status_text', color: '#f97316', x: player.x, y: player.y - 80, text: `${Math.ceil(cdRemaining / 1000)}s` });
    return;
  }

  if (!consumeResource(player, ability.cost)) {
    state.vfxEvents.push({ type: 'status_text', color: '#ef4444', x: player.x, y: player.y - 80, text: 'No resource!' });
    return;
  }

  player.abilityCooldowns.set(cdKey, now + ability.cooldownMs);
  trackAbility(state, player.id);
  const abilityAnimId = getAbilityAnimationId(player, ability);
  if (abilityAnimId && !ability.isChannel) {
    player.state = 'attacking';
    player.animationId = abilityAnimId;
    player.stateTimeMs = 0;
    ctrl.lastAttackMs = now;
  }

  state.vfxEvents.push({
    type: 'ability_name',
    color: '#fef3c7',
    x: player.x,
    y: player.y - player.height - 30,
    text: ability.name,
    abilityId: ability.id,
  });

  if (state.mode === 'vs') {
    const tag = player.id === 'player' ? 'P1' : player.id === 'opponent' ? 'P2' : 'SYS';
    const guild = getGuild(player.guildId!);
    appendCombatLog(state, {
      tag,
      tone: 'info',
      text: `${guild.name} uses ${ability.name}`,
    });
  }

  let dmgMult = getDamageMultiplier(player);
  if (ctrl.fromStealthAttack) {
    dmgMult *= 2.0;
    ctrl.fromStealthAttack = false;
  }

  if (ability.isHeal) {
    const healAmt = Math.round((ability.baseDamage + ability.scaleAmount * (ability.scaleStat ? player.stats[ability.scaleStat] : 0)) * dmgMult);
    trackHeal(state, player.id, applyHeal(player, healAmt, state.vfxEvents));
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'heal_glow',
      x: player.x - 10,
      y: player.y,
    });
  }

  if (ability.id === 'chosen_utility' && player.guildId === 'master') {
    const primed = player.primedClass ?? 'knight';
    switch (primed) {
      case 'knight':
        addStatusEffect(state, player, 'damage_reduction', 0.4, 2000, player.id);
        state.vfxEvents.push({ type: 'aura_pulse', x: player.x, y: player.y, color: '#fbbf24' });
        break;
      case 'mage': {
        const dir = player.facing;
        player.x = Math.max(0, Math.min(player.x + dir * 150, 4000));
        state.vfxEvents.push({ type: 'blink_trail', x: player.x, y: player.y, color: '#818cf8' });
        break;
      }
      case 'monk': {
        const targets = [...state.enemies, ...(state.opponent ? [state.opponent] : [])]
          .filter(e => e.isAlive && Math.abs(e.x - player.x) < 120 && Math.abs(e.y - player.y) < ATTACK_Y_TOLERANCE);
        for (const t of targets) trackDamage(state, player.id, t.id, applyDamage(t, 25, state.vfxEvents, false), false);
        player.x = Math.max(0, Math.min(player.x + player.facing * 80, 4000));
        state.vfxEvents.push({ type: 'hit_spark', x: player.x, y: player.y, color: '#fde68a' });
        break;
      }
      case 'hunter': {
        player.x = Math.max(0, Math.min(player.x - player.facing * 120, 4000));
        const nearby = [...state.enemies, ...(state.opponent ? [state.opponent] : [])]
          .filter(e => e.isAlive && Math.abs(e.x - player.x) < 150 && Math.abs(e.y - player.y) < ATTACK_Y_TOLERANCE);
        for (const t of nearby) addStatusEffect(state, t, 'slow', 0.4, 1500, player.id);
        state.vfxEvents.push({ type: 'aoe_pop', x: player.x, y: player.y, color: '#78350f' });
        break;
      }
      case 'druid':
        addStatusEffect(state, player, 'hot', 20, 4000, player.id);
        state.vfxEvents.push({ type: 'heal_glow', x: player.x, y: player.y, color: '#86efac' });
        break;
    }
    clearCombo(ctrl.comboBuffer);
    return;
  }

  if (ability.isTeleport) {
    const tx = player.x + player.facing * ability.teleportDist;
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'blink_trail',
      x: player.x,
      y: player.y,
      x2: tx,
      y2: player.y,
    });
    player.x = Math.max(20, Math.min(3980, tx));
    if (ability.effects.stealth) {
      addStatusEffect(state, player, 'stealth', 1, ability.effects.stealth.durationMs, player.id);
    }
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'aoe_pop',
      x: player.x,   // player.x is now the destination
      y: player.y,
      radius: 40,
    });
    clearCombo(ctrl.comboBuffer);
    return;
  }

  if (ability.id === 'chosen_strike' && player.guildId === 'master') {
    const primed = player.primedClass ?? 'knight';
    if (primed === 'mage' || primed === 'hunter') {
      const projDamageType: DamageType = primed === 'mage' ? 'magical' : 'physical';
      const projRange = primed === 'hunter' ? 450 : 280;
      const proj: Projectile = {
        id: `proj_${state.nextProjectileId++}`,
        ownerId: player.id,
        guildId: player.guildId,
        team: player.team,
        x: player.x,
        y: player.y,
        z: player.z + player.height * 0.55,
        vx: player.facing * 500,
        vy: 0,
        vz: 0,
        damage: ability.baseDamage,
        damageType: projDamageType,
        range: projRange,
        traveled: 0,
        radius: 8,
        knockdown: false,
        knockbackForce: 0,
        effects: {},
        piercing: false,
        color: primed === 'mage' ? '#818cf8' : '#8d6e63',
        type: ability.id,
        hitActorIds: [],
      };
      state.projectiles.push(proj);
      state.vfxEvents.push({ type: 'projectile_spawn', x: proj.x, y: proj.y, color: proj.color });
      clearCombo(ctrl.comboBuffer);
      return;
    }
    // knight / monk / druid: fall through to standard melee path
  }

  if (ability.isProjectile) {
    const enemies = getEnemiesOf(state, player).filter(e => e.isAlive);
    const dir = player.facing;
    const projCount = ability.id === 'piercing_volley' ? 3 : 1;

    for (let i = 0; i < projCount; i++) {
      const delay = i * 100;
      const spread = (i - Math.floor(projCount / 2)) * 3;
      const proj: Projectile = {
        id: `proj_${state.nextProjectileId++}`,
        ownerId: player.id,
        guildId: player.guildId,
        team: player.team,
        x: player.x,
        y: player.y + spread,
        z: player.z + player.height * 0.55,
        vx: dir * (ability.projectileSpeed + delay * 0),
        vy: spread * 0.5,
        vz: 0,
        damage: Math.round(calcDamage(ability, player.stats, enemies[0] || player, false, state.rng) * dmgMult),
        damageType: ability.damageType,
        range: ability.range || 400,
        traveled: 0,
        radius: 8,
        knockdown: ability.knockdown,
        knockbackForce: ability.knockbackForce,
        effects: ability.effects as Projectile['effects'],
        piercing: ability.piercing,
        color: ability.vfxColor,
        type: ability.id,
        hitActorIds: [],
      };
      state.projectiles.push(proj);
    }
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'projectile_spawn',
      x: player.x,
      y: player.y,
      vx: dir * ability.projectileSpeed,
      vy: 0,
    });
  }

  if (ability.aoeRadius > 0 && !ability.isGroundTarget) {
    const aoeTargets = getEnemiesOf(state, player).filter(e =>
      e.isAlive &&
      Math.hypot(e.x - player.x, e.y - player.y) <= ability.aoeRadius
    );
    for (const target of aoeTargets) {
      const isCrit = checkCrit(player, state.rng);
      const dmg = Math.round(calcDamage(ability, player.stats, target, isCrit, state.rng) * dmgMult);
      trackDamage(state, player.id, target.id, applyDamage(target, dmg, state.vfxEvents, isCrit), isCrit);
      applyEffects(ability, target, player, state);
      if (ability.knockdown && dmg >= KNOCKDOWN_THRESHOLD) {
        applyKnockback(target, ability.knockbackForce || 150, player.facing, true, state.vfxEvents);
      }
    }
    if (!(player.guildId === 'viking' && ability.id === 'whirlwind')) {
      const areaVfxType = getPrimaryAreaVfxType(ability.id);
      pushAbilityVfx(state.vfxEvents, player, ability, {
        type: areaVfxType,
        x: player.x,
        y: player.y,
        radius: ability.aoeRadius,
      });
    }
  }

  if (!ability.isProjectile && !ability.isHeal && !ability.isTeleport && ability.baseDamage > 0 && !ability.isGroundTarget && ability.aoeRadius === 0) {
    const targets = getEnemiesOf(state, player).filter(e =>
      e.isAlive && isInRange(player, e, ability.range || 60)
    );
    for (const target of targets) {
      const isCrit = checkCrit(player, state.rng);
      const dmg = Math.round(calcDamage(ability, player.stats, target, isCrit, state.rng) * dmgMult);
      trackDamage(state, player.id, target.id, applyDamage(target, dmg, state.vfxEvents, isCrit), isCrit);
      applyEffects(ability, target, player, state);
      if (ability.knockdown || dmg >= KNOCKDOWN_THRESHOLD) {
        applyKnockback(target, ability.knockbackForce || 100, player.facing, ability.knockdown, state.vfxEvents);
      }
    }
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'hit_spark',
      x: player.x + player.facing * 18 - 6,
      y: player.y,
    });
  }

  if (player.guildId === 'leper' && ability.id === 'contagion') {
    const targets = getEnemiesOf(state, player).filter(e =>
      e.isAlive &&
      Math.hypot(e.x - player.x, e.y - player.y) <= (ability.range || 300),
    );
    const target = targets.reduce<Actor | null>((best, enemy) => {
      if (!best) return enemy;
      return Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y)
        ? enemy
        : best;
    }, null);
    if (target) {
      applyEffects(ability, target, player, state);
      pushAbilityVfx(state.vfxEvents, player, ability, {
        type: 'status_mark',
        x: target.x,
        y: target.y,
        z: target.z + target.height * 0.6,
        radius: 18,
        targetId: target.id,
      });
    }
  }

  if (ability.effects) {
    for (const [etype, edata] of Object.entries(ability.effects)) {
      if (edata && (etype === 'speed_boost' || etype === 'damage_boost' || etype === 'attack_speed_boost' || etype === 'shield' || etype === 'damage_reduction' || etype === 'lifesteal')) {
        addStatusEffect(state, player, etype as StatusEffectType, edata.magnitude, edata.durationMs, player.id);
      }
    }
  }

  // Pure buff abilities (effects only, no area/damage/heal/projectile/teleport dispatch above)
  // emit an aura_pulse so VFX assets wired to aura_pulse actually fire.
  if (
    !ability.isProjectile &&
    !ability.isHeal &&
    !ability.isTeleport &&
    ability.aoeRadius === 0 &&
    ability.baseDamage === 0 &&
    Object.keys(ability.effects).length > 0
  ) {
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'aura_pulse',
      x: player.x,
      y: player.y,
    });
  }

  if (ability.isChannel) {
    ctrl.channelingAbility = ability.id;
    ctrl.channelMs = 0;
    player.state = 'channeling';
    player.animationId = 'channel';
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'channel_pulse',
      x: player.x,
      y: player.y,
      radius: ability.aoeRadius || ability.range || 60,
    });
  }

  if (ability.isGroundTarget && !ability.isChannel) {
    // Default target to in front of the player at cast range if never explicitly set
    ctrl.groundTargetX = player.x + player.facing * Math.min(ability.range || 200, 280);
    ctrl.groundTargetY = player.y;
    if (ability.castTimeMs > 0) {
      player.state = 'casting';
      player.animationId = 'channel';
      player.stateTimeMs = 0;
      ctrl.castingAbility = ability.id;
      ctrl.castMs = 0;
    } else {
      detonateGroundTarget(player, ability, state, ctrl);
    }
    clearCombo(ctrl.comboBuffer);
    return;
  }

  if (ability.isSummon) {
    handleSummon(ability, player, state);
  }

  if (ability.id === 'disengage' && player.guildId === 'hunter') {
    player.x = Math.max(20, Math.min(3980, player.x - player.facing * 150));
    player.vz = 280;
    player.state = 'jumping';
    player.animationId = 'jump';
    state.vfxEvents.push({ type: 'blink_trail', color: ability.vfxColor, x: player.x + player.facing * 150, y: player.y, x2: player.x, y2: player.y });
  }

  if (ability.id === 'jab' && player.guildId === 'monk') {
    player.chiOrbs = Math.min(5, (player.chiOrbs || 0) + 1);
    player.mp = player.chiOrbs;
  }

  if (ability.id === 'axe_swing' || ability.id === 'valorous_strike') {
    if (player.guildId === 'viking') player.mp = Math.min(player.mpMax, player.mp + 10);
    if (player.guildId === 'knight') player.mp = Math.min(player.mpMax, player.mp + 10);
  }

  if (ability.id === 'shapeshift' && player.guildId === 'druid') {
    if ((player.shapeshiftForm ?? 'none') === 'none') {
      enterWolfForm(player);
      addStatusEffect(state, player, 'damage_boost', 0.3, 999999, 'wolf_form');
    }
  }

  if (ability.id === 'wolf_revert') {
    revertWolfForm(player);
  }

  if (ability.id === 'class_swap' && player.guildId === 'master') {
    const classes = ['knight', 'mage', 'monk', 'hunter', 'druid'];
    const idx = classes.indexOf(player.primedClass || 'knight');
    player.primedClass = classes[(idx + 1) % classes.length];
    state.vfxEvents.push({ type: 'status_text', color: '#e0e0e0', x: player.x, y: player.y - 80, text: `Primed: ${player.primedClass}` });
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'aoe_pop',
      x: player.x,
      y: player.y,
      radius: 50,
    });
  }

  if (ability.id === 'miasma' && player.guildId === 'leper') {
    player.miasmaActive = !player.miasmaActive;
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'aura_pulse',
      x: player.x,
      y: player.y,
      radius: ability.aoeRadius || 90,
    });
  }

  if (player.guildId === 'knight' && ability.id === 'last_stand') {
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'aura_pulse',
      x: player.x,
      y: player.y,
      z: player.z + player.height * 0.7,
      radius: 118,
    });
  }

  if (ability.id === 'pet_command' && player.guildId === 'hunter') {
    const existingPet = [...state.allies, ...(state.opponent ? [state.opponent] : [])]
      .find(a => a.summonedBy === player.id && a.isAlive);

    if (!existingPet) {
      spawnEnemyAt(state, 'wolf', player.x + player.facing * 60, player.y);
      const wolf = state.enemies[state.enemies.length - 1];
      if (wolf) {
        wolf.team = player.team;
        wolf.summonedBy = player.id;
        wolf.petAiMode = 'aggressive';
        state.enemies.pop();
        state.allies.push(wolf);
        state.vfxEvents.push({ type: 'summon_spawn', x: wolf.x, y: wolf.y, color: '#8d6e63' });
      }
    } else {
      const modes = ['aggressive', 'defensive', 'passive'] as const;
      const idx = modes.indexOf(existingPet.petAiMode ?? 'aggressive');
      existingPet.petAiMode = modes[(idx + 1) % modes.length];
      state.vfxEvents.push({
        type: 'status_text', x: existingPet.x, y: existingPet.y - 60,
        color: '#ffffff', text: existingPet.petAiMode,
      });
    }
    clearCombo(ctrl.comboBuffer);
    return;
  }

  clearCombo(ctrl.comboBuffer);
}

function applyEffects(ability: AbilityDef, target: Actor, source: Actor, state: SimState): void {
  for (const [etype, edata] of Object.entries(ability.effects)) {
    if (!edata) continue;
    const effectType = etype as StatusEffectType;
    if (effectType === 'speed_boost' || effectType === 'damage_boost' || effectType === 'shield' || effectType === 'lifesteal' || effectType === 'damage_reduction') continue;
    addStatusEffect(state, target, effectType, edata.magnitude, edata.durationMs, source.id);
  }
}

function handleSummon(ability: AbilityDef, player: Actor, state: SimState): void {
  if (player.guildId === 'cultist' && ability.id === 'summon_spawn') {
    spawnEnemyAt(state, 'drowned_spawn', player.x + player.facing * 60, player.y);
    const spawn = state.enemies[state.enemies.length - 1];
    if (spawn) {
      spawn.team = player.team;
      state.enemies.pop();
      state.allies.push(spawn);
    }
  }
  if (player.guildId === 'leper' && ability.id === 'rotting_tide') {
    for (let i = 0; i < 2; i++) {
      spawnEnemyAt(state, 'rotting_husk', player.x + (i === 0 ? 60 : -60), player.y);
      const husk = state.enemies[state.enemies.length - 1];
      if (husk) {
        husk.team = player.team;
        state.enemies.pop();
        state.allies.push(husk);
      }
    }
  }
}

function performBasicAttack(player: Actor, state: SimState, ctrl: PlayerController, isRunAttack: boolean, isJumpAttack: boolean): void {
  const now = state.timeMs;
  if (now - ctrl.lastAttackMs < 350) return;
  ctrl.lastAttackMs = now;

  if (now - ctrl.lastAttackMs > COMBO_ATTACK_WINDOW_MS) {
    ctrl.attackChain = 0;
  }
  ctrl.attackChain = (ctrl.attackChain % 3) + 1;

  const chainMultiplier = ctrl.attackChain === 3 ? 1.3 : ctrl.attackChain === 2 ? 1.1 : 1.0;
  const isRunning = player.state === 'running' || isRunAttack;
  const dmgMult = (isRunning ? 1.4 : 1.0) * getDamageMultiplier(player) * chainMultiplier;

  const guild = getGuild(player.guildId!);
  const baseStr = player.stats.STR;
  const baseDmg = Math.round((10 + baseStr * 0.5) * dmgMult * (0.95 + state.rng() * 0.1));
  const range = (player.heldPickup?.type === 'club' ? 70 : 55) * (isJumpAttack ? 1.2 : 1);

  const animId = ctrl.attackChain === 1 ? 'attack_1' : ctrl.attackChain === 2 ? 'attack_2' : 'attack_3';
  player.animationId = animId;
  player.state = 'attacking';

  if (guild.rangedBasic) {
    const rb = guild.rangedBasic;
    const proj: Projectile = {
      id: `proj_${state.nextProjectileId++}`,
      ownerId: player.id,
      guildId: player.guildId,
      team: player.team,
      x: player.x,
      y: player.y,
      z: player.z + player.height * 0.55,
      vx: player.facing * rb.speed,
      vy: 0,
      vz: 0,
      damage: Math.round(baseDmg * 0.65),
      damageType: rb.damageType,
      range: rb.range,
      traveled: 0,
      radius: 8,
      knockdown: false,
      knockbackForce: 0,
      effects: {},
      piercing: false,
      color: rb.vfxColor,
      type: 'basic_ranged',
      hitActorIds: [],
    };
    state.projectiles.push(proj);
    state.vfxEvents.push({ type: 'projectile_spawn', x: proj.x, y: proj.y, color: proj.color });
    return;
  }

  const targets = getEnemiesOf(state, player).filter(e => {
    if (!e.isAlive || !isInRange(player, e, range)) return false;
    const dx = e.x - player.x;
    if (Math.abs(dx) < 1) return true;
    return Math.sign(dx) === player.facing;
  });

  if (player.heldPickup?.type === 'club') {
    player.heldPickup.hitsLeft--;
    if (player.heldPickup.hitsLeft <= 0) player.heldPickup = null;
  }

  for (const target of targets) {
    const isCrit = checkCrit(player, state.rng);
    const finalDmg = Math.max(1, isCrit ? Math.round(baseDmg * 1.5) : baseDmg);

    const lifesteal = player.statusEffects.find(e => e.type === 'lifesteal');
    if (lifesteal) {
      trackHeal(state, player.id, applyHeal(player, Math.round(finalDmg * lifesteal.magnitude), state.vfxEvents));
    }

    trackDamage(state, player.id, target.id, applyDamage(target, finalDmg, state.vfxEvents, isCrit), isCrit);

    if (finalDmg >= KNOCKDOWN_THRESHOLD || (ctrl.attackChain === 3 && isRunning)) {
      applyKnockback(target, 120, player.facing, finalDmg >= KNOCKDOWN_THRESHOLD, state.vfxEvents);
    } else {
      target.vx = player.facing * 40;
    }

    if (player.guildId === 'monk') {
      player.chiOrbs = Math.min(5, (player.chiOrbs || 0) + 1);
      player.mp = player.chiOrbs;
    }
    if (player.guildId === 'viking') {
      player.mp = Math.min(player.mpMax, player.mp + Math.round(finalDmg / 5));
    }
    if (player.guildId === 'hunter') {
      player.mp = Math.min(player.mpMax, player.mp + 5);
    }
    if (player.guildId === 'champion') {
      if (!target.isAlive) {
        player.bloodtally = Math.min(10, (player.bloodtally || 0) + 3);
        player.mp = player.bloodtally;
      }
    }
  }

  state.vfxEvents.push({
    type: 'hit_spark',
    color: guild.color,
    x: player.x + player.facing * 16,
    y: player.y,
    z: player.z + player.height * 0.55,
    facing: player.facing,
  });
}

function tickPlayerResourceRegen(player: Actor, dtMs: number, inCombat: boolean, state: SimState): void {
  if (!player.guildId) return;
  const guild = getGuild(player.guildId);
  const res = guild.resource;

  if (player.guildId === 'monk') return;
  if (player.guildId === 'cultist') {
    const sanity = (player.sanity || 0);
    player.sanity = Math.max(0, sanity - (res.decayRate * dtMs) / 1000);
    player.mp = player.sanity || 0;
    return;
  }
  if (player.guildId === 'knight') {
    player.mp = Math.max(0, player.mp - (res.decayRate * dtMs) / 1000);
    return;
  }
  if (player.guildId === 'viking') {
    if (!inCombat) {
      player.mp = Math.max(0, player.mp - (res.decayRate * dtMs) / 1000);
    }
    return;
  }
  if (player.guildId === 'champion') {
    if (!inCombat && (player.bloodtally || 0) > 0) {
      if (state.bloodtallyDecayMs >= 15000) {
        player.bloodtally = Math.max(0, (player.bloodtally || 0) - 1);
        player.mp = player.bloodtally;
        state.bloodtallyDecayMs = 0;
      }
    }
    return;
  }

  const regen = inCombat ? res.regenCombat : res.regenIdle;
  player.mp = Math.min(res.max, player.mp + (regen * dtMs) / 1000);
}

function tickHPRegen(actor: Actor, dtMs: number, inCombat: boolean): void {
  if (!actor.isAlive) return;
  if (actor.hp < actor.hpDark) {
    actor.hp = Math.min(actor.hpDark, actor.hp + (HP_REGEN_RATE * dtMs) / 1000);
  }
  if (!inCombat && actor.hpDark < actor.hpMax) {
    actor.hpDark = Math.min(actor.hpMax, actor.hpDark + (HP_DARK_REGEN_RATE * dtMs) / 1000);
  }
}

export function tickBossPhases(state: SimState, actor: Actor, def: EnemyDef): void {
  if (!def.phases || def.phases.length === 0) return;
  const nextPhase = def.phases[actor.bossPhase];
  if (!nextPhase) return;
  if (actor.hp / actor.hpMax >= nextPhase.hpThreshold) return;

  actor.bossPhase += 1;
  actor.attackSpeedMult = (actor.attackSpeedMult ?? 1) * nextPhase.attackSpeedMult;
  actor.damageMult = (actor.damageMult ?? 1) * nextPhase.damageMult;

  if (nextPhase.summons) {
    for (const s of nextPhase.summons) {
      for (let i = 0; i < s.count; i++) {
        const spawnX = actor.x + (i % 2 === 0 ? -120 : 120) - i * 40;
        const spawnY = actor.y + state.rng() * 60 - 30;
        state.enemies.push(createEnemyActor(s.kind, spawnX, spawnY, state));
      }
    }
  }

  state.vfxEvents.push({
    type: 'boss_phase',
    color: '#ff4400',
    x: actor.x,
    y: actor.y,
    actorId: actor.id,
    phase: actor.bossPhase,
  });
}

function tickWaves(state: SimState): void {
  for (let i = 0; i < state.waves.length; i++) {
    const wave = state.waves[i];
    if (wave.triggered) {
      if (!wave.cleared) {
        const allDead = state.enemies.filter(e => e.isAlive).length === 0;
        if (allDead) {
          wave.cleared = true;
          state.cameraLocked = false;
          if (i === state.waves.length - 1) {
            if (state.bossSpawned) {
              state.phase = 'victory';
            }
          }
        }
      }
      continue;
    }

    const prevCleared = i === 0 || state.waves[i - 1].cleared;
    if (prevCleared && state.player.x >= wave.triggerX) {
      wave.triggered = true;
      state.currentWave = i;
      state.cameraLocked = true;

      for (const spawn of wave.enemies) {
        for (let j = 0; j < spawn.count; j++) {
          const spawnX = state.player.x + 300 + j * 80;
          const spawnY = ENEMY_SPAWN_Y_RANGE[0] + state.rng() * (ENEMY_SPAWN_Y_RANGE[1] - ENEMY_SPAWN_Y_RANGE[0]);

          if (spawn.kind === 'bandit_king') {
            state.bossSpawned = true;
          }

          const enemy = createEnemyActor(spawn.kind, spawnX, spawnY, state);
          if (spawn.kind === 'bandit_king') {
            enemy.stats = { STR: 14, DEX: 10, CON: 18, INT: 8, WIS: 8, CHA: 8 };
          }
          state.enemies.push(enemy);
        }
      }
      break;
    }
  }
}

function tickProjectiles(state: SimState, dtSec: number): void {
  const toRemove: string[] = [];

  for (const proj of state.projectiles) {
    const alive = tickProjectile(proj, dtSec);
    if (!alive) {
      toRemove.push(proj.id);
      continue;
    }

    let checkTargets: Actor[];
    if (state.battleMode) {
      const owner = state.player.id === proj.ownerId
        ? state.player
        : state.enemies.find((e) => e.id === proj.ownerId);
      checkTargets = [state.player, ...state.enemies].filter(
        (a) => a.isAlive && a.id !== proj.ownerId &&
          !(a.battleTeam != null && owner?.battleTeam != null && a.battleTeam === owner.battleTeam),
      );
    } else {
      checkTargets = proj.team === 'player'
        ? state.enemies.filter(e => e.isAlive)
        : [state.player, ...state.allies].filter(a => a.isAlive);
    }

    let hit = false;
    for (const target of checkTargets) {
      if (proj.hitActorIds.includes(target.id)) continue;
      const dx = Math.abs(target.x - proj.x);
      const dy = Math.abs(target.y - proj.y);
      if (dx <= target.width / 2 + proj.radius && dy <= ATTACK_Y_TOLERANCE + proj.radius) {
        const isCrit = state.rng() < 0.05;
        trackDamage(state, proj.ownerId, target.id, applyDamage(target, proj.damage * (isCrit ? 1.5 : 1), state.vfxEvents, isCrit), isCrit);
        state.vfxEvents.push({
          type: 'hit_spark',
          color: proj.color,
          x: proj.x,
          y: proj.y,
          z: proj.z,
          guildId: proj.guildId,
          assetKey: proj.guildId ? getAbilityAssetKey(proj.type, 'hit_spark') : undefined,
        });

        for (const [etype, edata] of Object.entries(proj.effects)) {
          if (edata) addStatusEffect(state, target, etype as StatusEffectType, edata.magnitude, edata.durationMs, proj.ownerId);
        }

        if (proj.knockdown) {
          applyKnockback(target, proj.knockbackForce || 100, Math.sign(proj.vx) as 1 | -1, true, state.vfxEvents);
        }

        if (proj.piercing) {
          proj.hitActorIds.push(target.id);
        } else {
          hit = true;
          break;
        }
      }
    }

    if (hit) toRemove.push(proj.id);
  }

  state.projectiles = state.projectiles.filter(p => !toRemove.includes(p.id));
}

function handlePlayerInput(state: SimState, input: InputState, ctrl: PlayerController, dtMs: number, actor?: Actor): void {
  const player = actor ?? state.player;
  const now = state.timeMs;
  const dtSec = dtMs / 1000;

  if (!player.isAlive) return;

  if (player.state === 'dodging') {
    ctrl.dodgeMs -= dtMs;
    if (ctrl.dodgeMs <= 0) {
      ctrl.dodgeMs = 0;
      player.state = 'idle';
      player.vx = 0;
    }
    return;
  }

  const stunned = isStunned(player);
  const rooted = isRooted(player);

  if (player.invulnerableMs > 0) {
    player.invulnerableMs = Math.max(0, player.invulnerableMs - dtMs);
  }

  if (stunned) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  if (player.state === 'knockdown') {
    if (input.attackJustPressed) {
      applyKnockback(player, 0, 1, false, state.vfxEvents);
      const aoeTargets = getEnemiesOf(state, player).filter(e => e.isAlive && Math.hypot(e.x - player.x, e.y - player.y) < 80);
      for (const t of aoeTargets) {
        trackDamage(state, player.id, t.id, applyDamage(t, Math.round(15 + player.stats.STR * 0.3), state.vfxEvents, false), false);
      }
      state.vfxEvents.push({ type: 'aoe_pop', color: '#ffffff', x: player.x, y: player.y, z: player.z, radius: 80 });
    }
    return;
  }

  if (player.state === 'channeling') {
    const prevChannelMs = ctrl.channelMs;
    ctrl.channelMs += dtMs;
    const guild = getGuild(player.guildId!);
    const ability = guild.abilities.find(a => a.id === ctrl.channelingAbility) || guild.rmb;
    if (player.guildId === 'leper' && ability?.id === 'rotting_tide') {
      const pulseEveryMs = 250;
      if (Math.floor(prevChannelMs / pulseEveryMs) !== Math.floor(ctrl.channelMs / pulseEveryMs)) {
        pushAbilityVfx(state.vfxEvents, player, ability, {
          type: 'channel_pulse',
          x: player.x,
          y: player.y,
          radius: ability.aoeRadius || 180,
        });
      }
    }
    if (player.guildId === 'hunter' && ability?.id === 'rain_of_arrows') {
      const pulseEveryMs = 500;
      if (Math.floor(prevChannelMs / pulseEveryMs) !== Math.floor(ctrl.channelMs / pulseEveryMs)) {
        const rainX = player.x + player.facing * 200;
        const rainY = player.y;
        const radius = ability.aoeRadius || 150;
        const dmg = Math.round(ability.baseDamage + ability.scaleAmount * player.stats.DEX);
        for (const e of getEnemiesOf(state, player)) {
          if (!e.isAlive) continue;
          if (Math.abs(e.x - rainX) > radius || Math.abs(e.y - rainY) > ATTACK_Y_TOLERANCE * 2) continue;
          const rainCrit = checkCrit(player, state.rng);
          trackDamage(state, player.id, e.id, applyDamage(e, dmg, state.vfxEvents, rainCrit), rainCrit);
          addStatusEffect(state, e, 'slow', 0.3, 500, player.id);
        }
        pushAbilityVfx(state.vfxEvents, player, ability, {
          type: 'channel_pulse',
          x: rainX,
          y: rainY,
          radius,
        });
      }
    }
    if (ctrl.channelMs >= (ability?.channelDurationMs || 2000)) {
      player.state = 'idle';
      ctrl.channelingAbility = null;
      ctrl.channelMs = 0;
    } else {
      if (ability?.isHeal && player.guildId === 'druid' && ability.id === 'tranquility') {
        const healPerSec = ability.baseDamage + ability.scaleAmount * player.stats[ability.scaleStat!];
        trackHeal(state, player.id, applyHeal(player, (healPerSec * dtMs) / 1000, state.vfxEvents));
      }
    }
    return;
  }

  if (player.state === 'casting') {
    ctrl.castMs += dtMs;
    const guild = getGuild(player.guildId!);
    const ability = [...guild.abilities, guild.rmb].find(a => a.id === ctrl.castingAbility);
    if (!ability || ctrl.castMs >= ability.castTimeMs) {
      if (ability) detonateGroundTarget(actor ?? player, ability, state, ctrl);
      player.state = 'idle';
      ctrl.castingAbility = null;
      ctrl.castMs = 0;
    }
    return;
  }

  if (input.pauseJustPressed) {
    state.phase = state.phase === 'paused' ? 'playing' : 'paused';
    return;
  }

  if (input.attackJustPressed) {
    pushComboKey(ctrl.comboBuffer, 'attack', now);
  }
  if (input.leftJustPressed) {
    pushComboKey(ctrl.comboBuffer, 'left', now);
    if (now - input.lastLeftPressMs < DOUBLE_TAP_MS) {
      input.runningLeft = true;
      input.runningRight = false;
    }
    input.lastLeftPressMs = now;
  }
  if (input.rightJustPressed) {
    pushComboKey(ctrl.comboBuffer, 'right', now);
    if (now - input.lastRightPressMs < DOUBLE_TAP_MS) {
      input.runningRight = true;
      input.runningLeft = false;
    }
    input.lastRightPressMs = now;
  }
  if (input.up) pushComboKey(ctrl.comboBuffer, 'up', now);
  if (input.down) pushComboKey(ctrl.comboBuffer, 'down', now);

  if (player.state === 'blocking') {
    if (input.attackJustPressed) {
      const parrySucceeds = ctrl.parryWindowMs < PARRY_WINDOW_MS;
      if (parrySucceeds) {
        state.vfxEvents.push({ type: 'channel_pulse', color: '#fbbf24', x: player.x, y: player.y, z: player.z + player.height * 0.55, radius: 60 });
        player.mp = Math.min(player.mpMax, player.mp + 10);
        if (player.guildId === 'monk') {
          player.chiOrbs = Math.min(5, (player.chiOrbs || 0) + 1);
          player.mp = player.chiOrbs;
        }
        const nearbyEnemies = getEnemiesOf(state, player).filter(e => e.isAlive && Math.abs(e.x - player.x) < 80);
        for (const e of nearbyEnemies) {
          addStatusEffect(state, e, 'stun', 1, 500, player.id);
        }
      }
      player.state = 'idle';
      return;
    }
    if (!input.block) {
      player.state = 'idle';
    }
    ctrl.parryWindowMs += dtMs;
    player.mp = Math.max(0, player.mp - BLOCK_STAMINA_DRAIN * dtSec);
    player.vx = 0;
    player.vy = 0;
    return;
  }

  if (input.block && !input.attack && player.z === 0 && !rooted) {
    if (input.rightJustPressed || input.leftJustPressed) {
      player.state = 'dodging';
      player.invulnerableMs = DODGE_INVULN_MS;
      const dodgeDir = input.rightJustPressed ? 1 : -1;
      player.vx = dodgeDir * (DODGE_DISTANCE / (DODGE_DURATION_MS / 1000));
      player.animationId = 'dodge';
      ctrl.dodgeMs = DODGE_DURATION_MS;
      return;
    }
    player.state = 'blocking';
    ctrl.parryWindowMs = 0;
    player.animationId = 'block';
    player.vx = 0;
    player.vy = 0;
    return;
  }

  if (input.testAbilitySlot != null && !isSilenced(player)) {
    const slot = input.testAbilitySlot;
    let ability: AbilityDef | null = null;
    if (player.shapeshiftForm === 'wolf') {
      ability = slot === 'rmb' ? DRUID_WOLF_RMB :
                typeof slot === 'number' && slot >= 1 && slot <= 5 ? (DRUID_WOLF_ABILITIES[slot - 1] ?? null) :
                DRUID_WOLF_RMB;
    } else {
      const guild = getGuild(player.guildId!);
      ability = slot === 'rmb' ? guild.rmb : typeof slot === 'number' && slot <= 5 ? guild.abilities[slot - 1] : guild.rmb;
    }
    if (ability) {
      fireAbility(player, ability, state, ctrl);
      return;
    }
  }

  const comboResult = detectComboFromInput(ctrl.comboBuffer, input, now);
  if (comboResult && input.attackJustPressed) {
    let ability: AbilityDef | null = null;
    if (player.shapeshiftForm === 'wolf') {
      ability = DRUID_WOLF_ABILITIES.find(a => a.combo === comboResult) ??
                (comboResult === 'block+attack' ? DRUID_WOLF_RMB : null) ?? null;
    } else {
      const guild = getGuild(player.guildId!);
      ability = guild.abilities.find(a => a.combo === comboResult) ??
                (comboResult === 'block+attack' ? guild.rmb : null) ?? null;
    }
    if (ability) {
      fireAbility(player, ability, state, ctrl);
      return;
    }
  }

  if (input.blockJustPressed && input.attackJustPressed) {
    const rmb = player.shapeshiftForm === 'wolf' ? DRUID_WOLF_RMB : getGuild(player.guildId!).rmb;
    fireAbility(player, rmb, state, ctrl);
    return;
  }

  if (input.attackJustPressed && !isSilenced(player)) {
    const isJumpAttack = player.z > 0;
    const isRunAttack = input.runningLeft || input.runningRight;
    performBasicAttack(player, state, ctrl, isRunAttack, isJumpAttack);
  }

  if (input.jumpJustPressed && player.z === 0 && !rooted) {
    player.vz = 600;
    player.state = 'jumping';
    player.animationId = 'jump';
  }

  if (input.grabJustPressed) {
    if (player.heldPickup) {
      const pickup = player.heldPickup;
      const proj: Projectile = {
        id: `proj_${state.nextProjectileId++}`,
        ownerId: player.id,
        guildId: null,
        team: player.team,
        x: player.x,
        y: player.y,
        z: player.z + player.height * 0.55,
        vx: player.facing * 500,
        vy: 0,
        vz: 100,
        damage: 8 + player.stats.STR,
        damageType: 'physical',
        range: 400,
        traveled: 0,
        radius: 10,
        knockdown: pickup.type === 'rock',
        knockbackForce: 80,
        effects: pickup.type === 'rock' ? { stun: { magnitude: 1, durationMs: 300 } } : {},
        piercing: false,
        color: pickup.type === 'rock' ? '#9ca3af' : '#92400e',
        type: `thrown_${pickup.type}`,
        hitActorIds: [],
      };
      state.projectiles.push(proj);
      player.heldPickup = null;
      player.animationId = 'throw';
    } else {
      const nearPickup = state.pickups.find(p =>
        p.heldBy === null && Math.hypot(p.x - player.x, p.y - player.y) < PICKUP_GRAB_RANGE
      );
      if (nearPickup) {
        nearPickup.heldBy = player.id;
        player.heldPickup = nearPickup;
        state.pickups = state.pickups.filter(p => p.id !== nearPickup.id);
        player.animationId = 'pickup';
      }
    }
  }

  if (!rooted) {
    const speed = getEffectiveMoveSpeed(player) * (input.runningLeft || input.runningRight ? RUN_SPEED_MULT : 1);
    let moving = false;

    if (input.left) {
      player.vx = -speed;
      player.facing = -1;
      moving = true;
      if (!input.runningLeft) input.runningRight = false;
    } else if (input.right) {
      player.vx = speed;
      player.facing = 1;
      moving = true;
      if (!input.runningRight) input.runningLeft = false;
    } else {
      player.vx = 0;
      input.runningLeft = false;
      input.runningRight = false;
    }

    if (input.up) {
      player.vy = -speed * 0.7;
      moving = true;
    } else if (input.down) {
      player.vy = speed * 0.7;
      moving = true;
    } else {
      player.vy = 0;
    }

    if (moving && player.z === 0 && player.state !== 'attacking') {
      player.state = input.runningLeft || input.runningRight ? 'running' : 'walking';
      player.animationId = player.state === 'running' ? 'run' : 'walk';
    } else if (!moving && player.z === 0 && player.state !== 'attacking') {
      player.state = 'idle';
      player.animationId = 'idle';
    }
  }

  if (player.guildId === 'champion') {
    const nearestEnemy = getEnemiesOf(state, player).filter(e => e.isAlive)
      .reduce<Actor | null>((b, e) => {
        if (!b) return e;
        return Math.hypot(e.x - player.x, e.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y) ? e : b;
      }, null);

    if (nearestEnemy) {
      const nearDist = Math.hypot(nearestEnemy.x - player.x, nearestEnemy.y - player.y);
      if (nearDist < 450) {
        const movingAway = Math.sign(player.x - nearestEnemy.x) === Math.sign(player.vx) && Math.abs(player.vx) > 10;
        if (movingAway) {
          player.hp = Math.max(1, player.hp - dtSec);
        }
        player.mp = Math.min(10, (player.bloodtally || 0));
      }
    }
  }

  if (player.guildId === 'leper' && player.miasmaActive) {
    const leperRmb = getGuild(player.guildId).rmb;
    const pulseEveryMs = 350;
    if (Math.floor((now - dtMs) / pulseEveryMs) !== Math.floor(now / pulseEveryMs)) {
      pushAbilityVfx(state.vfxEvents, player, leperRmb, {
        type: 'aura_pulse',
        x: player.x,
        y: player.y,
        radius: leperRmb.aoeRadius || 90,
      });
    }
    const miasmaTargets = getEnemiesOf(state, player).filter(e => e.isAlive && Math.hypot(e.x - player.x, e.y - player.y) < 90);
    for (const t of miasmaTargets) {
      const miasmaBase = leperRmb.effects?.dot?.magnitude ?? 2;
      const dotDmg = miasmaBase * dtSec;
      const dmgAmount = Math.round(dotDmg);
      if (dmgAmount > 0) {
        trackDamage(state, player.id, t.id, applyDamage(t, dmgAmount, state.vfxEvents, false), false);
      }
    }
    player.mp = Math.max(0, player.mp - dtSec * 2);
  }

  if (player.state === 'attacking') {
    if (now - ctrl.lastAttackMs > 500) {
      player.state = 'idle';
    }
  }

  if (player.state === 'landing') {
    if (player.stateTimeMs > 100) {
      player.state = 'idle';
      player.animationId = 'idle';
    }
  }
}

function spawnPickup(state: SimState, enemy: Actor): void {
  const def = ENEMY_DEFS[enemy.kind];
  if (!def) return;
  if (def.dropWeapon && state.rng() < def.dropWeaponChance) {
    state.pickups.push({
      id: `pickup_${state.nextPickupId++}`,
      type: def.dropWeapon as 'rock' | 'club',
      x: enemy.x,
      y: enemy.y,
      z: 0,
      hitsLeft: def.dropWeapon === 'club' ? 8 : 1,
      heldBy: null,
    });
  }
}

function tickGroundZones(state: SimState, dtMs: number): void {
  const allActors: Actor[] = [
    state.player,
    ...(state.opponent ? [state.opponent] : []),
    ...state.enemies,
    ...state.allies,
  ];

  state.groundZones = (state.groundZones as GroundZone[]).filter(zone => {
    zone.remainingMs -= dtMs;
    if (zone.remainingMs <= 0) return false;

    zone.nextPulseMsDown -= dtMs;
    if (zone.nextPulseMsDown <= 0) {
      zone.nextPulseMsDown = 1000;
      state.vfxEvents.push({
        type: 'zone_pulse',
        x: zone.x,
        y: zone.y,
        color: zone.vfxColor,
        radius: zone.radius,
        style: zone.vfxStyle,
      } as VFXEvent);
    }

    let triggered = false;
    for (const actor of allActors) {
      if (!actor.isAlive) continue;
      if (state.battleMode
        ? (actor.battleTeam != null && zone.ownerBattleTeam != null && actor.battleTeam === zone.ownerBattleTeam)
        : actor.team === zone.ownerTeam) continue;
      const dx = actor.x - zone.x;
      const dy = actor.y - zone.y;
      if (Math.abs(dx) > zone.radius || Math.abs(dy) > ATTACK_Y_TOLERANCE * 2) continue;

      for (const [etype, edata] of Object.entries(zone.effects) as [StatusEffectType, { magnitude: number; durationMs: number }][]) {
        addStatusEffect(state, actor, etype, edata.magnitude, edata.durationMs, zone.id);
      }

      if (zone.damagePerTick > 0) {
        const dtSec = dtMs / 1000;
        applyDamage(actor, zone.damagePerTick * dtSec, state.vfxEvents, false);
      }

      if (zone.triggerOnce) {
        if (zone.triggerDamage) {
          applyDamage(actor, zone.triggerDamage, state.vfxEvents, false);
          state.vfxEvents.push({ type: 'hit_spark', color: zone.vfxColor, x: actor.x, y: actor.y, z: actor.z + 10 });
        }
        triggered = true;
        break;
      }
    }

    if (triggered) return false;
    return true;
  });
}

export function tickSimulation(
  state: SimState,
  input: InputState,
  dtMs: number,
  opponentInput?: InputState,
  extraInputs?: Record<string, InputState>,
): SimState {
  if (state.phase === 'victory' || state.phase === 'defeat') return state;
  if (state.phase === 'paused') {
    if (input.pauseJustPressed) state.phase = 'playing';
    return state;
  }

  if (state.mode === 'vs') {
    return tickVsSimulation(state, input, dtMs, opponentInput);
  }

  const dtSec = dtMs / 1000;
  state.timeMs += dtMs;
  state.tick++;
  state.vfxEvents = [];

  state.bloodtallyDecayMs += dtMs;

  const ctrl = getOrCreateController(state, 'player', input);

  if (state.survivalMode) {
    tickSurvivalWaves(state);
  } else if (!state.battleMode) {
    tickWaves(state);
  }

  if (state.player.isAlive) {
    handlePlayerInput(state, input, ctrl, dtMs);
    tickPhysics(state.player, dtSec);
    tickKnockdown(state.player, dtSec);
    tickGetup(state.player, dtSec);
    tickStatusEffects(state.player, dtMs, state.vfxEvents);
    tickHPRegen(state.player, dtMs, state.enemies.filter(e => e.isAlive).length > 0);
    const inCombat = state.enemies.filter(e => e.isAlive).length > 0;
    tickPlayerResourceRegen(state.player, dtMs, inCombat, state);
  } else {
    state.phase = 'defeat';
    return state;
  }

  for (const ally of state.allies) {
    if (!ally.isAlive) continue;
    tickAI(ally, state, dtSec, state.vfxEvents);
    tickPhysics(ally, dtSec);
    tickStatusEffects(ally, dtMs, state.vfxEvents);
    tickHPRegen(ally, dtMs, true);
  }

  const deadEnemies: Actor[] = [];
  for (const enemy of state.enemies) {
    if (!enemy.isAlive) {
      deadEnemies.push(enemy);
      continue;
    }
    if (extraInputs?.[enemy.id] !== undefined) {
      // MP Battle: human actor driven by remote client input instead of AI.
      const humanCtrl = getOrCreateController(state, enemy.id, extraInputs[enemy.id]);
      handlePlayerInput(state, extraInputs[enemy.id], humanCtrl, dtMs, enemy);
    } else if (state.battleMode && enemy.isPlayer) {
      // Battle CPU: guild actor driven by synthesized VS input, not tickAI.
      // handlePlayerInput already decrements invulnerableMs for this branch.
      const oppCtrl = getOrCreateController(state, enemy.id, createEmptyCpuInput());
      const cpuInput = synthesizeVsCpuInput(state, enemy, oppCtrl.input, dtMs, state.battleDifficulty);
      handlePlayerInput(state, cpuInput, oppCtrl, dtMs, enemy);
    } else {
      tickAI(enemy, state, dtSec, state.vfxEvents);
      if (enemy.invulnerableMs > 0) {
        enemy.invulnerableMs = Math.max(0, enemy.invulnerableMs - dtMs);
      }
    }
    tickPhysics(enemy, dtSec);
    tickKnockdown(enemy, dtSec);
    tickGetup(enemy, dtSec);
    tickStatusEffects(enemy, dtMs, state.vfxEvents);
    tickHPRegen(enemy, dtMs, true);
    const enemyDef = ENEMY_DEFS[enemy.kind];
    if (enemyDef) tickBossPhases(state, enemy, enemyDef);
  }

  for (const dead of deadEnemies) {
    if (dead.deathTimeMs === 0) {
      dead.deathTimeMs = state.timeMs;
      spawnPickup(state, dead);
      state.score += dead.hpMax;
      if (state.battleMode && state.battStats) {
        const deadEntry = state.battStats[dead.id];
        if (deadEntry) deadEntry.deaths++;
        const killerId = dead.lastAttackedBy ?? 'player';
        const killerEntry = state.battStats[killerId];
        if (killerEntry) killerEntry.kills++;
      }
    }
  }

  // In battle mode keep dead enemies so HUD slot indices stay stable throughout the match.
  if (!state.battleMode) {
    state.enemies = state.enemies.filter(e => e.isAlive || state.timeMs - e.deathTimeMs < 2000);
  }
  state.allies = state.allies.filter(a => a.isAlive);

  tickProjectiles(state, dtSec);
  tickGroundZones(state, dtMs);

  updateCamera(state);

  if (state.battleMode) {
    state.battleTimer = Math.max(0, state.battleTimer - dtMs);

    // Foes = enemies NOT on the player's team. Null/undefined battleTeam
    // means no team — always a foe.
    const foes = state.enemies.filter(
      (e) => !(e.battleTeam != null && state.player.battleTeam != null && e.battleTeam === state.player.battleTeam),
    );

    if (foes.length > 0 && foes.every((e) => !e.isAlive)) {
      state.phase = 'victory';
    } else if (state.battleTimer === 0) {
      const maxFoeHp = foes.reduce((m, e) => Math.max(m, e.hp), 0);
      state.phase = state.player.hp > maxFoeHp ? 'victory' : 'defeat';
    }
  } else {
    for (const wave of state.waves) {
      if (wave.triggered && !wave.cleared) {
        const aliveEnemies = state.enemies.filter(e => e.isAlive);
        if (aliveEnemies.length === 0) {
          wave.cleared = true;
          state.cameraLocked = false;
          const waveIdx = state.waves.indexOf(wave);
          if (waveIdx === state.waves.length - 1 && state.bossSpawned) {
            state.phase = 'victory';
          }
        }
      }
    }
  }

  return state;
}

export function forcePause(state: SimState): SimState {
  if (state.phase !== 'playing') return state;
  return { ...state, phase: 'paused' };
}

export function forceResume(state: SimState): SimState {
  if (state.phase !== 'paused') return state;
  return { ...state, phase: 'playing' };
}

function tickVsSimulation(
  state: SimState,
  input: InputState,
  dtMs: number,
  opponentInput?: InputState,
): SimState {
  const dtSec = dtMs / 1000;
  state.timeMs += dtMs;
  state.tick++;
  state.vfxEvents = [];

  const ctrl = getOrCreateController(state, 'player', input);

  const fighting = state.round?.phase === 'fighting';

  if (state.player.isAlive) {
    if (fighting) handlePlayerInput(state, input, ctrl, dtMs, state.player);
    tickPhysics(state.player, dtSec);
    tickKnockdown(state.player, dtSec);
    tickGetup(state.player, dtSec);
    tickStatusEffects(state.player, dtMs, state.vfxEvents);
    tickHPRegen(state.player, dtMs, true);
    tickPlayerResourceRegen(state.player, dtMs, true, state);
  }

  const opp = state.opponent;
  if (opp && opp.isAlive) {
    if (fighting) {
      if (opponentInput) {
        // MP 1v1: opponent is a human player. Route them through the same
        // input pipeline as the primary player so facing, combos, abilities,
        // and run-detection behave symmetrically.
        const oppCtrl = getOrCreateController(state, opp.id, opponentInput);
        handlePlayerInput(state, opponentInput, oppCtrl, dtMs, opp);
      } else {
        // SP VS: synthesize CPU input and drive through the same pipeline.
        // The opponent actor has a guild (not an enemy `kind`), so the
        // enemyData-driven tickAI in ai.ts would early-return with no effect.
        const oppCtrl = getOrCreateController(state, opp.id, createEmptyCpuInput());
        const cpuInput = synthesizeVsCpuInput(state, opp, oppCtrl.input, dtMs, state.difficulty ?? 2);
        handlePlayerInput(state, cpuInput, oppCtrl, dtMs, opp);
      }
    }
    tickPhysics(opp, dtSec);
    tickKnockdown(opp, dtSec);
    tickGetup(opp, dtSec);
    tickStatusEffects(opp, dtMs, state.vfxEvents);
    tickHPRegen(opp, dtMs, true);
    tickPlayerResourceRegen(opp, dtMs, true, state);
  }

  for (const ally of state.allies) {
    if (!ally.isAlive) continue;
    tickAI(ally, state, dtSec, state.vfxEvents);
    tickPhysics(ally, dtSec);
    tickStatusEffects(ally, dtMs, state.vfxEvents);
    tickHPRegen(ally, dtMs, true);
  }
  state.allies = state.allies.filter(a => a.isAlive);

  tickProjectiles(state, dtSec);
  tickGroundZones(state, dtMs);
  updateCamera(state);
  tickRound(state, dtMs);

  // KO detection (VS-only) — fires when hp hits 0 or actor is externally marked dead
  if ((state.player.hp <= 0 || !state.player.isAlive) && state.player.deathTimeMs === 0) {
    state.player.isAlive = false;
    state.player.deathTimeMs = state.timeMs;
    appendCombatLog(state, {
      tag: 'SYS', tone: 'ko',
      text: `${getGuild(state.player.guildId!).name} is KO'd.`,
    });
  }
  const opp2 = state.opponent;
  if (opp2 && (opp2.hp <= 0 || !opp2.isAlive) && opp2.deathTimeMs === 0) {
    opp2.isAlive = false;
    opp2.deathTimeMs = state.timeMs;
    appendCombatLog(state, {
      tag: 'SYS', tone: 'ko',
      text: `${getGuild(opp2.guildId!).name} is KO'd.`,
    });
  }

  return state;
}
