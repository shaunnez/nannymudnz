import type { Actor, LogEntry } from '../../simulation/types';
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
        height: 160,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        padding: '6px 12px',
        background: theme.bg,
        borderTop: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <CombatLog entries={log} visible={showLog} />
      <AbilityStrip actor={p1} side="p1" showKeys simTimeMs={simTimeMs} />
      <AbilityStrip actor={p2} side="p2" showKeys={false} simTimeMs={simTimeMs} />
    </div>
  );
}
