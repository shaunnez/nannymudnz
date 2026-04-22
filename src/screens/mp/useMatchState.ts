import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { MatchState } from '@nannymud/shared';

/**
 * Subscribes to a Colyseus Room<MatchState> and triggers a re-render on every
 * server patch. The state reference returned is the same mutable object that
 * Colyseus patches in-place — callers can safely read `state.players.get(...)`.
 */
export function useMatchState(room: Room<MatchState>): MatchState {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const off = room.onStateChange(() => setVersion((v) => v + 1));
    return () => {
      off();
    };
  }, [room]);

  return room.state;
}
