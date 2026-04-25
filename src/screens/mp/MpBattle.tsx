import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import type { GuildId, BattleSlot, BattleTeam } from '@nannymud/shared/simulation/types';
import { GameScreen } from '../GameScreen';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  animateHud: boolean;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

export function MpBattle({ room, animateHud, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);

  usePhaseBounce(state?.phase ?? 'in_game', 'in_game', onPhaseChange);

  if (!state) return <MpLoading />;

  const isBattle = state.gameMode === 'battle';

  const battleSlots: BattleSlot[] | undefined = isBattle
    ? [...state.battleSlots].map(s => ({
        guildId: (s.guildId || 'adventurer') as GuildId,
        type: s.slotType as 'human' | 'cpu' | 'off',
        team: (s.team as BattleTeam) || null,
      }))
    : undefined;

  const { localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);
  const p1 = (localSlot?.guildId as GuildId | undefined) ?? 'adventurer';
  const p2 = (opponentSlot?.guildId as GuildId | undefined) ?? 'knight';
  const stageId = state.stageId || 'assembly';

  return (
    <GameScreen
      mode="vs"
      p1={p1}
      p2={p2}
      stageId={stageId}
      animateHud={animateHud}
      matchRoom={room}
      battleMode={isBattle}
      battleSlots={battleSlots}
      onVictory={() => {}}
      onDefeat={() => {}}
      onBattleEnd={() => {}}
      onQuit={onLeave}
    />
  );
}
