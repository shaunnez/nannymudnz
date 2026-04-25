import type { SimState, GuildId, BattleSlot, BattStatEntry } from './types';
import { createInitialState, createPlayerActor } from './simulation';
import { PLAYER_SPAWN_X, PLAYER_SPAWN_Y } from './constants';

const BATTLE_TIMER_MS = 180_000;
const ENEMY_SPAWN_START_OFFSET = 400;
const ENEMY_SPAWN_SPACING = 250;

// eslint-disable-next-line no-restricted-globals -- seed chosen once at boot
export function createBattleState(
  humanGuildId: GuildId,
  slots: BattleSlot[],
  _stageId: string,
  seed: number = Date.now(),
  difficulty = 2,
): SimState {
  const state = createInitialState(humanGuildId, seed);

  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  state.battleMode = true;
  state.battleSlots = slots;
  state.battleTimer = BATTLE_TIMER_MS;
  state.battleDifficulty = difficulty;
  state.battStats = { [state.player.id]: makeEmptyBattStat() };

  // Assign battleTeam to the human player from their slot.
  const humanSlot = slots.find((s) => s.type === 'human');
  if (humanSlot) state.player.battleTeam = humanSlot.team ?? undefined;

  const cpuSlots = slots.filter((s) => s.type === 'cpu');
  for (let i = 0; i < cpuSlots.length; i++) {
    const slot = cpuSlots[i];
    const actor = createPlayerActor(slot.guildId);
    actor.id = `battle_${state.nextActorId++}`;
    actor.team = 'enemy';
    actor.isPlayer = true;
    actor.battleTeam = slot.team ?? undefined;
    actor.x = PLAYER_SPAWN_X + ENEMY_SPAWN_START_OFFSET + i * ENEMY_SPAWN_SPACING;
    actor.y = PLAYER_SPAWN_Y + ((i % 3) - 1) * 40;
    actor.facing = -1;
    actor.aiState = { ...actor.aiState, behavior: 'chaser', targetId: 'player' };
    state.enemies.push(actor);
    state.battStats[actor.id] = makeEmptyBattStat();
  }

  return state;
}

function makeEmptyBattStat(): BattStatEntry {
  return { kills: 0, deaths: 0, dmgDealt: 0, healing: 0 };
}

/**
 * MP variant: creates actors for ALL active human slots (not just the first).
 * Returns the state and a mapping from slot index → actor ID so the server
 * can route per-client inputs to the correct actor.
 */
export function createMpBattleState(
  slots: BattleSlot[],
  _stageId: string,
  seed: number,
  difficulty = 2,
): { state: SimState; actorIdBySlotIndex: Record<number, string> } {
  const firstHumanIdx = slots.findIndex((s) => s.type === 'human');
  if (firstHumanIdx === -1) throw new Error('MP Battle requires at least one human slot');

  const firstHuman = slots[firstHumanIdx];
  // eslint-disable-next-line no-restricted-globals -- seed chosen once at startMatch
  const state = createInitialState(firstHuman.guildId as GuildId, seed);

  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  state.battleMode = true;
  state.battleSlots = slots.filter((s) => s.type !== 'off');
  state.battleTimer = BATTLE_TIMER_MS;
  state.battleDifficulty = difficulty;
  state.battStats = {};

  const actorIdBySlotIndex: Record<number, string> = {};

  // Slot 0 (first human) → state.player
  state.player.battleTeam = firstHuman.team ?? undefined;
  state.battStats[state.player.id] = makeEmptyBattStat();
  actorIdBySlotIndex[firstHumanIdx] = state.player.id;

  let spawnOffset = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.type === 'off') continue;
    if (i === firstHumanIdx) continue; // already state.player

    const actor = createPlayerActor(slot.guildId as GuildId);
    actor.id = slot.type === 'human' ? `mp_human_${i}` : `battle_${state.nextActorId++}`;
    actor.team = 'enemy';
    actor.isPlayer = true;
    actor.battleTeam = slot.team ?? undefined;
    actor.x = PLAYER_SPAWN_X + ENEMY_SPAWN_START_OFFSET + spawnOffset * ENEMY_SPAWN_SPACING;
    actor.y = PLAYER_SPAWN_Y + ((spawnOffset % 3) - 1) * 40;
    actor.facing = -1;
    if (slot.type === 'cpu') {
      actor.aiState = { ...actor.aiState, behavior: 'chaser', targetId: 'player' };
    } else {
      // Human-type: no AI — driven by extraInputs in tick; clear the default chaser behavior
      actor.aiState = { ...actor.aiState, behavior: 'none', targetId: null };
    }
    // Human-type actors have no AI — driven by extraInputs in tick
    state.enemies.push(actor);
    state.battStats[actor.id] = makeEmptyBattStat();
    actorIdBySlotIndex[i] = actor.id;
    spawnOffset++;
  }

  return { state, actorIdBySlotIndex };
}
