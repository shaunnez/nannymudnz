import type { Actor, SimMode, SimState } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';
import { AbilityStrip } from './AbilityStrip';
import { StoryRightPanel } from './StoryRightPanel';

interface Props {
  mode: SimMode;
  p1: Actor;
  p2: Actor | null;
  simTimeMs: number;
  state: SimState;
}

export function HudFooter({ mode, p1, p2, simTimeMs, state }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 128,
        display: 'flex',
        flexDirection: 'row',
        gap: 14,
        padding: '8px 14px 10px',
        background: theme.bg,
        borderTop: `1px solid ${theme.line}`,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <AbilityStripSection actor={p1} side="p1" showKeys simTimeMs={simTimeMs} label="P1" interactive />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {mode === 'story' ? (
          <StoryRightPanel actor={p1} simTimeMs={simTimeMs} bossSpawned={state.bossSpawned} />
        ) : p2 ? (
          <AbilityStripSection actor={p2} side="p2" showKeys={false} simTimeMs={simTimeMs} label="P2" />
        ) : null}
      </div>
    </div>
  );
}

function AbilityStripSection({
  actor,
  side,
  showKeys,
  simTimeMs,
  label,
  interactive = false,
}: {
  actor: Actor;
  side: 'p1' | 'p2';
  showKeys: boolean;
  simTimeMs: number;
  label: string;
  interactive?: boolean;
}) {
  const color = side === 'p1' ? theme.team1 : theme.team2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 10,
          letterSpacing: 3,
          color,
        }}
      >
        {label} · ABILITIES
      </div>
      <AbilityStrip actor={actor} side={side} showKeys={showKeys} simTimeMs={simTimeMs} interactive={interactive} />
    </div>
  );
}
