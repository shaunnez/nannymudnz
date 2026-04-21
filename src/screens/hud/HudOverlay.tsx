import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState } from '../../simulation/types';
import { HudTopBar } from './HudTopBar';
import { HudFooter } from './HudFooter';

interface Props {
  game: Phaser.Game | null;
  stageName: string;
  animate: boolean;
  showLog: boolean;
}

export function HudOverlay({ game, stageName, animate, showLog }: Props) {
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

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <HudTopBar
        p1={state.player}
        p2={state.opponent}
        round={state.round}
        stageName={stageName}
        animate={animate}
      />
      <HudFooter
        p1={state.player}
        p2={state.opponent}
        log={state.combatLog}
        showLog={showLog}
        simTimeMs={state.timeMs}
      />
    </div>
  );
}
