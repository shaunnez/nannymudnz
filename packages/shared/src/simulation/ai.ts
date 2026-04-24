import type { Actor, SimState, VFXEvent, Projectile } from './types';
import { ENEMY_DEFS } from './enemyData';
import { isStunned, applyDamage, addStatusEffect } from './combat';
import { GROUND_Y_MIN, GROUND_Y_MAX } from './constants';
import { getEffectiveMoveSpeed } from './physics';


function findTarget(actor: Actor, state: SimState): Actor | null {
  const targets = (actor.team === 'enemy'
    ? [state.player, ...state.allies].filter(a => a.isAlive)
    : state.enemies.filter(a => a.isAlive)
  ).filter(a => !a.statusEffects.some(e => e.type === 'stealth'));
  if (targets.length === 0) return null;
  return targets.reduce((closest, t) => {
    const dCurrent = Math.hypot(t.x - actor.x, t.y - actor.y);
    const dBest = Math.hypot(closest.x - actor.x, closest.y - actor.y);
    return dCurrent < dBest ? t : closest;
  });
}

function tickPetAI(actor: Actor, state: SimState): boolean {
  if (actor.petAiMode === undefined) return false;

  if (actor.petAiMode === 'passive') {
    const owner = [state.player, state.opponent].filter(Boolean).find(a => a!.id === actor.summonedBy) ?? null;
    if (owner) {
      const dx = owner.x - actor.x;
      if (Math.abs(dx) > 80) {
        actor.vx = Math.sign(dx) * actor.moveSpeed;
        actor.facing = Math.sign(dx) as -1 | 1;
      } else {
        actor.vx = 0;
      }
      const dy = owner.y - actor.y;
      actor.vy = Math.abs(dy) > 40 ? Math.sign(dy) * actor.moveSpeed * 0.5 : 0;
    }
    return true;
  }

  if (actor.petAiMode === 'defensive') {
    const owner = [state.player, state.opponent].filter(Boolean).find(a => a!.id === actor.summonedBy) ?? null;
    if (!owner) return false;
    const ownerUnderAttack = state.enemies.some(
      e => e.isAlive && Math.abs(e.x - owner.x) < 120 && e.state === 'attacking',
    );
    if (!ownerUnderAttack) {
      const dx = owner.x - actor.x;
      if (Math.abs(dx) > 80) {
        actor.vx = Math.sign(dx) * actor.moveSpeed;
        actor.facing = Math.sign(dx) as -1 | 1;
      } else {
        actor.vx = 0;
      }
      const dy = owner.y - actor.y;
      actor.vy = Math.abs(dy) > 40 ? Math.sign(dy) * actor.moveSpeed * 0.5 : 0;
      return true;
    }
    // owner under attack: fall through to aggressive (return false = run normal AI)
    return false;
  }

  // aggressive: run normal AI
  return false;
}

export function tickAI(actor: Actor, state: SimState, dtSec: number, vfxEvents: VFXEvent[]): void {
  if (!actor.isAlive || isStunned(actor)) {
    actor.vx = 0;
    actor.vy = 0;
    return;
  }

  if (tickPetAI(actor, state)) return;

  const def = ENEMY_DEFS[actor.kind];
  if (!def) return;

  const ai = actor.aiState;
  ai.lastActionMs += dtSec * 1000;

  const target = findTarget(actor, state);
  if (!target) {
    actor.vx = 0;
    actor.vy = 0;
    return;
  }

  ai.targetId = target.id;

  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const dist = Math.hypot(dx, dy);
  const speed = getEffectiveMoveSpeed(actor);

  if (actor.kind === 'bandit_king') {
    tickBossAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx, dy);
    return;
  }

  switch (ai.behavior) {
    case 'chaser':
      tickChaserAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx, dy);
      break;
    case 'archer':
      tickArcherAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx, dy);
      break;
    case 'packer':
      tickPackerAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx, dy);
      break;
    case 'brute':
      tickBruteAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx);
      break;
  }
}

function moveToward(actor: Actor, tx: number, ty: number, speed: number): void {
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  const dist = Math.hypot(dx, dy) || 1;
  actor.vx = (dx / dist) * speed;
  actor.vy = (dy / dist) * speed;
  actor.facing = dx > 0 ? 1 : -1;
  actor.animationId = 'walk';
}

function stopMoving(actor: Actor): void {
  actor.vx = 0;
  actor.vy = 0;
  actor.animationId = 'idle';
}

function tryMeleeAttack(state: SimState, actor: Actor, target: Actor, damage: number, cooldownMs: number, vfxEvents: VFXEvent[]): boolean {
  if (target.team === actor.team) return false;
  if (actor.aiState.lastActionMs < cooldownMs) return false;
  const def = ENEMY_DEFS[actor.kind];
  if (!def) return false;
  const range = def.attackRange;
  if (Math.abs(target.x - actor.x) > range || Math.abs(target.y - actor.y) > 30) return false;

  actor.aiState.lastActionMs = 0;
  actor.animationId = 'attack_1';
  applyDamage(target, damage + Math.round(state.rng() * 4), vfxEvents);
  vfxEvents.push({ type: 'hit_spark', color: '#fbbf24', x: target.x, y: target.y, z: target.z });
  return true;
}

function spawnProjectile(state: SimState, actor: Actor, target: Actor, damage: number, speed: number, range: number): void {
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const dist = Math.hypot(dx, dy) || 1;
  const proj: Projectile = {
    id: `proj_${state.nextProjectileId++}`,
    ownerId: actor.id,
    guildId: null,
    team: actor.team,
    x: actor.x,
    y: actor.y,
    z: actor.z + actor.height * 0.55,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    vz: 0,
    damage,
    damageType: 'physical',
    range,
    traveled: 0,
    radius: 8,
    knockdown: false,
    knockbackForce: 0,
    effects: {},
    piercing: false,
    color: '#d97706',
    type: 'arrow',
    hitActorIds: [],
  };
  state.projectiles.push(proj);
}

function tickChaserAI(actor: Actor, target: Actor, state: SimState, _dtSec: number, vfxEvents: VFXEvent[], speed: number, dist: number, dx: number, dy: number): void {
  const def = ENEMY_DEFS[actor.kind];
  if (!def) return;

  if (actor.hp < actor.hpMax * 0.25 && dist < 200) {
    actor.aiState.retreating = true;
  } else if (dist > 300) {
    actor.aiState.retreating = false;
  }

  if (actor.aiState.retreating) {
    moveToward(actor, actor.x - dx * 2, actor.y - dy * 2, speed * 0.8);
    return;
  }

  // Chebyshev-ish approach: keep closing until BOTH axes are inside the
  // tight tolerances tryMeleeAttack will later enforce. Using Euclidean
  // `dist` alone lets the actor stop at dist≈range with dy still out of
  // the 30u depth tolerance, which reads as "drifts nearby but never hits".
  const xClose = Math.abs(dx) <= def.attackRange;
  const yClose = Math.abs(dy) <= 25;
  if (!xClose || !yClose) {
    moveToward(actor, target.x, target.y, speed);
  } else {
    stopMoving(actor);
    tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs, vfxEvents);
  }
}

function tickArcherAI(actor: Actor, target: Actor, state: SimState, _dtSec: number, _vfxEvents: VFXEvent[], speed: number, dist: number, dx: number, dy: number): void {
  const def = ENEMY_DEFS[actor.kind];
  if (!def) return;
  const idealDist = 300;
  const retreatDist = 200;

  if (dist < retreatDist) {
    moveToward(actor, actor.x - dx * 2, actor.y - dy * 2, speed);
    return;
  }

  if (dist > idealDist + 50) {
    moveToward(actor, target.x, target.y, speed * 0.6);
    return;
  }

  stopMoving(actor);
  actor.facing = dx > 0 ? 1 : -1;

  if (actor.aiState.lastActionMs >= def.attackCooldownMs && Math.abs(dy) <= 30) {
    actor.aiState.lastActionMs = 0;
    actor.animationId = 'attack_1';
    spawnProjectile(state, actor, target, def.damage, def.projectileSpeed || 400, def.projectileRange || 350);
  }
}

function tickPackerAI(actor: Actor, target: Actor, state: SimState, dtSec: number, vfxEvents: VFXEvent[], speed: number, dist: number, dx: number, dy: number): void {
  const def = ENEMY_DEFS[actor.kind];
  if (!def) return;

  const ai = actor.aiState;
  ai.leapCooldown = (ai.leapCooldown || 0) - dtSec * 1000;

  if (ai.packRole === 'leader') {
    if (dist > 60 && ai.leapCooldown <= 0) {
      ai.leapCooldown = 1500;
      actor.vz = 400;
      actor.vx = (dx / (dist || 1)) * speed * 2;
      actor.vy = (dy / (dist || 1)) * speed;
      actor.animationId = 'jump';

      if (target.team !== actor.team && Math.abs(target.x - actor.x) < 80 && Math.abs(target.y - actor.y) < 40) {
        applyDamage(target, def.damage + 5, vfxEvents);
        target.state = 'knockdown';
        target.animationId = 'knockdown';
        target.knockdownTimeMs = 0;
      }
    } else if (dist < 60) {
      tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs, vfxEvents);
    } else {
      moveToward(actor, target.x, target.y, speed);
    }
  } else {
    const sideOffset = ai.packRole === 'circler' ? 80 : -80;
    const circleX = target.x + sideOffset;
    const circleY = target.y + 60;
    const cdist = Math.hypot(circleX - actor.x, circleY - actor.y);
    if (cdist > 30) {
      moveToward(actor, circleX, circleY, speed * 0.8);
    } else {
      tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs + 500, vfxEvents);
    }
  }
}

function tickBruteAI(actor: Actor, target: Actor, _state: SimState, dtSec: number, vfxEvents: VFXEvent[], speed: number, dist: number, dx: number): void {
  const def = ENEMY_DEFS[actor.kind];
  if (!def) return;
  const ai = actor.aiState;

  if (ai.windupActive) {
    ai.windupTimeMs += dtSec * 1000;
    if (ai.windupTimeMs >= 1200) {
      ai.windupActive = false;
      ai.windupTimeMs = 0;
      if (Math.abs(target.x - actor.x) < 70 && Math.abs(target.y - actor.y) < 35) {
        applyDamage(target, def.damage + 10, vfxEvents, false);
        target.vx = (target.x - actor.x > 0 ? 1 : -1) * 300;
        target.vz = 200;
        target.state = 'knockdown';
        target.knockdownTimeMs = 0;
      }
      ai.lastActionMs = 0;
    }
    stopMoving(actor);
    return;
  }

  if (dist > 70) {
    moveToward(actor, target.x, target.y, speed);
  } else {
    stopMoving(actor);
    actor.facing = dx > 0 ? 1 : -1;
    if (ai.lastActionMs >= def.attackCooldownMs) {
      ai.windupActive = true;
      ai.windupTimeMs = 0;
      actor.animationId = 'attack_1';
    }
  }
}

function tickBossAI(actor: Actor, target: Actor, state: SimState, dtSec: number, vfxEvents: VFXEvent[], speed: number, dist: number, dx: number, dy: number): void {
  const ai = actor.aiState;
  const hpPct = actor.hp / actor.hpMax;

  let currentPhase = 0;
  if (hpPct <= 0.25) currentPhase = 2;
  else if (hpPct <= 0.50) currentPhase = 1;

  if (currentPhase !== actor.bossPhase) {
    actor.bossPhase = currentPhase;
    onBossPhaseTransition(actor, currentPhase, state, vfxEvents);
  }

  if (ai.lungeMs > 0) {
    ai.lungeMs = Math.max(0, ai.lungeMs - dtSec * 1000);
    if (ai.lungeMs === 0) {
      actor.vx = 0;
    }
  }

  const attackSpeedMult = currentPhase === 2 ? 1.3 : 1.0;
  const damageMult = currentPhase === 2 ? 1.2 : 1.0;
  const baseDamage = Math.round(40 + (actor.stats?.STR || 12) * 0.9);
  const baseAttackMs = 1200 / attackSpeedMult;

  if (dist > 90) {
    moveToward(actor, target.x, target.y, speed);
  } else {
    stopMoving(actor);
    actor.facing = dx > 0 ? 1 : -1;

    if (ai.lastActionMs >= baseAttackMs) {
      ai.lastActionMs = 0;
      actor.animationId = 'attack_1';

      if (Math.abs(dy) <= 35) {
        const finalDmg = Math.round(baseDamage * damageMult);

        if (currentPhase >= 1 && state.rng() < 0.3) {
          actor.vx = actor.facing * speed * 3;
          ai.lungeMs = 300;
        }

        if (Math.abs(target.x - actor.x) < 90) {
          applyDamage(target, finalDmg, vfxEvents, false);
        }

        if (currentPhase >= 2 && state.rng() < 0.3) {
          vfxEvents.push({ type: 'aoe_pop', color: '#8a0f0f', x: actor.x, y: actor.y, z: actor.z, radius: 180 });
          const allTargets = [state.player, ...state.allies].filter(a => a.isAlive && Math.hypot(a.x - actor.x, a.y - actor.y) < 180);
          for (const t of allTargets) {
            applyDamage(t, Math.round(30 + (actor.stats?.STR || 12) * 0.5), vfxEvents, false);
            addStatusEffect(state, t, 'stun', 1, 800, actor.id);
          }
        }
      }
    }

    if (ai.lastActionMs % 10000 < dtSec * 1000 + 50 && currentPhase === 0) {
      spawnBanditMinion(state, actor);
    }
  }
}

function onBossPhaseTransition(actor: Actor, phase: number, state: SimState, vfxEvents: VFXEvent[]): void {
  vfxEvents.push({ type: 'aoe_pop', color: '#ff0000', x: actor.x, y: actor.y, z: actor.z, radius: 200 });

  if (phase === 1) {
    spawnEnemyAt(state, 'wolf', actor.x - 100, actor.y + 50);
    spawnEnemyAt(state, 'wolf', actor.x + 100, actor.y - 50);
  }
}

function spawnBanditMinion(state: SimState, boss: Actor): void {
  spawnEnemyAt(state, 'plains_bandit', boss.x + (state.rng() > 0.5 ? 150 : -150), boss.y + (state.rng() - 0.5) * 100);
}

function spawnEnemyAt(state: SimState, kind: string, x: number, y: number): void {
  const def = ENEMY_DEFS[kind];
  if (!def) return;

  const newEnemy: Actor = {
    id: `actor_${state.nextActorId++}`,
    kind: def.kind,
    team: 'enemy',
    x: Math.max(50, Math.min(3950, x)),
    y: Math.max(GROUND_Y_MIN + 20, Math.min(GROUND_Y_MAX - 20, y)),
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
      lastActionMs: state.rng() * 1000,
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

  state.enemies.push(newEnemy);
}

export { spawnEnemyAt };
