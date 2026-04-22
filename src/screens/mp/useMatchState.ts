import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { MatchState, PlayerSlot } from '@nannymud/shared';

/**
 * Subscribes to a Colyseus Room<MatchState> and triggers a re-render on every
 * server patch. The state reference returned is the same mutable object that
 * Colyseus patches in-place — callers can safely read `state.players.get(...)`.
 */
export function useMatchState(room: Room<MatchState>): MatchState {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    room.onStateChange(handler);
    return () => {
      room.onStateChange.remove(handler);
    };
  }, [room]);

  return room.state;
}

export interface MatchSlots {
  slots: PlayerSlot[];
  localSlot: PlayerSlot | undefined;
  opponentSlot: PlayerSlot | undefined;
}

/**
 * Derives local/opponent slot views from MatchState.players. Convenience wrapper
 * for the pattern repeated in every MP screen.
 */
export function getMatchSlots(state: MatchState, sessionId: string): MatchSlots {
  const slots = Array.from(state.players.values()) as PlayerSlot[];
  return {
    slots,
    localSlot: slots.find((s) => s.sessionId === sessionId),
    opponentSlot: slots.find((s) => s.sessionId !== sessionId),
  };
}
