import type { ReactNode, CSSProperties } from 'react';
import { theme } from './theme';

interface SectionLabelProps {
  children: ReactNode;
  kicker?: string;
  right?: ReactNode;
}

export function SectionLabel({ children, kicker, right }: SectionLabelProps) {
  const monoStyle: CSSProperties = {
    fontFamily: theme.fontMono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.inkMuted,
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: `1px solid ${theme.lineSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        {kicker && <span style={monoStyle}>{kicker}</span>}
        <span
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 16,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {children}
        </span>
      </div>
      {right && <div style={monoStyle}>{right}</div>}
    </div>
  );
}
