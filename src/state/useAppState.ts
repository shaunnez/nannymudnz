import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import type { GuildId, BattleSlot } from '@nannymud/shared/simulation/types';
import type { StageId } from '../data/stages';
import type { ChampionshipState } from './championship';

export type GameMode = 'vs' | 'stage' | 'surv' | 'batt' | 'champ';

export type AppScreen =
  | 'title'
  | 'menu'
  | 'charselect'
  | 'battleconfig'
  | 'battresults'
  | 'team'
  | 'stage'
  | 'game'
  | 'pause'
  | 'results'
  | 'moves'
  | 'guild_dossier'
  | 'settings'
  | 'mp_hub'
  | 'mp_lobby'
  | 'mp_cs'
  | 'mp_stage'
  | 'mp_load'
  | 'mp_battle'
  | 'mp_results'
  | 'survresults'
  | 'champbracket'
  | 'champtransition'
  | 'champresults';

export interface AppState {
  screen: AppScreen;
  returnTo: AppScreen | null;

  mode: GameMode;
  p1: GuildId;
  p2: GuildId;
  p1Team: [GuildId, GuildId, GuildId];
  p2Team: [GuildId, GuildId, GuildId];
  stageId: StageId;
  guildId: GuildId;
  winner: 'P1' | 'P2' | null;

  mpRoom: Room<MatchState> | null;

  animateHud: boolean;

  /** Per-mode CPU difficulty (0..5). Each is persisted independently. */
  vsDifficulty: number;
  champDifficulty: number;
  battleDifficulty: number;

  battleSlots: BattleSlot[];

  survivalScore: number;
  survivalWave: number;
  championshipState: ChampionshipState | null;
}

const STORAGE_KEY = 'nannymud-app-state-v1';

const DEFAULT_STATE: AppState = {
  screen: 'title',
  returnTo: null,
  mode: 'vs',
  p1: 'adventurer',
  p2: 'knight',
  p1Team: ['adventurer', 'knight', 'mage'],
  p2Team: ['viking', 'monk', 'druid'],
  stageId: 'assembly',
  guildId: 'adventurer',
  winner: null,
  mpRoom: null,
  animateHud: true,
  vsDifficulty: 2,
  champDifficulty: 2,
  battleDifficulty: 2,
  battleSlots: [],
  survivalScore: 0,
  survivalWave: 0,
  championshipState: null,
};

const PERSISTED_KEYS: (keyof AppState)[] = [
  'mode',
  'p1',
  'p2',
  'p1Team',
  'p2Team',
  'stageId',
  'animateHud',
  'vsDifficulty',
  'champDifficulty',
  'battleDifficulty',
];

function loadPersisted(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const picked: Partial<AppState> = {};
    for (const key of PERSISTED_KEYS) {
      if (key in parsed) {
        (picked as Record<string, unknown>)[key] = parsed[key];
      }
    }
    // Migrate old single 'difficulty' key
    if ('difficulty' in parsed && typeof parsed.difficulty === 'number') {
      const d = parsed.difficulty as number;
      if (!('vsDifficulty' in parsed)) picked.vsDifficulty = d;
      if (!('champDifficulty' in parsed)) picked.champDifficulty = d;
      if (!('battleDifficulty' in parsed)) picked.battleDifficulty = d;
    }
    return picked;
  } catch {
    return {};
  }
}

export interface AppStateActions {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  go: (screen: AppScreen, extras?: Partial<AppState>) => void;
}

export function useAppState(): AppStateActions {
  const [state, setState] = useState<AppState>(() => ({ ...DEFAULT_STATE, ...loadPersisted() }));

  useEffect(() => {
    const persisted: Partial<AppState> = {};
    for (const key of PERSISTED_KEYS) {
      (persisted as Record<string, unknown>)[key] = state[key];
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Storage full / disabled — fail quiet.
    }
  }, [state]);

  const set = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const go = useCallback((screen: AppScreen, extras?: Partial<AppState>) => {
    setState((s) => ({ ...s, screen, ...(extras ?? {}) }));
  }, []);

  return { state, set, go };
}
