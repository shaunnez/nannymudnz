import type { Actor, InputState, SimState } from './types';
import { ATTACK_Y_TOLERANCE } from './constants';

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

/** Basic attack reach — matches the default melee footprint in combat.ts. */
const BASIC_ATTACK_RANGE = 64;
/** Target depth overlap when approaching — inside ATTACK_Y_TOLERANCE. */
const DEPTH_TARGET_WINDOW = 20;

interface Tuning {
  /** Min gap between "decide-again" cycles (ms). Lower = more reactive. */
  decisionIntervalMs: number;
  /** Base attack-cooldown the CPU respects between its own swings (ms). */
  attackCadenceMs: number;
  /** Probability per decision tick to start blocking when player is attacking. */
  blockChance: number;
  /** Probability per decision tick to fire a combo / ability instead of basic. */
  abilityChance: number;
  /** 0..1 — how persistent the pursue direction is (1 = always closes). */
  aggression: number;
}

const TUNING_BY_DIFFICULTY: Tuning[] = [
  // 0 Training — mostly idle, occasional approach.
  { decisionIntervalMs: 1200, attackCadenceMs: 99999, blockChance: 0,    abilityChance: 0,    aggression: 0.35 },
  // 1 Easy — slow attacks, no block.
  { decisionIntervalMs: 600,  attackCadenceMs: 1400,  blockChance: 0,    abilityChance: 0,    aggression: 0.7  },
  // 2 Knight (default) — steady attacks, rare block.
  { decisionIntervalMs: 350,  attackCadenceMs: 900,   blockChance: 0.15, abilityChance: 0.05, aggression: 0.9  },
  // 3 Veteran — aggressive, notable block.
  { decisionIntervalMs: 220,  attackCadenceMs: 700,   blockChance: 0.35, abilityChance: 0.12, aggression: 0.95 },
  // 4 Master — heavy pressure, frequent abilities.
  { decisionIntervalMs: 140,  attackCadenceMs: 550,   blockChance: 0.55, abilityChance: 0.25, aggression: 1.0  },
  // 5 Mats — frame-grinding menace.
  { decisionIntervalMs: 80,   attackCadenceMs: 400,   blockChance: 0.75, abilityChance: 0.4,  aggression: 1.0  },
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

  // Decision pacing — the CPU "commits" to a movement/attack intent for the
  // decision interval, then reconsiders. In between it holds the last input.
  const ai = opp.aiState;
  ai.lastActionMs += dtMs;

  // Defaults — hold most last-tick inputs until we make a new decision.
  let desiredLeft = prev.left;
  let desiredRight = prev.right;
  let desiredUp = false;
  let desiredDown = false;
  let desiredAttack = false;
  let desiredBlock = false;

  const makingDecision = ai.lastActionMs >= tuning.decisionIntervalMs;

  if (makingDecision) {
    ai.lastActionMs = 0;

    const dx = player.x - opp.x;
    const dy = player.y - opp.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const inMeleeRange = absDx <= BASIC_ATTACK_RANGE && absDy <= ATTACK_Y_TOLERANCE;

    // Horizontal approach — move toward player unless already in range.
    // Aggression < 1 gives some idle ticks at low difficulty so the CPU
    // isn't glued to the player.
    const committedToMove = state.rng() < tuning.aggression;
    if (!inMeleeRange && committedToMove) {
      desiredLeft = dx < 0;
      desiredRight = dx > 0;
    } else {
      desiredLeft = false;
      desiredRight = false;
    }

    // Depth adjustment — nudge onto player's plane so basic attacks connect.
    if (absDy > DEPTH_TARGET_WINDOW) {
      desiredUp = dy < 0;
      desiredDown = dy > 0;
    }

    // Attack when in range and our cadence has elapsed.
    const canAttack = opp.lastAttackTimeMs === 0 || state.timeMs - opp.lastAttackTimeMs >= tuning.attackCadenceMs;
    if (inMeleeRange && canAttack) {
      desiredAttack = true;
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
      desiredLeft = false;
      desiredRight = false;
    }

    // Ability usage slot is wired later via `testAbilitySlot`; leave a hook
    // here so higher difficulties can fire abilities. (No-op until wired.)
    void tuning.abilityChance;
  } else {
    // Mid-commitment — keep walking toward player but stop attacking / blocking
    // so the edge-triggered inputs don't double-fire.
    desiredAttack = false;
    desiredBlock = false;
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
  prevInput.testAbilitySlot = null;

  return prevInput;
}
