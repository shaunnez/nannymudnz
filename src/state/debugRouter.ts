import type { AppScreen, GameMode } from './useAppState';
import type { GuildId, BattleSlot, MatchStats, BattStatEntry } from '@nannymud/shared/simulation/types';
import type { ChampionshipState } from './championship';
import type { StageId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { mockMatchStats, mockBattStats, mockChampionshipState } from './debugMocks';

const VALID_SCREENS: AppScreen[] = [
  'title', 'menu', 'charselect', 'battleconfig', 'battresults', 'stage', 'game',
  'results', 'moves', 'guild_dossier', 'settings', 'mp_hub', 'mp_lobby', 'mp_cs',
  'mp_stage', 'mp_load', 'mp_battle', 'mp_battle_config', 'mp_results', 'survresults',
  'champbracket', 'champtransition', 'champresults',
];

const VALID_MODES: GameMode[] = ['vs', 'stage', 'surv', 'batt', 'champ'];

const VALID_STAGES: StageId[] = [
  'assembly', 'market', 'kitchen', 'tower', 'grove', 'catacombs', 'throne', 'docks', 'rooftops',
];

const ALL_GUILDS = GUILDS.map((g) => g.id as GuildId);

export interface DebugIntent {
  screen: AppScreen;
  mode?: GameMode;
  p1?: GuildId;
  p2?: GuildId;
  stageId?: StageId;
  winner?: 'P1' | 'P2';
  score?: number;
  outcome?: 'win' | 'lose';
  battleSlots?: BattleSlot[];
  champRound?: number;
  survScore?: number;
  survWave?: number;
  guildId?: GuildId;
}

// Subset of AppState fields that the debug router can populate.
// Must remain compatible with Partial<AppState> — all keys must exist in AppState.
interface DebugStateFields {
  p1?: GuildId;
  p2?: GuildId;
  stageId?: StageId;
  mode?: GameMode;
  winner?: 'P1' | 'P2' | null;
  battleSlots?: BattleSlot[];
  survivalScore?: number;
  survivalWave?: number;
  championshipState?: ChampionshipState | null;
  guildId?: GuildId;
}

export interface DebugResult {
  screen: AppScreen;
  stateFields: DebugStateFields;
  finalScore?: number;
  finalMatchStats?: MatchStats | null;
  battlePlayerWon?: boolean;
  finalBattStats?: Record<string, BattStatEntry> | null;
  champPrevRound?: 0 | 1 | 2;
  champPlayerWon?: boolean;
}

function buildDefaultBattleSlots(humanGuildId: GuildId): BattleSlot[] {
  const others = ALL_GUILDS.filter((id) => id !== humanGuildId);
  return [
    { guildId: humanGuildId,       type: 'human', team: 'A' },
    { guildId: others[0] ?? 'knight',  type: 'cpu', team: 'A' },
    { guildId: others[1] ?? 'mage',    type: 'cpu', team: 'A' },
    { guildId: others[2] ?? 'druid',   type: 'cpu', team: 'A' },
    { guildId: others[3] ?? 'hunter',  type: 'cpu', team: 'B' },
    { guildId: others[4] ?? 'monk',    type: 'cpu', team: 'B' },
    { guildId: others[5] ?? 'viking',  type: 'cpu', team: 'B' },
    { guildId: others[6] ?? 'prophet', type: 'cpu', team: 'B' },
  ];
}

function buildTeamSlots(teamParam: string, humanGuildId: GuildId): BattleSlot[] {
  const others = ALL_GUILDS.filter((id) => id !== humanGuildId);
  switch (teamParam) {
    case '4v4':
      return [
        { guildId: humanGuildId,           type: 'human', team: 'A' },
        { guildId: others[0] ?? 'knight',  type: 'cpu',   team: 'A' },
        { guildId: others[1] ?? 'mage',    type: 'cpu',   team: 'A' },
        { guildId: others[2] ?? 'druid',   type: 'cpu',   team: 'A' },
        { guildId: others[3] ?? 'hunter',  type: 'cpu',   team: 'B' },
        { guildId: others[4] ?? 'monk',    type: 'cpu',   team: 'B' },
        { guildId: others[5] ?? 'viking',  type: 'cpu',   team: 'B' },
        { guildId: others[6] ?? 'prophet', type: 'cpu',   team: 'B' },
      ];
    case '2v2v2v2':
      return [
        { guildId: humanGuildId,           type: 'human', team: 'A' },
        { guildId: others[0] ?? 'knight',  type: 'cpu',   team: 'A' },
        { guildId: others[1] ?? 'mage',    type: 'cpu',   team: 'B' },
        { guildId: others[2] ?? 'druid',   type: 'cpu',   team: 'B' },
        { guildId: others[3] ?? 'hunter',  type: 'cpu',   team: 'C' },
        { guildId: others[4] ?? 'monk',    type: 'cpu',   team: 'C' },
        { guildId: others[5] ?? 'viking',  type: 'cpu',   team: 'D' },
        { guildId: others[6] ?? 'prophet', type: 'cpu',   team: 'D' },
      ];
    case '2v2':
      return [
        { guildId: humanGuildId,          type: 'human', team: 'A' },
        { guildId: others[0] ?? 'knight', type: 'cpu',   team: 'A' },
        { guildId: others[1] ?? 'mage',   type: 'cpu',   team: 'B' },
        { guildId: others[2] ?? 'druid',  type: 'cpu',   team: 'B' },
      ];
    case '1v1':
      return [
        { guildId: humanGuildId,          type: 'human', team: 'A' },
        { guildId: others[0] ?? 'knight', type: 'cpu',   team: 'B' },
      ];
    default:
      return buildDefaultBattleSlots(humanGuildId);
  }
}

export function parseDebugParams(params: URLSearchParams): DebugIntent | null {
  const screenParam = params.get('screen');
  if (!screenParam) return null;
  const screen = VALID_SCREENS.find((s) => s === screenParam);
  if (!screen) return null;

  const intent: DebugIntent = { screen };

  const p1Raw = params.get('p1');
  const p2Raw = params.get('p2');
  const stageRaw = params.get('stage');
  const modeRaw = params.get('mode');
  const winnerRaw = params.get('winner');
  const outcomeRaw = params.get('outcome');
  const scoreRaw = params.get('score');
  const teamRaw = params.get('team');
  const roundRaw = params.get('round');
  const guildRaw = params.get('guild');
  const survScoreRaw = params.get('survScore');
  const survWaveRaw = params.get('survWave');

  if (p1Raw) {
    const g = ALL_GUILDS.find((id) => id === p1Raw);
    if (g) intent.p1 = g;
  }
  if (p2Raw) {
    const g = ALL_GUILDS.find((id) => id === p2Raw);
    if (g) intent.p2 = g;
  }
  if (stageRaw) {
    const s = VALID_STAGES.find((id) => id === stageRaw);
    if (s) intent.stageId = s;
  }
  if (modeRaw) {
    const m = VALID_MODES.find((id) => id === modeRaw);
    if (m) intent.mode = m;
  }
  if (winnerRaw === 'P1' || winnerRaw === 'P2') intent.winner = winnerRaw;
  if (outcomeRaw === 'win' || outcomeRaw === 'lose') intent.outcome = outcomeRaw;
  if (scoreRaw) {
    const n = parseInt(scoreRaw, 10);
    if (!isNaN(n)) intent.score = n;
  }
  if (teamRaw) {
    intent.battleSlots = buildTeamSlots(teamRaw, intent.p1 ?? 'adventurer');
  }
  if (roundRaw) {
    const r = parseInt(roundRaw, 10);
    if (!isNaN(r) && r >= 0 && r <= 3) intent.champRound = r;
  }
  if (guildRaw) {
    const g = ALL_GUILDS.find((id) => id === guildRaw);
    if (g) intent.guildId = g;
  }
  if (survScoreRaw) {
    const n = parseInt(survScoreRaw, 10);
    if (!isNaN(n)) intent.survScore = n;
  }
  if (survWaveRaw) {
    const n = parseInt(survWaveRaw, 10);
    if (!isNaN(n)) intent.survWave = n;
  }

  return intent;
}

export function buildDebugState(intent: DebugIntent): DebugResult {
  const p1: GuildId = intent.p1 ?? 'adventurer';
  const p2: GuildId = intent.p2 ?? 'knight';
  const stageId: StageId = intent.stageId ?? 'assembly';
  const mode: GameMode = intent.mode ?? 'vs';
  const p1Wins = intent.outcome !== 'lose' && intent.winner !== 'P2';

  switch (intent.screen) {
    case 'results': {
      return {
        screen: 'results',
        stateFields: { p1, p2, stageId, winner: p1Wins ? 'P1' : 'P2' },
        finalScore: intent.score ?? (p1Wins ? 42000 : 8000),
        finalMatchStats: mockMatchStats(p1Wins),
      };
    }
    case 'battresults': {
      const slots = intent.battleSlots ?? buildDefaultBattleSlots(p1);
      return {
        screen: 'battresults',
        stateFields: { p1, p2, battleSlots: slots },
        battlePlayerWon: p1Wins,
        finalBattStats: mockBattStats(slots, p1Wins),
      };
    }
    case 'survresults': {
      return {
        screen: 'survresults',
        stateFields: { p1, survivalScore: intent.survScore ?? 45600, survivalWave: intent.survWave ?? 7 },
      };
    }
    case 'champbracket': {
      return {
        screen: 'champbracket',
        stateFields: { p1, championshipState: mockChampionshipState(0, true) },
      };
    }
    case 'champtransition': {
      const round = intent.champRound ?? 1;
      const prevRound = (Math.max(0, round - 1)) as 0 | 1 | 2;
      return {
        screen: 'champtransition',
        stateFields: { p1, championshipState: mockChampionshipState(round, p1Wins) },
        champPrevRound: prevRound,
        champPlayerWon: p1Wins,
      };
    }
    case 'champresults': {
      // advanceRounds=2 is the last safe value — round index 3 doesn't exist in the rounds array.
      return {
        screen: 'champresults',
        stateFields: { p1, championshipState: mockChampionshipState(2, p1Wins) },
      };
    }
    default: {
      const stateFields: DebugStateFields = { p1, p2, stageId, mode };
      if (intent.winner) stateFields.winner = intent.winner;
      if (intent.battleSlots) stateFields.battleSlots = intent.battleSlots;
      if (intent.guildId) stateFields.guildId = intent.guildId;
      return { screen: intent.screen, stateFields };
    }
  }
}
