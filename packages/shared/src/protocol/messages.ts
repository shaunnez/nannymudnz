import type { InputState } from '../simulation/types';

export type InputEvent =
  | { type: 'attackDown'; tMs: number }
  | { type: 'attackUp'; tMs: number }
  | { type: 'jumpDown'; tMs: number }
  | { type: 'blockDown'; tMs: number }
  | { type: 'grabDown'; tMs: number }
  | { type: 'abilityDown'; key: string; tMs: number };

export interface InputMsg {
  sequenceId: number;
  state: InputState;
  events: InputEvent[];
}

export interface LockGuildMsg { type: 'lock_guild'; guildId: string; }
export interface ReadyToggleMsg { type: 'ready_toggle'; ready: boolean; }
export interface PickStageMsg { type: 'pick_stage'; stageId: string; }
export interface LaunchBattleMsg { type: 'launch_battle'; }
export interface ReadyToStartMsg { type: 'ready_to_start'; }
export interface RematchOfferMsg { type: 'rematch_offer'; }
export interface RematchAcceptMsg { type: 'rematch_accept'; accept: boolean; }

export interface SetBattleSlotMsg {
  type: 'set_battle_slot';
  index: number;
  slotType: 'human' | 'cpu' | 'off';
  guildId: string;
  team: string;
}

export interface SetMyGuildMsg {
  type: 'set_my_guild';
  guildId: string;
}

export interface LaunchFromConfigMsg {
  type: 'launch_from_config';
}

export interface LoadProgressMsg {
  type: 'load_progress';
  value: number; // 0..1
}
