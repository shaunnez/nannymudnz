import type {
  SimState, Actor, InputState, GuildId, Projectile,
  AbilityDef, ActorKind, AnimationId, PlayerController, StatusEffectType, VFXEvent,
} from './types';
import { getGuild } from './guildData';
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
    nocturneActive: false,
    isAlive: true,
    deathTimeMs: 0,
    score: 0,
  };
}

function createEnemyActor(kind: string, x: number, y: number, state: SimState): Actor {
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

// eslint-disable-next-line no-restricted-globals -- seed is chosen once at boot, outside the tick loop
export function createInitialState(guildId: GuildId, seed: number = Date.now()): SimState {
  return {
    tick: 0,
    timeMs: 0,
    player: createPlayerActor(guildId),
    enemies: [],
    allies: [],
    pickups: [],
    projectiles: [],
    vfxEvents: [],
    waves: STAGE_WAVES.map(w => ({ ...w, enemies: w.enemies.map(e => ({ ...e })), triggered: false, cleared: false })),
    currentWave: -1,
    cameraX: 0,
    cameraLocked: false,
    phase: 'playing',
    bossSpawned: false,
    score: 0,
    rngSeed: seed,
    rng: makeRng(seed),
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
  };
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
    default:
      return undefined;
  }
}

function getPrimaryAreaVfxType(abilityId: string): 'aoe_pop' | 'aura_pulse' {
  switch (abilityId) {
    case 'shield_wall':
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
  if (state.mode === 'vs') {
    if (actor.id === 'player') {
      return state.opponent ? [state.opponent] : [];
    }
    if (actor.id === 'opponent') {
      return [state.player];
    }
  }
  if (actor.team === 'enemy') {
    return [state.player, ...state.allies];
  }
  return state.enemies;
}

function fireAbility(player: Actor, ability: AbilityDef, state: SimState, ctrl: PlayerController): void {
  if (isSilenced(player)) {
    state.vfxEvents.push({ type: 'status_text', color: '#ef4444', x: player.x, y: player.y - 80, text: 'Silenced!' });
    return;
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

  const dmgMult = getDamageMultiplier(player);

  if (ability.isHeal) {
    const healAmt = Math.round((ability.baseDamage + ability.scaleAmount * (ability.scaleStat ? player.stats[ability.scaleStat] : 0)) * dmgMult);
    applyHeal(player, healAmt, state.vfxEvents);
    pushAbilityVfx(state.vfxEvents, player, ability, {
      type: 'heal_glow',
      x: player.x - 10,
      y: player.y,
    });
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
    clearCombo(ctrl.comboBuffer);
    return;
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
      applyDamage(target, dmg, state.vfxEvents, isCrit);
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
      applyDamage(target, dmg, state.vfxEvents, isCrit);
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

  if (ability.isChannel) {
    ctrl.channelingAbility = ability.id;
    ctrl.channelMs = 0;
    player.state = 'channeling';
    player.animationId = 'channel';
  }

  if (ability.isSummon) {
    handleSummon(ability, player, state);
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
    const form = player.shapeshiftForm || 'none';
    player.shapeshiftForm = form === 'none' ? 'bear' : form === 'bear' ? 'wolf' : 'none';
  }

  if (ability.id === 'class_swap' && player.guildId === 'master') {
    const classes = ['knight', 'mage', 'monk', 'hunter', 'druid'];
    const idx = classes.indexOf(player.primedClass || 'knight');
    player.primedClass = classes[(idx + 1) % classes.length];
    state.vfxEvents.push({ type: 'status_text', color: '#e0e0e0', x: player.x, y: player.y - 80, text: `Primed: ${player.primedClass}` });
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
      spawn.team = 'player';
      state.enemies.pop();
      state.allies.push(spawn);
    }
  }
  if (player.guildId === 'leper' && ability.id === 'rotting_tide') {
    for (let i = 0; i < 2; i++) {
      spawnEnemyAt(state, 'rotting_husk', player.x + (i === 0 ? 60 : -60), player.y);
      const husk = state.enemies[state.enemies.length - 1];
      if (husk) {
        husk.team = 'player';
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
      applyHeal(player, Math.round(finalDmg * lifesteal.magnitude), state.vfxEvents);
    }

    applyDamage(target, finalDmg, state.vfxEvents, isCrit);

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

    const checkTargets = proj.team === 'player'
      ? state.enemies.filter(e => e.isAlive)
      : [state.player, ...state.allies].filter(a => a.isAlive);

    let hit = false;
    for (const target of checkTargets) {
      if (proj.hitActorIds.includes(target.id)) continue;
      const dx = Math.abs(target.x - proj.x);
      const dy = Math.abs(target.y - proj.y);
      if (dx <= target.width / 2 + proj.radius && dy <= ATTACK_Y_TOLERANCE + proj.radius) {
        const isCrit = state.rng() < 0.05;
        applyDamage(target, proj.damage * (isCrit ? 1.5 : 1), state.vfxEvents, isCrit);
        state.vfxEvents.push({ type: 'hit_spark', color: proj.color, x: proj.x, y: proj.y, z: proj.z });

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
        applyDamage(t, Math.round(15 + player.stats.STR * 0.3), state.vfxEvents, false);
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
    if (ctrl.channelMs >= (ability?.channelDurationMs || 2000)) {
      player.state = 'idle';
      ctrl.channelingAbility = null;
      ctrl.channelMs = 0;
    } else {
      if (ability?.isHeal && player.guildId === 'druid' && ability.id === 'tranquility') {
        const healPerSec = ability.baseDamage + ability.scaleAmount * player.stats[ability.scaleStat!];
        applyHeal(player, (healPerSec * dtMs) / 1000, state.vfxEvents);
      }
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
    const guild = getGuild(player.guildId!);
    const slot = input.testAbilitySlot;
    const ability = slot <= 5 ? guild.abilities[slot - 1] : guild.rmb;
    if (ability) {
      fireAbility(player, ability, state, ctrl);
      return;
    }
  }

  const comboResult = detectComboFromInput(ctrl.comboBuffer, input, now);
  if (comboResult && input.attackJustPressed) {
    const guild = getGuild(player.guildId!);
    const ability = guild.abilities.find(a => a.combo === comboResult) || (comboResult === 'block+attack' ? guild.rmb : null);
    if (ability) {
      fireAbility(player, ability, state, ctrl);
      return;
    }
  }

  if (input.blockJustPressed && input.attackJustPressed) {
    const guild = getGuild(player.guildId!);
    fireAbility(player, guild.rmb, state, ctrl);
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
      const dotDmg = (5 + player.stats.CON * 0.2) * dtSec;
      if (dotDmg > 0.01) {
        applyDamage(t, Math.max(1, Math.round(dotDmg * (state.rng() > 0.9 ? 1 : 0))), state.vfxEvents, false);
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

export function tickSimulation(
  state: SimState,
  input: InputState,
  dtMs: number,
  opponentInput?: InputState,
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

  tickWaves(state);

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
    tickAI(enemy, state, dtSec, state.vfxEvents);
    tickPhysics(enemy, dtSec);
    tickKnockdown(enemy, dtSec);
    tickGetup(enemy, dtSec);
    tickStatusEffects(enemy, dtMs, state.vfxEvents);
    tickHPRegen(enemy, dtMs, true);
  }

  for (const dead of deadEnemies) {
    if (dead.deathTimeMs === 0) {
      dead.deathTimeMs = state.timeMs;
      spawnPickup(state, dead);
      state.score += dead.hpMax;
    }
  }

  state.enemies = state.enemies.filter(e => e.isAlive || state.timeMs - e.deathTimeMs < 2000);
  state.allies = state.allies.filter(a => a.isAlive);

  tickProjectiles(state, dtSec);

  updateCamera(state);

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

  tickProjectiles(state, dtSec);
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
