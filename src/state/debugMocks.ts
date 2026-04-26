import type { ActorMatchStats, MatchStats, BattleSlot, BattStatEntry } from '@nannymud/shared/simulation/types';
import type { ChampionshipState } from './championship';
import { initChampionship, advanceBracket } from './championship';

export function mockMatchStats(p1Wins = true): MatchStats {
  const winner: ActorMatchStats = {
    damageDealt: 1240,
    damageTaken: 380,
    abilitiesCast: 18,
    maxCombo: 9,
    critHits: 4,
    totalHits: 44,
    healingDone: 80,
    _comboRun: 0,
    killingBlowAbilityId: null,
  };
  const loser: ActorMatchStats = {
    damageDealt: 590,
    damageTaken: 1240,
    abilitiesCast: 11,
    maxCombo: 4,
    critHits: 1,
    totalHits: 27,
    healingDone: 20,
    _comboRun: 0,
    killingBlowAbilityId: null,
  };
  return { p1: p1Wins ? winner : loser, p2: p1Wins ? loser : winner };
}

export function mockBattStats(slots: BattleSlot[], playerWon: boolean): Record<string, BattStatEntry> {
  const out: Record<string, BattStatEntry> = {};
  let cpuIdx = 0;
  let firstHuman = true;
  for (const s of slots) {
    if (s.type === 'off') continue;
    const isPlayer = s.type === 'human' && firstHuman;
    if (isPlayer) firstHuman = false;
    const key = isPlayer ? 'player' : `battle_${cpuIdx++}`;
    out[key] = {
      kills: isPlayer && playerWon ? 4 : isPlayer ? 1 : 2,
      deaths: isPlayer && playerWon ? 1 : isPlayer ? 3 : 1,
      dmgDealt: isPlayer && playerWon ? 2400 : isPlayer ? 800 : 1200,
      healing: isPlayer ? 150 : 50,
    };
  }
  return out;
}

export function mockChampionshipState(advanceRounds: number, playerWon: boolean): ChampionshipState {
  let state = initChampionship('adventurer', 12345);
  for (let r = 0; r < advanceRounds; r++) {
    state = advanceBracket(state, true);
  }
  if (!playerWon) {
    state = advanceBracket(state, false);
  }
  return state;
}
