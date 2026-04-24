import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';

// ── Types ──────────────────────────────────────────────────────────

export interface BracketMatch {
  p1: GuildId;
  p2: GuildId;
  winner: GuildId | null;
}

export interface BracketRound {
  matches: BracketMatch[];
}

export interface ChampMatchResult {
  round: 0 | 1 | 2;
  opponentGuildId: GuildId;
  playerWon: boolean;
}

export interface ChampionshipState {
  playerGuildId: GuildId;
  participants: GuildId[];
  rounds: BracketRound[];
  currentRound: 0 | 1 | 2;
  playerEliminated: boolean;
  matchHistory: ChampMatchResult[];
  seed: number;
}

// ── Seeded PRNG ────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Auto-simulation ────────────────────────────────────────────────

function statScore(guildId: GuildId): number {
  const g = GUILDS.find(x => x.id === guildId);
  if (!g) return 0;
  const abilityDmg = g.abilities.reduce((sum: number, a) => sum + (a.baseDamage ?? 0), 0);
  return g.hpMax + g.armor + g.magicResist + g.moveSpeed * 10 + abilityDmg;
}

export function simulateCpuMatch(
  p1: GuildId,
  p2: GuildId,
  rng: () => number,
): GuildId {
  const s1 = statScore(p1);
  const s2 = statScore(p2);
  const p1WinChance = s1 / (s1 + s2);
  return rng() < p1WinChance ? p1 : p2;
}

// ── Bracket helpers ────────────────────────────────────────────────

function buildQfMatches(participants: GuildId[]): BracketMatch[] {
  return [
    { p1: participants[0], p2: participants[1], winner: null },
    { p1: participants[2], p2: participants[3], winner: null },
    { p1: participants[4], p2: participants[5], winner: null },
    { p1: participants[6], p2: participants[7], winner: null },
  ];
}

function buildNextRoundMatches(prevRound: BracketRound): BracketMatch[] {
  const winners = prevRound.matches.map(m => m.winner!);
  const matches: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({ p1: winners[i], p2: winners[i + 1], winner: null });
  }
  return matches;
}

// ── Public API ─────────────────────────────────────────────────────

export function initChampionship(playerGuildId: GuildId, seed: number): ChampionshipState {
  const rng = mulberry32(seed);

  const pool = GUILDS.map(g => g.id as GuildId).filter(id => id !== playerGuildId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cpuGuilds = pool.slice(0, 7);

  const playerPos = Math.floor(rng() * 8);
  const allGuilds: GuildId[] = [];
  let cpuIdx = 0;
  for (let i = 0; i < 8; i++) {
    allGuilds.push(i === playerPos ? playerGuildId : cpuGuilds[cpuIdx++]);
  }

  const qfMatches = buildQfMatches(allGuilds);
  qfMatches.forEach(m => {
    const hasPlayer = m.p1 === playerGuildId || m.p2 === playerGuildId;
    if (!hasPlayer) {
      m.winner = simulateCpuMatch(m.p1, m.p2, rng);
    }
  });

  return {
    playerGuildId,
    participants: allGuilds,
    rounds: [
      { matches: qfMatches },
      { matches: [] },
      { matches: [] },
    ],
    currentRound: 0,
    playerEliminated: false,
    matchHistory: [],
    seed,
  };
}

export function getPlayerMatch(state: ChampionshipState): BracketMatch {
  // When no matches have been played yet (matchHistory empty) return the
  // pending QF match (round 0). After a match is played, return the most
  // recently completed player match so callers can inspect the result.
  const lastPlayed = state.matchHistory[state.matchHistory.length - 1];
  const roundIndex = lastPlayed != null ? lastPlayed.round : state.currentRound;
  return state.rounds[roundIndex].matches.find(
    m => m.p1 === state.playerGuildId || m.p2 === state.playerGuildId,
  )!;
}

export function getOpponent(state: ChampionshipState): GuildId {
  const match = getPlayerMatch(state);
  return match.p1 === state.playerGuildId ? match.p2 : match.p1;
}

export function advanceBracket(
  state: ChampionshipState,
  playerWon: boolean,
): ChampionshipState {
  const rng = mulberry32(state.seed + state.currentRound * 1000);
  const next: ChampionshipState = {
    ...state,
    rounds: state.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })),
    matchHistory: [...state.matchHistory],
  };

  const pm = getPlayerMatch(next);
  const opponent = next.playerGuildId === pm.p1 ? pm.p2 : pm.p1;
  pm.winner = playerWon ? next.playerGuildId : opponent;

  next.matchHistory.push({
    round: next.currentRound as 0 | 1 | 2,
    opponentGuildId: opponent,
    playerWon,
  });

  if (!playerWon) {
    next.playerEliminated = true;
    // Auto-sim remaining rounds so bracket is fully resolved for display
    for (let r = next.currentRound; r < 3; r++) {
      const round = next.rounds[r];
      round.matches.forEach(m => {
        if (m.winner === null) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
      });
      if (r < 2) {
        next.rounds[r + 1].matches = buildNextRoundMatches(round);
        next.rounds[r + 1].matches.forEach(m => {
          m.winner = simulateCpuMatch(m.p1, m.p2, rng);
        });
      }
    }
    return next;
  }

  // Auto-sim remaining matches in current round
  const currentRound = next.rounds[next.currentRound];
  currentRound.matches.forEach(m => {
    if (m.winner === null) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
  });

  // Build next round
  const nextRoundIndex = next.currentRound + 1;
  if (nextRoundIndex < 3) {
    next.rounds[nextRoundIndex].matches = buildNextRoundMatches(currentRound);
    // Auto-sim non-player matches in next round
    next.rounds[nextRoundIndex].matches.forEach(m => {
      const hasPlayer = m.p1 === next.playerGuildId || m.p2 === next.playerGuildId;
      if (!hasPlayer) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
    });
  }

  next.currentRound = (next.currentRound + 1) as 0 | 1 | 2;
  return next;
}
