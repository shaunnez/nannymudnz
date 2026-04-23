import type { Actor, InputState, SimState } from './types';
import { ATTACK_Y_TOLERANCE } from './constants';
import { getGuild } from './guildData';

/**
 * VS-mode CPU opponent controller.
 *
 * The opponent in single-player VS is a full-featured guild actor — it has
 * abilities, combos, stats, status effects. Rather than duplicate combat
 * routing, we synthesize an InputState each tick and feed it through the
 * same `handlePlayerInput` pipeline that the local player and MP opponent
 * use. This keeps combat behaviour identical for CPU and humans.
 *
 * Difficulty (0..5) maps to Training / Easy / Knight / Veteran / Master /
 * Mats — labels defined in MainMenu.tsx. Higher difficulty = shorter
 * decision interval, more aggressive pursuit, higher block/ability chance.
 *
 * Determinism: input decisions that involve randomness must use `state.rng()`
 * so the golden / vs tests stay reproducible.
 */

// Default basic-attack reach in `performBasicAttack` is 55 (no pickup) — see
// simulation.ts. Keep in sync if that constant moves.
const BASIC_ATTACK_RANGE = 55;
/** Step this far inside real range before swinging so attacks connect. */
const APPROACH_MARGIN = 8;
/** Hysteresis — resume chasing only when we're clearly outside range. */
const RETREAT_MARGIN = 14;
/** Target depth overlap when approaching — inside ATTACK_Y_TOLERANCE. */
const DEPTH_TARGET_WINDOW = 20;

interface Tuning {
  /** Min gap between "decide-again" cycles (ms). Lower = more reactive. */
  decisionIntervalMs: number;
  /** Base attack-cooldown the CPU respects between its own swings (ms). */
  attackCadenceMs: number;
  /** Probability per decision tick to start blocking when player is attacking. */
  blockChance: number;
  /** Probability per decision tick to fire an ability instead of a basic. */
  abilityChance: number;
  /** Minimum gap between ability fires (ms) regardless of rng. */
  abilityCooldownMs: number;
}

const TUNING_BY_DIFFICULTY: Tuning[] = [
  // 0 Training — mostly idle, occasional approach.
  { decisionIntervalMs: 1200, attackCadenceMs: 99999, blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999 },
  // 1 Easy — slow attacks, no block.
  { decisionIntervalMs: 600,  attackCadenceMs: 1400,  blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999 },
  // 2 Knight (default) — steady attacks, occasional abilities.
  { decisionIntervalMs: 350,  attackCadenceMs: 900,   blockChance: 0.15, abilityChance: 0.10, abilityCooldownMs: 4500 },
  // 3 Veteran — aggressive, notable block.
  { decisionIntervalMs: 220,  attackCadenceMs: 700,   blockChance: 0.35, abilityChance: 0.18, abilityCooldownMs: 3000 },
  // 4 Master — heavy pressure, frequent abilities.
  { decisionIntervalMs: 140,  attackCadenceMs: 550,   blockChance: 0.55, abilityChance: 0.30, abilityCooldownMs: 2000 },
  // 5 Mats — frame-grinding menace.
  { decisionIntervalMs: 80,   attackCadenceMs: 400,   blockChance: 0.75, abilityChance: 0.45, abilityCooldownMs: 1200 },
];

function getTuning(difficulty: number): Tuning {
  const d = Math.max(0, Math.min(TUNING_BY_DIFFICULTY.length - 1, Math.round(difficulty)));
  return TUNING_BY_DIFFICULTY[d];
}

export function createEmptyCpuInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    attack: false,
    block: false,
    grab: false,
    pause: false,
    leftJustPressed: false,
    rightJustPressed: false,
    jumpJustPressed: false,
    attackJustPressed: false,
    blockJustPressed: false,
    grabJustPressed: false,
    pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0,
    lastRightPressMs: 0,
    runningLeft: false,
    runningRight: false,
    testAbilitySlot: null,
  };
}

/**
 * Mutates `prevInput` in place and returns it, producing the opponent's
 * input for this tick. Keeping the same object across ticks lets us compute
 * `*JustPressed` edges cleanly.
 */
export function synthesizeVsCpuInput(
  state: SimState,
  opp: Actor,
  prevInput: InputState,
  dtMs: number,
  difficulty: number,
): InputState {
  const player = state.player;
  const tuning = getTuning(difficulty);

  // Snapshot previous button states so we can compute JustPressed edges.
  const prev = {
    left: prevInput.left,
    right: prevInput.right,
    attack: prevInput.attack,
    block: prevInput.block,
    jump: prevInput.jump,
  };

  const ai = opp.aiState;
  ai.lastActionMs += dtMs;
  ai.abilityCooldownMs = Math.max(0, (ai.abilityCooldownMs ?? 0) - dtMs);

  // Compute spatial relationship every tick so pursuit hysteresis responds
  // continuously, not only on decision edges.
  const dx = player.x - opp.x;
  const dy = player.y - opp.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Hysteresis bands around the real melee range. Outside the retreat band
  // we chase; inside the approach band we stop and engage; in between we
  // hold the prior commitment, which prevents the start/stop stutter that
  // happened when |dx| fluttered across a single threshold.
  const approachUntil = BASIC_ATTACK_RANGE - APPROACH_MARGIN;
  const retreatBeyond = BASIC_ATTACK_RANGE + RETREAT_MARGIN;

  let pursuitDir: -1 | 0 | 1 = ai.pursuitDir ?? 0;
  if (pursuitDir === 0) {
    if (absDx > retreatBeyond) pursuitDir = dx > 0 ? 1 : -1;
  } else {
    if (absDx < approachUntil) pursuitDir = 0;
    else pursuitDir = dx > 0 ? 1 : -1; // keep chasing in current-sign direction
  }
  ai.pursuitDir = pursuitDir;

  // Horizontal pursuit — held every frame, not just on decision ticks.
  let desiredLeft = pursuitDir === -1;
  let desiredRight = pursuitDir === 1;

  // Depth adjustment — nudge onto player's plane so basic attacks connect.
  // Held every frame for the same reason.
  let desiredUp = absDy > DEPTH_TARGET_WINDOW && dy < 0;
  let desiredDown = absDy > DEPTH_TARGET_WINDOW && dy > 0;

  let desiredAttack = false;
  let desiredBlock = false;
  let desiredAbility: number | null = null;

  const inMeleeRange = absDx <= BASIC_ATTACK_RANGE - 2 && absDy <= ATTACK_Y_TOLERANCE;
  const makingDecision = ai.lastActionMs >= tuning.decisionIntervalMs;

  if (makingDecision) {
    ai.lastActionMs = 0;

    // Attack when in range and our cadence has elapsed.
    const canAttack = state.timeMs - opp.lastAttackTimeMs >= tuning.attackCadenceMs;
    if (inMeleeRange && canAttack) {
      desiredAttack = true;
      opp.lastAttackTimeMs = state.timeMs;

      // Ability roll — only try to fire on ticks where we'd otherwise attack,
      // so ability fires happen in range where they're useful. testAbilitySlot
      // bypasses combo detection and is routed directly to fireAbility in
      // handlePlayerInput (simulation.ts), which works for any actor.
      if (
        ai.abilityCooldownMs === 0 &&
        state.rng() < tuning.abilityChance &&
        opp.guildId
      ) {
        const slot = pickAbilitySlot(opp, state);
        if (slot != null) {
          desiredAbility = slot;
          desiredAttack = false;   // ability takes precedence this tick
          ai.abilityCooldownMs = tuning.abilityCooldownMs;
        }
      }
    }

    // Block reaction — if the player is currently attacking within range,
    // there's a difficulty-scaled chance we raise guard instead of striking.
    const playerAttacking = player.state === 'attacking';
    if (
      playerAttacking &&
      absDx <= BASIC_ATTACK_RANGE + 20 &&
      absDy <= ATTACK_Y_TOLERANCE + 15 &&
      state.rng() < tuning.blockChance
    ) {
      desiredBlock = true;
      desiredAttack = false;
      desiredAbility = null;
      desiredLeft = false;
      desiredRight = false;
    }
  }

  // Write out the new input with JustPressed edges.
  prevInput.left = desiredLeft;
  prevInput.right = desiredRight;
  prevInput.up = desiredUp;
  prevInput.down = desiredDown;
  prevInput.jump = false;
  prevInput.attack = desiredAttack;
  prevInput.block = desiredBlock;
  prevInput.grab = false;
  prevInput.pause = false;
  prevInput.leftJustPressed = desiredLeft && !prev.left;
  prevInput.rightJustPressed = desiredRight && !prev.right;
  prevInput.jumpJustPressed = false;
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

/**
 * Pick a guild ability slot (0-based in the player's input schema: 1-5 are
 * ability slots, 6 is rmb). Returns `null` if nothing is affordable.
 *
 * Weights abilities by affordability and cost: cheap abilities fire more
 * often, expensive ones save themselves for availability. Uses state.rng()
 * for determinism.
 */
function pickAbilitySlot(opp: Actor, state: SimState): number | null {
  const guild = getGuild(opp.guildId!);
  const candidates: { slot: number; weight: number }[] = [];

  for (let i = 0; i < guild.abilities.length && i < 5; i++) {
    const a = guild.abilities[i];
    if (opp.mp < a.cost) continue;
    const cd = opp.abilityCooldowns.get(a.id) ?? 0;
    if (cd > state.timeMs) continue;
    // Cheaper abilities get more weight; always at least 1.
    candidates.push({ slot: i + 1, weight: Math.max(1, 6 - a.cost) });
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
