import { useCallback, useEffect, useState } from 'react';
import type { GuildId } from '../simulation/types';
import type { StageId } from '../data/stages';

export type GameMode = 'vs' | 'stage' | 'surv' | 'batt' | 'champ';

export type AppScreen =
  | 'title'
  | 'menu'
  | 'charselect'
  | 'team'
  | 'stage'
  | 'loading'
  | 'game'
  | 'pause'
  | 'results'
  | 'moves'
  | 'guild_dossier'
  | 'settings'
  | 'mp_hub'
  | 'mp_create'
  | 'mp_join'
  | 'mp_lobby'
  | 'mp_cs'
  | 'mp_load'
  | 'mp_battle'
  | 'mp_results';

// Placeholder shapes — batch 7 narrows these when MP mocking lands.
export type Room = { id: string; [k: string]: unknown };
export type Slot = { i: number; [k: string]: unknown };

export interface AppState {
  screen: AppScreen;
  returnTo: AppScreen | null;
  editingRoom: Room | null;

  mode: GameMode;
  p1: GuildId;
  p2: GuildId;
  p1Team: [GuildId, GuildId, GuildId];
  p2Team: [GuildId, GuildId, GuildId];
  stageId: StageId;
  guildId: GuildId;
  winner: 'P1' | 'P2' | null;

  mpRoom: Room | null;
  mpSlots: Slot[] | null;

  animateHud: boolean;
  showLog: boolean;
}

const STORAGE_KEY = 'nannymud-app-state-v1';

const DEFAULT_STATE: AppState = {
  screen: 'title',
  returnTo: null,
  editingRoom: null,
  mode: 'vs',
  p1: 'adventurer',
  p2: 'knight',
  p1Team: ['adventurer', 'knight', 'mage'],
  p2Team: ['viking', 'monk', 'druid'],
  stageId: 'assembly',
  guildId: 'adventurer',
  winner: null,
  mpRoom: null,
  mpSlots: null,
  animateHud: true,
  showLog: true,
};

const PERSISTED_KEYS: (keyof AppState)[] = [
  'mode',
  'p1',
  'p2',
  'p1Team',
  'p2Team',
  'stageId',
  'animateHud',
  'showLog',
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
