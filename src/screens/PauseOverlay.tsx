import { useEffect, useState } from 'react';
import { theme } from '../ui';

interface MenuItem {
  label: string;
  sub: string;
  fn?: () => void;
  primary?: boolean;
  bad?: boolean;
  disabled?: boolean;
}

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onMoveList?: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit, onMoveList }: Props) {
  const items: MenuItem[] = [
    { label: 'RESUME', sub: 'return to combat', fn: onResume, primary: true },
    { label: 'RESTART', sub: 'reset current match', fn: onRestart },
    { label: 'SETTINGS', sub: 'controls · audio · video', disabled: true },
    { label: 'MOVE LIST', sub: 'your guild reference', fn: onMoveList, disabled: !onMoveList },
    { label: 'QUIT TO MENU', sub: 'abandon match', fn: onQuit, bad: true },
  ];

  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < items.length; i++) {
            next = (next + 1) % items.length;
            if (!items[next].disabled) return next;
          }
          return s;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < items.length; i++) {
            next = (next - 1 + items.length) % items.length;
            if (!items[next].disabled) return next;
          }
          return s;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[sel];
        if (item.disabled || !item.fn) return;
        item.fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 460,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          padding: 36,
          position: 'relative',
          fontFamily: theme.fontBody,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 3,
          }}
        >
          P · RESUME
        </div>
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.inkMuted,
            letterSpacing: 4,
            marginBottom: 4,
          }}
        >
          II PAUSED
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 44,
            color: theme.ink,
            letterSpacing: '-0.02em',
            marginBottom: 24,
          }}
        >
          Hold the line.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((m, i) => {
            const active = i === sel;
            const labelColor = m.disabled
              ? theme.inkMuted
              : m.primary
                ? theme.accent
                : m.bad
                  ? theme.bad
                  : theme.ink;
            return (
              <div
                key={m.label}
                onMouseEnter={() => { if (!m.disabled) setSel(i); }}
                onClick={() => {
                  if (m.disabled || !m.fn) return;
                  m.fn();
                }}
                style={{
                  cursor: m.disabled || !m.fn ? 'default' : 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: `1px solid ${theme.lineSoft}`,
                  opacity: m.disabled ? 0.45 : 1,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: active ? theme.accent : theme.inkMuted,
                    letterSpacing: 1,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 19,
                      color: labelColor,
                      letterSpacing: '0.01em',
                      lineHeight: 1.2,
                    }}
                  >
                    {active && !m.disabled && <span style={{ color: theme.accent, marginRight: 8 }}>▸</span>}
                    {m.label}
                    {m.disabled && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontFamily: theme.fontMono,
                          fontSize: 9,
                          color: theme.inkMuted,
                          letterSpacing: 2,
                        }}
                      >
                        — SOON
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fontBody,
                      fontSize: 11,
                      color: theme.inkMuted,
                      marginTop: 2,
                    }}
                  >
                    {m.sub}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: active && !m.disabled ? theme.accent : theme.inkMuted,
                  }}
                >
                  →
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
