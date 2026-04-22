import type { Room } from 'colyseus.js';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GameScreen } from '../GameScreen';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';

interface Props {
  room: Room<MatchState>;
  animateHud: boolean;
  showLog: boolean;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

/**
 * Bridges the Colyseus match room into the Phaser-hosting GameScreen.
 * Derives local/opponent guilds + stage from the synced MatchState so the HUD
 * and boot config render the right characters, then hands control to GameScreen
 * which runs in `netMode === 'mp'`.
 */
export function MpBattle({ room, animateHud, showLog, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);

  usePhaseBounce(state.phase, 'in_game', onPhaseChange);

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
      showLog={showLog}
      matchRoom={room}
      onVictory={() => {
        // In MP the server drives phase transitions; victory handoff is the
        // server's job. This is a no-op — results will flow via onPhaseChange.
      }}
      onDefeat={() => {}}
      onQuit={onLeave}
    />
  );
}
