import { useEffect } from 'react';
import type { MatchPhase } from '@nannymud/shared';

/**
 * Each MP screen corresponds to a single MatchPhase. When the server drives
 * the phase off of `expected`, tell the parent so it can swap screens.
 */
export function usePhaseBounce(
  currentPhase: MatchPhase,
  expected: MatchPhase,
  onPhaseChange: (phase: MatchPhase) => void,
): void {
  useEffect(() => {
    if (currentPhase !== expected) onPhaseChange(currentPhase);
  }, [currentPhase, expected, onPhaseChange]);
}
