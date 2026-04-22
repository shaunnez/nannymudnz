import type { SimState, GuildId, Actor, RoundState } from './types';
import { createInitialState, createPlayerActor } from './simulation';
import { appendLog } from './combatLog';
import { getGuild } from './guildData';

const OPPONENT_SPAWN_X_OFFSET = 160;
const ROUND_TIME_MS = 60_000;

export function createVsState(
  p1: GuildId,
  p2: GuildId,
  _stageId: string,
  seed: number,
): SimState {
  const state = createInitialState(p1, seed);
  state.mode = 'vs';
  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;

  const opponent = buildOpponent(p2, state.player.x + OPPONENT_SPAWN_X_OFFSET);
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

function buildOpponent(guildId: GuildId, x: number): Actor {
  const a = createPlayerActor(guildId);
  a.id = 'opponent';
  a.team = 'enemy';
  a.isPlayer = false;
  a.x = x;
  a.facing = -1;
  a.aiState = {
    ...a.aiState,
    behavior: 'chaser',
    targetId: 'player',
  };
  return a;
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
