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
): SimState {
  const state = createInitialState(humanGuildId, seed);

  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  state.battleMode = true;
  state.battleSlots = slots;
  state.battleTimer = BATTLE_TIMER_MS;
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
