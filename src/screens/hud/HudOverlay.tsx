import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState } from '@nannymud/shared/simulation/types';
import { HudTopBar } from './HudTopBar';
import { HudFooter } from './HudFooter';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../../game/constants';

interface Props {
  game: Phaser.Game | null;
  stageName: string;
  animate: boolean;
  showLog: boolean;
  /** True in multiplayer. Gates the p1/p2 swap below. */
  inMp?: boolean;
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
  inMp = false,
  localSessionId,
  hostSessionId,
}: Props) {
  const stateRef = useRef<SimState | null>(null);
  const [, setTick] = useState(0);

  // Scale the HUD to match Phaser's virtual-pixel coordinate system. The
  // React overlay and the Phaser canvas share the same 16:9 letterboxed
  // parent; rendering HUD children inside a VIRTUAL_WIDTH × VIRTUAL_HEIGHT
  // inner frame and scaling uniformly keeps bars, text, and card sizes in
  // exact lockstep with the game viewport at any display resolution.
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // The frame is 16:9 (aspectRatio in ScalingFrame), so scaling by width
      // is sufficient; height will match within a rounding pixel.
      setScale(rect.width / VIRTUAL_WIDTH);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!game) return;
    const onTick = (state: SimState) => {
      stateRef.current = state;
      setTick((n) => (n + 1) & 0xffff);
    };
    // Subscribe on game.events (always alive) rather than scene.events — the
    // Gameplay scene may not have started yet when this effect runs, and a
    // missed subscription leaves the HUD blank until page refresh.
    game.events.on('sim-tick', onTick);
    return () => {
      game.events.off('sim-tick', onTick);
    };
  }, [game]);

  const state = stateRef.current;
  if (!state || state.mode !== 'vs' || !state.opponent) return null;

  // In MP, defer the first HUD render until both sessionIds are known so we
  // don't flicker guests onto the host's side of the bar for one frame.
  if (inMp && (!localSessionId || !hostSessionId)) return null;

  // Server convention: host's char is state.player, guest's is state.opponent.
  // In SP VS, local is always state.player. In MP, show the local player on
  // the left regardless of which schema slot they occupy.
  const localIsHost = inMp && localSessionId === hostSessionId;
  const p1 = inMp && !localIsHost ? state.opponent : state.player;
  const p2 = inMp && !localIsHost ? state.player : state.opponent;

  return (
    <div
      ref={frameRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: VIRTUAL_WIDTH,
          height: VIRTUAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
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
    </div>
  );
}
