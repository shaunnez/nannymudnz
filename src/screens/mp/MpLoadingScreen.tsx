import { useEffect } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import type { GuildId } from '@nannymud/shared/simulation/types';
import type { StageId } from '../../data/stages';
import { LoadingScreen } from '../LoadingScreen';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onPhaseChange: (phase: MatchPhase) => void;
}

/**
 * Renders during `phase === 'loading'`. Sends `ready_to_start` once to the
 * server so the MatchRoom can kick off the simulation; the server transitions
 * to `in_game` once both clients have signalled and we bounce via
 * usePhaseBounce.
 */
export function MpLoadingScreen({ room, onPhaseChange }: Props) {
  const state = useMatchState(room);

  usePhaseBounce(state?.phase ?? 'loading', 'loading', onPhaseChange);

  useEffect(() => {
    // Fire once per mount. Server ignores duplicates (readyToStart is a Set).
    room.send('ready_to_start', {});
  }, [room]);

  if (!state) return <MpLoading />;

  const { localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);
  const p1 = (localSlot?.guildId as GuildId | undefined) ?? 'adventurer';
  const p2 = (opponentSlot?.guildId as GuildId | undefined) ?? 'knight';
  const stageId = (state.stageId || 'assembly') as StageId;

  return <LoadingScreen p1={p1} p2={p2} stageId={stageId} showOpponent />;
}
