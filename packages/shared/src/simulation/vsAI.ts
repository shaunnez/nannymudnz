import type { Actor, InputState, SimState } from './types';
import { ATTACK_Y_TOLERANCE } from './constants';
import { getGuild } from './guildData';

/**
 * VS-mode CPU opponent controller.
 *
 * Synthesizes an InputState each tick and feeds it through the same
 * `handlePlayerInput` pipeline that local players and MP opponents use.
 *
 * Guild strategy fields drive behaviour:
 *   preferRange      → ideal engagement distance ('close' 55 / 'mid' 180 / 'long' 320)
 *   retreatBelowHpPct → flee when HP falls below this fraction
 *   aggressionPct    → gates whether the bot presses attack this tick (not movement speed)
 *   useAtCloseRange  → ability only fires when close to target
 *   useAtLongRange   → ability only fires when far from target
 *   isHeal ability   → prioritised when HP < 60%
 *   blockOnReaction  → whether to block when player is swinging nearby
 *
 * Determinism: all random decisions use `state.rng()`.
 */

function areTeammateActors(a: Actor, b: Actor): boolean {
  return a.battleTeam != null && b.battleTeam != null && a.battleTeam === b.battleTeam;
}

function findVsTarget(state: SimState, opp: Actor): Actor | null {
  const candidates = [state.player, ...state.enemies].filter(
    (a) => a.isAlive && a.id !== opp.id && !areTeammateActors(a, opp),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, t) => {
    const dc = Math.hypot(t.x - opp.x, t.y - opp.y);
    const db = Math.hypot(closest.x - opp.x, closest.y - opp.y);
    return dc < db ? t : closest;
  });
}

const BASIC_ATTACK_RANGE = 55;
const APPROACH_MARGIN = 8;
const DEPTH_TARGET_WINDOW = 20;

/** Ideal engagement distance per preferRange. */
const IDEAL_DIST: Record<string, number> = {
  close: BASIC_ATTACK_RANGE,
  mid:   180,
  long:  320,
};

interface Tuning {
  decisionIntervalMs: number;
  attackCadenceMs: number;
  blockChance: number;
  abilityChance: number;
  abilityCooldownMs: number;
}

const TUNING_BY_DIFFICULTY: Tuning[] = [
  // 0 Training
  { decisionIntervalMs: 1200, attackCadenceMs: 99999, blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999 },
  // 1 Easy
  { decisionIntervalMs: 600,  attackCadenceMs: 1400,  blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999 },
  // 2 Knight (default)
  { decisionIntervalMs: 350,  attackCadenceMs: 900,   blockChance: 0.15, abilityChance: 0.10, abilityCooldownMs: 4500 },
  // 3 Veteran
  { decisionIntervalMs: 220,  attackCadenceMs: 700,   blockChance: 0.35, abilityChance: 0.18, abilityCooldownMs: 3000 },
  // 4 Master
  { decisionIntervalMs: 140,  attackCadenceMs: 550,   blockChance: 0.55, abilityChance: 0.30, abilityCooldownMs: 2000 },
  // 5 Mats
  { decisionIntervalMs: 80,   attackCadenceMs: 400,   blockChance: 0.75, abilityChance: 0.45, abilityCooldownMs: 1200 },
];

function getTuning(difficulty: number): Tuning {
  const d = Math.max(0, Math.min(TUNING_BY_DIFFICULTY.length - 1, Math.round(difficulty)));
  return TUNING_BY_DIFFICULTY[d];
}

export function createEmptyCpuInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false,
    jumpJustPressed: false, attackJustPressed: false,
    blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

export function synthesizeVsCpuInput(
  state: SimState,
  opp: Actor,
  prevInput: InputState,
  dtMs: number,
  difficulty: number,
): InputState {
  const player = state.battleMode
    ? (findVsTarget(state, opp) ?? state.player)
    : state.player;
  const tuning = getTuning(difficulty);

  const prev = {
    left: prevInput.left, right: prevInput.right,
    attack: prevInput.attack, block: prevInput.block, jump: prevInput.jump,
  };

  const ai = opp.aiState;
  ai.lastActionMs += dtMs;
  ai.abilityCooldownMs = Math.max(0, (ai.abilityCooldownMs ?? 0) - dtMs);

  const dx = player.x - opp.x;
  const dy = player.y - opp.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const dist = Math.hypot(dx, dy);

  // ── Guild strategy ──────────────────────────────────────────────────────
  const guild = opp.guildId ? getGuild(opp.guildId) : null;
  const strategy = guild?.strategy;
  const preferRange = strategy?.preferRange ?? 'close';
  const idealDist = IDEAL_DIST[preferRange] ?? BASIC_ATTACK_RANGE;
  const retreatHpPct = strategy?.retreatBelowHpPct ?? 0;
  const aggressionPct = strategy?.aggressionPct ?? 0.7;
  const hpPct = opp.hp / opp.hpMax;
  const isRanged = preferRange !== 'close';

  // ── Low-HP retreat ──────────────────────────────────────────────────────
  // Only retreat when dangerously low on HP — not when kiting normally.
  const isLowHp = retreatHpPct > 0 && hpPct < retreatHpPct;

  // ── Ranged kite: maintain distance, but tighter threshold ───────────────
  // Ranged bots back off only when considerably inside their ideal range.
  // Using 0.35× (not 0.6×) prevents constant retreat from normal spacing.
  const kiteRetreat = isRanged && dist < idealDist * 0.35 && !isLowHp;

  const shouldRetreat = isLowHp || kiteRetreat;

  // ── Horizontal movement (always full-speed; no stochastic gate) ─────────
  // Movement is deterministic per tick. aggressionPct gates attack eagerness
  // (below), NOT movement speed — slow-aggression guilds still reposition.
  const approachUntil = idealDist - APPROACH_MARGIN;
  const retreatBeyond = idealDist;

  let pursuitDir: -1 | 0 | 1 = ai.pursuitDir ?? 0;
  if (shouldRetreat) {
    pursuitDir = dx > 0 ? -1 : 1;    // move away from target
  } else if (pursuitDir === 0) {
    if (absDx > retreatBeyond) pursuitDir = dx > 0 ? 1 : -1;
  } else {
    if (absDx < approachUntil) pursuitDir = 0;
    else pursuitDir = dx > 0 ? 1 : -1;
  }
  ai.pursuitDir = pursuitDir;

  const desiredLeft = pursuitDir === -1;
  const desiredRight = pursuitDir === 1;

  // ── Depth adjustment ────────────────────────────────────────────────────
  const desiredUp = absDy > DEPTH_TARGET_WINDOW && dy < 0;
  const desiredDown = absDy > DEPTH_TARGET_WINDOW && dy > 0;

  // ── Jump: kite-jump (ranged) or gap-close leap (melee) ──────────────────
  let desiredJump = false;
  const jumpCooldownElapsed = (ai.lastJumpMs ?? 0) + 2000 < state.timeMs;
  if (jumpCooldownElapsed) {
    // Ranged guilds jump while retreating to break pursuit; melee jump to close.
    const retreatJump = kiteRetreat && state.rng() < 0.30;
    const gapJump = !shouldRetreat && !isRanged && dist > 180 && state.rng() < 0.18;
    if (retreatJump || gapJump) {
      desiredJump = true;
      ai.lastJumpMs = state.timeMs;
    }
  }

  let desiredAttack = false;
  let desiredBlock = false;
  let desiredAbility: number | null = null;

  const inMeleeRange = absDx <= BASIC_ATTACK_RANGE && absDy <= ATTACK_Y_TOLERANCE;
  // For ranged guilds, consider them "in range" to fire abilities at any dist
  // where depth plane is aligned; for melee, use tight melee range.
  const inAttackRange = isRanged
    ? absDy <= ATTACK_Y_TOLERANCE + 20
    : inMeleeRange;

  const makingDecision = ai.lastActionMs >= tuning.decisionIntervalMs;

  if (makingDecision) {
    ai.lastActionMs = 0;

    // ── Heal priority ────────────────────────────────────────────────────
    if (hpPct < 0.6 && ai.abilityCooldownMs === 0 && opp.guildId) {
      const healSlot = pickHealSlot(opp, state);
      if (healSlot != null) {
        desiredAbility = healSlot;
        ai.abilityCooldownMs = tuning.abilityCooldownMs;
      }
    }

    if (desiredAbility == null) {
      const canAttack = state.timeMs - opp.lastAttackTimeMs >= tuning.attackCadenceMs;

      // Ranged guilds fire abilities even while kite-retreating; melee don't
      // attack while retreating.
      const canFire = canAttack && inAttackRange && (isRanged || !shouldRetreat);

      if (canFire && state.rng() < aggressionPct + 0.2) {
        opp.lastAttackTimeMs = state.timeMs;

        if (
          ai.abilityCooldownMs === 0 &&
          state.rng() < tuning.abilityChance &&
          opp.guildId
        ) {
          const slot = pickAbilitySlot(opp, state, dist, preferRange);
          if (slot != null) {
            desiredAbility = slot;
            ai.abilityCooldownMs = tuning.abilityCooldownMs;
          }
        }

        // Basic attack: melee guilds need tight range, ranged use their rangedBasic
        // projectile at any depth-aligned range (inAttackRange already guards depth).
        if (!desiredAbility) {
          if (isRanged) {
            desiredAttack = true;
          } else if (inMeleeRange) {
            desiredAttack = true;
          }
        }
      }
    }

    // ── Block reaction ───────────────────────────────────────────────────
    const playerAttacking = player.state === 'attacking';
    if (
      playerAttacking &&
      absDx <= BASIC_ATTACK_RANGE + 20 &&
      absDy <= ATTACK_Y_TOLERANCE + 15 &&
      (strategy?.blockOnReaction ?? false) &&
      state.rng() < tuning.blockChance
    ) {
      desiredBlock = true;
      desiredAttack = false;
      desiredAbility = null;
    }
  }

  // Write output.
  prevInput.left = desiredLeft;
  prevInput.right = desiredRight;
  prevInput.up = desiredUp;
  prevInput.down = desiredDown;
  prevInput.jump = desiredJump;
  prevInput.attack = desiredAttack;
  prevInput.block = desiredBlock;
  prevInput.grab = false;
  prevInput.pause = false;
  prevInput.leftJustPressed = desiredLeft && !prev.left;
  prevInput.rightJustPressed = desiredRight && !prev.right;
  prevInput.jumpJustPressed = desiredJump && !prev.jump;
  prevInput.attackJustPressed = desiredAttack && !prev.attack;
  prevInput.blockJustPressed = desiredBlock && !prev.block;
  prevInput.grabJustPressed = false;
  prevInput.pauseJustPressed = false;
  prevInput.fullscreenToggleJustPressed = false;
  if (prevInput.leftJustPressed) prevInput.lastLeftPressMs = state.timeMs;
  if (prevInput.rightJustPressed) prevInput.lastRightPressMs = state.timeMs;
  prevInput.runningLeft = false;
  prevInput.runningRight = false;
  prevInput.testAbilitySlot = desiredAbility;

  return prevInput;
}

/** Pick the best available heal-ability slot. Returns null if none ready. */
function pickHealSlot(opp: Actor, state: SimState): number | null {
  if (!opp.guildId) return null;
  const guild = getGuild(opp.guildId);
  for (let i = 0; i < guild.abilities.length && i < 5; i++) {
    const a = guild.abilities[i];
    if (!a.isHeal) continue;
    if (opp.mp < a.cost) continue;
    const cd = opp.abilityCooldowns.get(a.id) ?? 0;
    if (cd > state.timeMs) continue;
    return i + 1;
  }
  return null;
}

/**
 * Pick a guild ability slot weighted by cost, range appropriateness, and
 * strategy hints (useAtCloseRange / useAtLongRange).
 */
function pickAbilitySlot(
  opp: Actor,
  state: SimState,
  dist: number,
  preferRange: string,
): number | null {
  if (!opp.guildId) return null;
  const guild = getGuild(opp.guildId);
  const strat = guild.strategy?.abilities ?? {};
  const candidates: { slot: number; weight: number }[] = [];

  for (let i = 0; i < guild.abilities.length && i < 5; i++) {
    const a = guild.abilities[i];
    if (opp.mp < a.cost) continue;
    const cd = opp.abilityCooldowns.get(a.id) ?? 0;
    if (cd > state.timeMs) continue;

    // Range filter from strategy hints.
    const slotStrat = strat[(i + 1) as keyof typeof strat];
    if (slotStrat) {
      if ((slotStrat as { useAtCloseRange?: boolean }).useAtCloseRange && dist > 120) continue;
      if ((slotStrat as { useAtLongRange?: boolean }).useAtLongRange && dist < 100) continue;
    }

    const baseWeight = Math.max(1, 6 - Math.max(0, a.cost));
    // Ranged guilds prefer projectile abilities when at range.
    const rangeBonus = a.isProjectile && preferRange !== 'close' && dist > 100 ? 3 : 0;
    candidates.push({ slot: i + 1, weight: baseWeight + rangeBonus });
  }

  if (guild.rmb && opp.mp >= guild.rmb.cost) {
    const cd = opp.abilityCooldowns.get(guild.rmb.id) ?? 0;
    if (cd <= state.timeMs) {
      candidates.push({ slot: 6, weight: 1 });
    }
  }

  if (candidates.length === 0) return null;
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let roll = state.rng() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.slot;
  }
  return candidates[candidates.length - 1].slot;
}
