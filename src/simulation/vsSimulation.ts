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
  a.abilityCooldowns = {};
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
