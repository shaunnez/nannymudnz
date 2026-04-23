import type { Actor, LogEntry } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';
import { CombatLog } from './CombatLog';
import { AbilityStrip } from './AbilityStrip';

interface Props {
  p1: Actor;
  p2: Actor;
  log: LogEntry[];
  showLog: boolean;
  simTimeMs: number;
}

export function HudFooter({ p1, p2, log, showLog, simTimeMs }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 14px 10px',
        background: theme.bg,
        borderTop: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      {showLog && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: theme.accent,
              letterSpacing: 3,
            }}
          >
            <span>▸ COMBAT LOG</span>
            <span style={{ color: theme.inkMuted }}>[P] PAUSE · [TAB] MOVES</span>
          </div>
          <CombatLog entries={log} visible={showLog} />
        </>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 14,
          marginTop: 'auto',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <AbilityStripSection actor={p1} side="p1" showKeys simTimeMs={simTimeMs} label="P1" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AbilityStripSection actor={p2} side="p2" showKeys={false} simTimeMs={simTimeMs} label="P2" />
        </div>
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
}: {
  actor: Actor;
  side: 'p1' | 'p2';
  showKeys: boolean;
  simTimeMs: number;
  label: string;
}) {
  const color = side === 'p1' ? theme.team1 : theme.team2;
  const align = side === 'p1' ? 'flex-start' : 'flex-end';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: 4 }}>
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
      <AbilityStrip actor={actor} side={side} showKeys={showKeys} simTimeMs={simTimeMs} />
    </div>
  );
}
