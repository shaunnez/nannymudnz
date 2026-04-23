import type { SimState, GuildId, Actor, RoundState } from './types';
import { createInitialState, createPlayerActor } from './simulation';
import { appendLog } from './combatLog';
import { getGuild } from './guildData';
import { WORLD_WIDTH, GROUND_Y_MIN, GROUND_Y_MAX } from './constants';

// LF2-style spacing: fighters start at opposite quarters of the ~900px view so
// the match opens with room to approach instead of already in melee range.
const OPPONENT_SPAWN_X_OFFSET = 500;
const ROUND_TIME_MS = 60_000;

export function createVsState(
  p1: GuildId,
  p2: GuildId,
  _stageId: string,
  seed: number,
  humanOpponent = false,
  difficulty = 2,
): SimState {
  const state = createInitialState(p1, seed);
  state.mode = 'vs';
  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  if (!humanOpponent) state.difficulty = difficulty;

  const opponent = buildOpponent(p2, state.player.x + OPPONENT_SPAWN_X_OFFSET, humanOpponent);
  state.opponent = opponent;
  state.enemies = [opponent];

  const round: RoundState = {
    index: 0,
    wins: { p1: 0, p2: 0 },
    timeRemainingMs: ROUND_TIME_MS,
    phase: 'intro',
    phaseStartedAtMs: 0,
    winnerOfRound: null,
    matchWinner: null,
  };
  state.round = round;

  const g1 = getGuild(p1);
  const g2 = getGuild(p2);
  appendLog(state, { tag: 'SYS', tone: 'round', text: `${g1.name} has entered the arena.` });
  appendLog(state, { tag: 'SYS', tone: 'round', text: `${g2.name} has entered the arena.` });

  return state;
}

function buildOpponent(guildId: GuildId, x: number, humanOpponent = false): Actor {
  const a = createPlayerActor(guildId);
  a.id = 'opponent';
  a.team = 'enemy';
  // Both SP CPU and MP opponents are driven through the player-input pipeline
  // (synthesized input for CPU, real input for MP), so both flag as isPlayer
  // to keep combat / animation routing symmetric. The guild-based enemy
  // `tickAI` path in ai.ts is not used for VS opponents — it expects an
  // enemy `kind` that's absent on guild actors.
  a.isPlayer = true;
  a.x = x;
  a.facing = -1;
  a.aiState = {
    ...a.aiState,
    behavior: 'chaser',
    targetId: humanOpponent ? null : 'player',
  };
  return a;
}

/**
 * Multiplayer 1v1 VS-state factory. Produces a SimState structurally identical
 * to `createVsState(...)` but flags the opponent as human-controlled so that
 * MatchRoom routes them through `handlePlayerInput` (via the `opponentInput`
 * parameter on `tickSimulation`) instead of AI.
 *
 * Team policy per multiplayer spec:
 *   - host (slot 0) → `state.player`, team `player`
 *   - joiner (slot 1) → `state.opponent`, team `enemy`
 * Both actors are marked `isPlayer = true`.
 *
 * Note: we return a plain SimState. The caller (MatchRoom) is responsible for
 * copying these fields into the Colyseus SimStateSchema instance so that
 * Colyseus's state-sync can track mutations.
 */
export function createMpVsState(
  p1Guild: GuildId,
  p2Guild: GuildId,
  seed: number,
  stageId: string,
): SimState {
  return createVsState(p1Guild, p2Guild, stageId, seed, true);
}

const INTRO_MS = 1500;
const RESOLVED_MS = 2000;

export function tickRound(state: SimState, dtMs: number): void {
  const r = state.round;
  if (!r || r.phase === 'matchOver') return;

  r.phaseStartedAtMs += dtMs;

  if (r.phase === 'intro') {
    if (r.phaseStartedAtMs >= INTRO_MS) {
      r.phase = 'fighting';
      r.phaseStartedAtMs = 0;
      r.timeRemainingMs = ROUND_TIME_MS;
      appendLog(state, { tag: 'SYS', tone: 'round', text: `Round ${r.index + 1} — FIGHT!` });
    }
    return;
  }

  if (r.phase === 'fighting') {
    r.timeRemainingMs = Math.max(0, r.timeRemainingMs - dtMs);
    const playerDown = !state.player.isAlive || state.player.hp <= 0;
    const oppDown = !state.opponent?.isAlive || (state.opponent?.hp ?? 0) <= 0;

    if (playerDown || oppDown || r.timeRemainingMs === 0) {
      let winner: 'p1' | 'p2' | 'draw';
      if (playerDown && oppDown) winner = 'draw';
      else if (playerDown) winner = 'p2';
      else if (oppDown) winner = 'p1';
      else {
        // timer out
        const pHp = state.player.hp;
        const oHp = state.opponent?.hp ?? 0;
        if (pHp > oHp) winner = 'p1';
        else if (oHp > pHp) winner = 'p2';
        else winner = 'draw';
      }
      r.winnerOfRound = winner;
      if (winner === 'p1') r.wins.p1++;
      if (winner === 'p2') r.wins.p2++;
      const label = winner === 'draw' ? 'DRAW' : (winner === 'p1' ? 'P1 WINS' : 'P2 WINS');
      appendLog(state, { tag: 'SYS', tone: 'round', text: `Round ${r.index + 1} — ${label}` });
      r.phase = 'resolved';
      r.phaseStartedAtMs = 0;
    }
    return;
  }

  if (r.phase === 'resolved') {
    if (r.phaseStartedAtMs < RESOLVED_MS) return;

    const matchOver =
      r.wins.p1 >= 2 ||
      r.wins.p2 >= 2 ||
      r.index >= 2;

    if (matchOver) {
      let winner: 'p1' | 'p2' | 'draw';
      if (r.wins.p1 > r.wins.p2) winner = 'p1';
      else if (r.wins.p2 > r.wins.p1) winner = 'p2';
      else winner = 'draw';
      r.matchWinner = winner;
      r.phase = 'matchOver';
      state.phase = winner === 'p1' ? 'victory' : 'defeat';
      return;
    }

    r.index = (r.index + 1) as 0 | 1 | 2;
    r.phase = 'intro';
    r.phaseStartedAtMs = 0;
    r.timeRemainingMs = ROUND_TIME_MS;
    r.winnerOfRound = null;
    resetActorsForRound(state);
  }
}

export function resetActorsForRound(state: SimState): void {
  if (!state.opponent) return;
  resetActorState(state.player);
  resetActorState(state.opponent);
  randomizeRespawnPositions(state, state.player, state.opponent);
}

const RESPAWN_HALF_SPAN = 250;  // half the nominal gap between respawn points
const RESPAWN_JITTER_X = 120;   // ± wiggle on each x
const RESPAWN_DEPTH_MARGIN = 30;
const MIN_X_FROM_EDGE = 40;

/**
 * Scatter both fighters around the centre of the previous encounter rather
 * than leaving them at their KO positions — prevents the "one fighter spawns
 * in the corner next round" feel and keeps rematches interesting. Determinism
 * is preserved via state.rng().
 */
function randomizeRespawnPositions(state: SimState, p1: Actor, p2: Actor): void {
  const center = Math.max(
    MIN_X_FROM_EDGE + RESPAWN_HALF_SPAN,
    Math.min(WORLD_WIDTH - MIN_X_FROM_EDGE - RESPAWN_HALF_SPAN, (p1.x + p2.x) / 2),
  );

  // Random side assignment so the "left fighter" isn't always P1.
  const p1OnLeft = state.rng() < 0.5;
  const p1Side = p1OnLeft ? -1 : 1;
  const p2Side = -p1Side;

  const jitter = (): number => (state.rng() - 0.5) * 2 * RESPAWN_JITTER_X;

  const depthRange = GROUND_Y_MAX - GROUND_Y_MIN - 2 * RESPAWN_DEPTH_MARGIN;

  p1.x = clampX(center + p1Side * RESPAWN_HALF_SPAN + jitter());
  p2.x = clampX(center + p2Side * RESPAWN_HALF_SPAN + jitter());
  p1.y = GROUND_Y_MIN + RESPAWN_DEPTH_MARGIN + state.rng() * depthRange;
  p2.y = GROUND_Y_MIN + RESPAWN_DEPTH_MARGIN + state.rng() * depthRange;
  p1.facing = p2.x >= p1.x ? 1 : -1;
  p2.facing = p1.facing === 1 ? -1 : 1;
}

function clampX(x: number): number {
  return Math.max(MIN_X_FROM_EDGE, Math.min(WORLD_WIDTH - MIN_X_FROM_EDGE, x));
}

function resetActorState(a: Actor): void {
  a.hp = a.hpMax;
  a.hpDark = a.hpMax;
  a.mp = getGuild(a.guildId!).resource.startValue;
  a.mpMax = getGuild(a.guildId!).resource.max;
  a.statusEffects = [];
  a.abilityCooldowns.clear();
  a.rmbCooldown = 0;
  a.comboHits = 0;
  a.knockdownTimeMs = 0;
  a.getupTimeMs = 0;
  a.invulnerableMs = 0;
  a.heldPickup = null;
  a.vx = 0;
  a.vy = 0;
  a.vz = 0;
  a.z = 0;
  a.state = 'idle';
  a.stateTimeMs = 0;
  a.animationId = 'idle';
  a.animationFrame = 0;
  a.animationTimeMs = 0;
  a.isAlive = true;
  a.deathTimeMs = 0;
  a.chiOrbs = 0;
  a.sanity = 0;
  a.bloodtally = 0;
  a.shapeshiftForm = 'none';
  a.miasmaActive = false;
  a.nocturneActive = false;
}
