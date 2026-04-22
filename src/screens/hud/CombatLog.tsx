import { useEffect, useRef } from 'react';
import type { LogEntry } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';

interface Props {
  entries: LogEntry[];
  visible: boolean;
}

const TAG_COLOR: Record<LogEntry['tag'], string> = {
  P1: theme.team1,
  P2: theme.team2,
  SYS: theme.inkDim,
};

const TONE_COLOR: Record<LogEntry['tone'], string> = {
  info: theme.ink,
  damage: theme.accent,
  ko: theme.warn,
  round: theme.ink,
};

export function CombatLog({ entries, visible }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  if (!visible) return null;

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        minWidth: 0,
        maxHeight: 148,
        overflowY: 'hidden',
        padding: '8px 10px',
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderRadius: 4,
        fontFamily: theme.fontMono,
        fontSize: 11,
        lineHeight: 1.4,
        color: theme.ink,
      }}
    >
      {entries.slice(-12).map((e) => (
        <div key={e.id}>
          <span style={{ color: TAG_COLOR[e.tag], marginRight: 6 }}>[{e.tag}]</span>
          <span style={{ color: TONE_COLOR[e.tone] }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
