import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, PlayerSlot } from '@nannymud/shared';

/**
 * Subscribes to a Colyseus Room<MatchState> and triggers a re-render on every
 * server patch. Returns `null` until the first state sync has decoded the
 * MapSchema fields — @colyseus/sdk@0.17 does NOT populate `room.state.players`
 * eagerly on create/join, only after the first patch arrives. Callers must
 * early-return a loading skeleton while null.
 */
export function useMatchState(room: Room<MatchState>): MatchState | null {
  // Colyseus mutates `room.state` in-place, so we can't store the object in
  // useState (reference equality would bail out on every patch). Instead,
  // keep a version counter that bumps on every state change, and return
  // room.state on render — it's the same mutable object Colyseus patches.
  const [, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    room.onStateChange(handler);
    return () => {
      room.onStateChange.remove(handler);
    };
  }, [room]);

  return isReady(room.state as MatchState | undefined) ? (room.state as MatchState) : null;
}

function isReady(s: MatchState | undefined): boolean {
  // MapSchema fields appear only after first decode. Use `.players` as a
  // canary — if absent, state isn't usable yet.
  return !!s && !!s.players;
}

export interface MatchSlots {
  slots: PlayerSlot[];
  localSlot: PlayerSlot | undefined;
  opponentSlot: PlayerSlot | undefined;
}

/**
 * Derives local/opponent slot views from MatchState.players. Convenience wrapper
 * for the pattern repeated in every MP screen. Accepts null to simplify render
 * paths that need to call this before the first state sync.
 */
export function getMatchSlots(state: MatchState | null, sessionId: string): MatchSlots {
  if (!state || !state.players) return { slots: [], localSlot: undefined, opponentSlot: undefined };
  const slots = Array.from(state.players.values()) as PlayerSlot[];
  return {
    slots,
    localSlot: slots.find((s) => s.sessionId === sessionId),
    opponentSlot: slots.find((s) => s.sessionId !== sessionId),
  };
}
