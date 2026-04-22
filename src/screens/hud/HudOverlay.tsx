import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState } from '@nannymud/shared/simulation/types';
import { HudTopBar } from './HudTopBar';
import { HudFooter } from './HudFooter';

interface Props {
  game: Phaser.Game | null;
  stageName: string;
  animate: boolean;
  showLog: boolean;
  /** MP-only: local client's sessionId. Used to pick which actor is rendered
   *  on the left side of the HUD. Undefined in SP VS. */
  localSessionId?: string;
  /** MP-only: the server's host sessionId. Host's actor is `state.player`. */
  hostSessionId?: string;
}

export function HudOverlay({
  game,
  stageName,
  animate,
  showLog,
  localSessionId,
  hostSessionId,
}: Props) {
  const stateRef = useRef<SimState | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!game) return;
    const onTick = (state: SimState) => {
      stateRef.current = state;
      setTick((n) => (n + 1) & 0xffff);
    };
    const scene = game.scene.getScene('Gameplay');
    if (!scene) return;
    scene.events.on('sim-tick', onTick);
    return () => {
      scene.events.off('sim-tick', onTick);
    };
  }, [game]);

  const state = stateRef.current;
  if (!state || state.mode !== 'vs' || !state.opponent) return null;

  // Server convention: host's char is state.player, guest's is state.opponent.
  // In SP VS, local is always state.player. In MP, show the local player on
  // the left regardless of which schema slot they occupy.
  const localIsHost =
    !!localSessionId && !!hostSessionId && localSessionId === hostSessionId;
  const inMp = !!localSessionId && !!hostSessionId;
  const p1 = inMp && !localIsHost ? state.opponent : state.player;
  const p2 = inMp && !localIsHost ? state.player : state.opponent;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <HudTopBar
        p1={p1}
        p2={p2}
        round={state.round}
        stageName={stageName}
        animate={animate}
      />
      <HudFooter
        p1={p1}
        p2={p2}
        log={state.combatLog}
        showLog={showLog}
        simTimeMs={state.timeMs}
      />
    </div>
  );
}
