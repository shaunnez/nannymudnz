import type { Actor, StatusEffect, StatusEffectType, VFXEvent, DamageType, SimState } from './types';
import type { Stats } from './types';
import { ATTACK_Y_TOLERANCE } from './constants';

export function calcDamage(
  ability: { baseDamage: number; scaleStat: keyof Stats | null; scaleAmount: number; damageType: DamageType },
  actorStats: Stats,
  target: Actor,
  isCrit: boolean,
  rng: () => number,
): number {
  const statVal = ability.scaleStat ? actorStats[ability.scaleStat] : 0;
  let dmg = ability.baseDamage + ability.scaleAmount * statVal;

  const isPhysical = ability.damageType === 'physical';
  const isMagical = !isPhysical;

  if (isPhysical) {
    dmg *= 1 - target.armor / (target.armor + 100);
  } else if (isMagical || ability.damageType === 'magical' || ability.damageType === 'shadow' || ability.damageType === 'holy' || ability.damageType === 'psychic' || ability.damageType === 'necrotic' || ability.damageType === 'nature') {
    dmg *= 1 - target.magicResist / (target.magicResist + 100);
  }

  if (isCrit) dmg *= 1.5;
  dmg *= 0.95 + rng() * 0.1;

  return Math.max(1, Math.round(dmg));
}

export function checkCrit(actor: Actor, rng: () => number): boolean {
  let critChance = 0.05;
  actor.statusEffects.forEach(e => {
    if (e.type === 'bless') critChance += 0.15;
  });
  return rng() < critChance;
}

export function applyDamage(
  target: Actor,
  amount: number,
  vfxEvents: VFXEvent[],
  isCrit = false,
): void {
  if (!target.isAlive) return;
  if (target.invulnerableMs > 0) return;

  const hasShield = target.statusEffects.find(e => e.type === 'shield' && e.magnitude > 0);
  if (hasShield) {
    hasShield.magnitude -= amount;
    if (hasShield.magnitude <= 0) {
      target.statusEffects = target.statusEffects.filter(e => e !== hasShield);
    }
    amount = 0;
  }

  const damageReduction = target.statusEffects
    .filter(e => e.type === 'damage_reduction')
    .reduce((acc, e) => acc * (1 - e.magnitude), 1);
  amount = Math.round(amount * damageReduction);

  if (amount <= 0) return;

  target.hp = Math.max(0, target.hp - amount);
  target.hpDark = Math.max(target.hp, target.hpDark - amount * 0.1);

  vfxEvents.push({
    type: 'damage_number',
    color: isCrit ? '#f97316' : '#fef08a',
    x: target.x,
    y: target.y,
    z: target.z + target.height,
    value: amount,
    isCrit,
  });

  vfxEvents.push({ type: 'hit_spark', color: '#fef08a', x: target.x, y: target.y, z: target.z + target.height / 2 });

  if (target.hp <= 0) {
    target.isAlive = false;
    target.state = 'dead';
    target.animationId = 'death';
  }
}

export function applyHeal(
  target: Actor,
  amount: number,
  vfxEvents: VFXEvent[],
): void {
  if (!target.isAlive) return;
  const actual = Math.min(amount, target.hpMax - target.hp);
  target.hp = Math.min(target.hpMax, target.hp + actual);
  target.hpDark = Math.min(target.hpMax, target.hpDark + actual * 0.5);

  if (actual > 0) {
    vfxEvents.push({
      type: 'heal_glow',
      color: '#4ade80',
      x: target.x,
      y: target.y,
      z: target.z + target.height,
    });
    vfxEvents.push({
      type: 'damage_number',
      color: '#4ade80',
      x: target.x,
      y: target.y,
      z: target.z + target.height,
      value: actual,
      isHeal: true,
    });
  }
}

export function addStatusEffect(
  state: SimState,
  target: Actor,
  type: StatusEffectType,
  magnitude: number,
  durationMs: number,
  source: string,
): void {
  const existing = target.statusEffects.find(e => e.type === type && e.source === source);
  if (existing) {
    existing.remainingMs = Math.max(existing.remainingMs, durationMs);
    existing.magnitude = Math.max(existing.magnitude, magnitude);
    return;
  }
  const effect: StatusEffect = {
    id: `fx_${state.nextEffectId++}`,
    type,
    magnitude,
    durationMs,
    remainingMs: durationMs,
    source,
  };
  target.statusEffects.push(effect);
}

export function tickStatusEffects(
  actor: Actor,
  dtMs: number,
  vfxEvents: VFXEvent[],
): void {
  const toRemove: StatusEffect[] = [];

  for (const effect of actor.statusEffects) {
    effect.remainingMs -= dtMs;

    if (effect.type === 'dot' || effect.type === 'infected') {
      if (!effect.tickIntervalMs) effect.tickIntervalMs = 500;
      if (!effect.lastTickMs) effect.lastTickMs = 0;
      effect.lastTickMs += dtMs;
      if (effect.lastTickMs >= effect.tickIntervalMs) {
        effect.lastTickMs -= effect.tickIntervalMs;
        const tickDmg = Math.round(effect.magnitude * (effect.tickIntervalMs / 1000));
        if (tickDmg > 0) {
          applyDamage(actor, tickDmg, vfxEvents);
        }
      }
    }

    if (effect.type === 'hot') {
      if (!effect.tickIntervalMs) effect.tickIntervalMs = 500;
      if (!effect.lastTickMs) effect.lastTickMs = 0;
      effect.lastTickMs += dtMs;
      if (effect.lastTickMs >= effect.tickIntervalMs) {
        effect.lastTickMs -= effect.tickIntervalMs;
        const tickHeal = Math.round(effect.magnitude * (effect.tickIntervalMs / 1000));
        if (tickHeal > 0) {
          applyHeal(actor, tickHeal, vfxEvents);
        }
      }
    }

    if (effect.remainingMs <= 0) {
      toRemove.push(effect);
    }
  }

  actor.statusEffects = actor.statusEffects.filter(e => !toRemove.includes(e));
}

export function isStunned(actor: Actor): boolean {
  return actor.statusEffects.some(e => e.type === 'stun' || e.type === 'daze');
}

export function isRooted(actor: Actor): boolean {
  return actor.statusEffects.some(e => e.type === 'root' || e.type === 'stun' || e.type === 'daze');
}

export function isSilenced(actor: Actor): boolean {
  return actor.statusEffects.some(e => e.type === 'silence');
}

export function getSpeedMultiplier(actor: Actor): number {
  let mult = 1;
  for (const e of actor.statusEffects) {
    if (e.type === 'slow') mult *= (1 - e.magnitude);
    if (e.type === 'speed_boost') mult *= (1 + e.magnitude);
    if (e.type === 'chilled') mult *= Math.max(0.25, 1 - e.magnitude * 0.05 * Math.min(5, e.magnitude));
  }
  return Math.max(0.1, mult);
}

export function getDamageMultiplier(actor: Actor): number {
  let mult = 1;
  for (const e of actor.statusEffects) {
    if (e.type === 'damage_boost') mult *= (1 + e.magnitude);
    if (e.type === 'curse') mult *= 0.85;
  }
  return mult;
}

export function getDamageTakenMultiplier(actor: Actor): number {
  let mult = 1;
  for (const e of actor.statusEffects) {
    if (e.type === 'curse') mult *= 1.20;
    if (e.type === 'taunt' && e.magnitude > 1) mult *= e.magnitude;
  }
  return mult;
}

export function isInRange(
  attacker: Actor,
  target: Actor,
  range: number,
): boolean {
  const dx = Math.abs(target.x - attacker.x);
  const dy = Math.abs(target.y - attacker.y);
  return dx <= range && dy <= ATTACK_Y_TOLERANCE;
}

export function applyKnockback(
  target: Actor,
  force: number,
  direction: -1 | 1,
  knockdown: boolean,
  vfxEvents: VFXEvent[],
): void {
  target.vx = force * direction;
  target.vz = knockdown ? 250 : 0;
  if (knockdown && Math.abs(force) > 0) {
    target.state = 'knockdown';
    target.animationId = 'knockdown';
    target.stateTimeMs = 0;
    target.knockdownTimeMs = 0;
    vfxEvents.push({ type: 'hit_spark', color: '#ef4444', x: target.x, y: target.y, z: target.z });
  }
}

export function removeDebuffs(target: Actor, count: number): void {
  const debuffs: StatusEffectType[] = ['slow', 'root', 'stun', 'silence', 'blind', 'dot', 'infected', 'chilled', 'daze', 'fear', 'curse'];
  let removed = 0;
  target.statusEffects = target.statusEffects.filter(e => {
    if (removed < count && debuffs.includes(e.type)) {
      removed++;
      return false;
    }
    return true;
  });
}
