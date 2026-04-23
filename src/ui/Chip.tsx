import type { ReactNode } from 'react';
import { theme } from './theme';

type ChipTone = 'default' | 'accent' | 'bad' | 'good' | 'warn';

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  mono?: boolean;
}

const TONES: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
  default: { bg: theme.panelRaised, fg: theme.inkDim, bd: theme.line },
  accent:  { bg: 'transparent',     fg: theme.accent, bd: theme.accent },
  bad:     { bg: 'transparent',     fg: theme.bad,    bd: theme.bad },
  good:    { bg: 'transparent',     fg: theme.good,   bd: theme.good },
  warn:    { bg: 'transparent',     fg: theme.warn,   bd: theme.warn },
};

export function Chip({ children, tone = 'default', mono = false }: ChipProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        border: `1px solid ${t.bd}`,
        color: t.fg,
        background: t.bg,
        fontFamily: mono ? theme.fontMono : theme.fontBody,
        fontSize: 14,
        letterSpacing: mono ? 1 : 0,
        textTransform: mono ? 'uppercase' : 'none',
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}
