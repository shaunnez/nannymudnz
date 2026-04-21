import type {
  SimState, Actor, InputState, GuildId, Projectile,
  AbilityDef, ActorKind, PlayerController,
} from './types';
import { getGuild } from './guildData';
import { makeRng } from './rng';
import { ENEMY_DEFS, STAGE_WAVES } from './enemyData';
import {
  PLAYER_SPAWN_X, PLAYER_SPAWN_Y, ENEMY_SPAWN_Y_RANGE,
  DOUBLE_TAP_MS, COMBO_ATTACK_WINDOW_MS, KNOCKDOWN_THRESHOLD,
  PICKUP_GRAB_RANGE, HP_REGEN_RATE, HP_DARK_REGEN_RATE, BLOCK_STAMINA_DRAIN,
  PARRY_WINDOW_MS, DODGE_DURATION_MS, DODGE_DISTANCE, DODGE_INVULN_MS, RUN_SPEED_MULT,
} from './constants';
import {
  calcDamage, checkCrit, applyDamage, applyHeal, addStatusEffect,
  tickStatusEffects, isStunned, isRooted, isSilenced, getDamageMultiplier, isInRange,
  applyKnockback,
} from './combat';
import { tickPhysics, tickKnockdown, tickGetup, tickProjectile, updateCamera, getEffectiveMoveSpeed } from './physics';
import { createComboBuffer, pushComboKey, detectComboFromInput, clearCombo } from './comboBuffer';
import { tickAI, spawnEnemyAt } from './ai';

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
    abilityCooldowns: {},
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
    abilityCooldowns: {},
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

function fireAbility(player: Actor, ability: AbilityDef, state: SimState, ctrl: PlayerController): void {
  if (isSilenced(player)) {
    state.vfxEvents.push({ type: 'status_text', color: '#ef4444', x: player.x, y: player.y - 80, text: 'Silenced!' });
    return;
  }

  const now = state.timeMs;
  const cdKey = ability.id;
  const cdRemaining = (player.abilityCooldowns[cdKey] || 0) - now;
  if (cdRemaining > 0) {
    state.vfxEvents.push({ type: 'status_text', color: '#f97316', x: player.x, y: player.y - 80, text: `${Math.ceil(cdRemaining / 1000)}s` });
    return;
  }

  if (!consumeResource(player, ability.cost)) {
    state.vfxEvents.push({ type: 'status_text', color: '#ef4444', x: player.x, y: player.y - 80, text: 'No resource!' });
    return;
  }

  player.abilityCooldowns[cdKey] = now + ability.cooldownMs;

  const dmgMult = getDamageMultiplier(player);

  if (ability.isHeal) {
    const healAmt = Math.round((ability.baseDamage + ability.scaleAmount * (ability.scaleStat ? player.stats[ability.scaleStat] : 0)) * dmgMult);
    applyHeal(player, healAmt, state.vfxEvents);
    state.vfxEvents.push({ type: 'heal_glow', color: ability.vfxColor, x: player.x, y: player.y, z: player.z });
  }

  if (ability.isTeleport) {
    const tx = player.x + player.facing * ability.teleportDist;
    state.vfxEvents.push({ type: 'blink_trail', color: ability.vfxColor, x: player.x, y: player.y, z: player.z, x2: tx, y2: player.y });
    player.x = Math.max(20, Math.min(3980, tx));
    if (ability.effects.stealth) {
      addStatusEffect(state, player, 'stealth', 1, ability.effects.stealth.durationMs, player.id);
    }
    clearCombo(ctrl.comboBuffer);
    return;
  }

  if (ability.isProjectile) {
    const targets = state.enemies.filter(e => e.isAlive);
    const nearest = targets.reduce<Actor | null>((b, e) => {
      if (!b) return e;
      return Math.abs(e.x - player.x) < Math.abs(b.x - player.x) ? e : b;
    }, null);

    const dir = nearest ? Math.sign(nearest.x - player.x) || player.facing : player.facing;
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
        z: player.z + 20,
        vx: dir * (ability.projectileSpeed + delay * 0),
        vy: spread * 0.5,
        vz: 0,
        damage: Math.round(calcDamage(ability, player.stats, state.enemies[0] || player, false, state.rng) * dmgMult),
        damageType: ability.damageType,
        range: ability.range || 400,
        traveled: 0,
        radius: 8,
        knockdown: ability.knockdown,
        knockbackForce: ability.knockbackForce,
        effects: ability.effects as Projectile['effects'],
        piercing: ability.id === 'arcane_shard',
        color: ability.vfxColor,
        type: ability.id,
        hitActorIds: [],
      };
      state.projectiles.push(proj);
    }
    state.vfxEvents.push({ type: 'projectile_spawn', color: ability.vfxColor, x: player.x, y: player.y, z: player.z, vx: dir * ability.projectileSpeed, vy: 0 });
  }

  if (ability.aoeRadius > 0 && !ability.isGroundTarget) {
    const aoeTargets = state.enemies.filter(e =>
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
    state.vfxEvents.push({ type: 'aoe_pop', color: ability.vfxColor, x: player.x, y: player.y, z: player.z, radius: ability.aoeRadius });
  }

  if (!ability.isProjectile && !ability.isHeal && !ability.isTeleport && ability.baseDamage > 0 && !ability.isGroundTarget && ability.aoeRadius === 0) {
    const targets = state.enemies.filter(e =>
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
    state.vfxEvents.push({ type: 'hit_spark', color: ability.vfxColor, x: player.x + player.facing * 30, y: player.y, z: player.z });
  }

  if (ability.effects) {
    for (const [etype, edata] of Object.entries(ability.effects)) {
      if (edata && (etype === 'speed_boost' || etype === 'damage_boost' || etype === 'attack_speed_boost' || etype === 'shield' || etype === 'damage_reduction' || etype === 'lifesteal')) {
        addStatusEffect(state, player, etype as any, edata.magnitude, edata.durationMs, player.id);
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
  }

  clearCombo(ctrl.comboBuffer);
}

function applyEffects(ability: AbilityDef, target: Actor, source: Actor, state: SimState): void {
  for (const [etype, edata] of Object.entries(ability.effects)) {
    if (!edata) continue;
    const effectType = etype as any;
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

  const targets = state.enemies.filter(e => e.isAlive && isInRange(player, e, range));

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

  state.vfxEvents.push({ type: 'hit_spark', color: guild.color, x: player.x + player.facing * 30, y: player.y - 20, z: player.z });
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

          const enemy = createEnemyActor(spawn.kind as string, spawnX, spawnY, state);
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
      if (dx <= target.width / 2 + proj.radius && dy <= 30) {
        const isCrit = state.rng() < 0.05;
        applyDamage(target, proj.damage * (isCrit ? 1.5 : 1), state.vfxEvents, isCrit);
        state.vfxEvents.push({ type: 'hit_spark', color: proj.color, x: proj.x, y: proj.y, z: proj.z });

        for (const [etype, edata] of Object.entries(proj.effects)) {
          if (edata) addStatusEffect(state, target, etype as any, edata.magnitude, edata.durationMs, proj.ownerId);
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

function handlePlayerInput(state: SimState, input: InputState, ctrl: PlayerController, dtMs: number): void {
  const player = state.player;
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
      const aoeTargets = state.enemies.filter(e => e.isAlive && Math.hypot(e.x - player.x, e.y - player.y) < 80);
      for (const t of aoeTargets) {
        applyDamage(t, Math.round(15 + player.stats.STR * 0.3), state.vfxEvents, false);
      }
      state.vfxEvents.push({ type: 'aoe_pop', color: '#ffffff', x: player.x, y: player.y, z: player.z, radius: 80 });
    }
    return;
  }

  if (player.state === 'channeling') {
    ctrl.channelMs += dtMs;
    const guild = getGuild(player.guildId!);
    const ability = guild.abilities.find(a => a.id === ctrl.channelingAbility) || guild.rmb;
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
        state.vfxEvents.push({ type: 'aoe_pop', color: '#fbbf24', x: player.x, y: player.y, z: player.z, radius: 60 });
        player.mp = Math.min(player.mpMax, player.mp + 10);
        if (player.guildId === 'monk') {
          player.chiOrbs = Math.min(5, (player.chiOrbs || 0) + 1);
          player.mp = player.chiOrbs;
        }
        const nearbyEnemies = state.enemies.filter(e => e.isAlive && Math.abs(e.x - player.x) < 80);
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
        z: player.z + 15,
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
    const nearestEnemy = state.enemies.filter(e => e.isAlive)
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
    const miasmaTargets = state.enemies.filter(e => e.isAlive && Math.hypot(e.x - player.x, e.y - player.y) < 90);
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

export function tickSimulation(state: SimState, input: InputState, dtMs: number): SimState {
  if (state.phase === 'victory' || state.phase === 'defeat') return state;
  if (state.phase === 'paused') {
    if (input.pauseJustPressed) state.phase = 'playing';
    return state;
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
