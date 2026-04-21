import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { theme } from './theme';
import { Btn } from './Btn';

interface ModalShellProps {
  title: string;
  kicker?: string;
  onCancel: () => void;
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  children: ReactNode;
}

export function ModalShell({ title, kicker, onCancel, primary, children }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1120,
          maxWidth: 'calc(100% - 80px)',
          maxHeight: 'calc(100% - 80px)',
          background: theme.bg,
          border: `1px solid ${theme.accent}`,
          boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 101,
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {kicker && (
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 3,
                }}
              >
                {kicker}
              </div>
            )}
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 22,
                color: theme.ink,
                letterSpacing: '-0.01em',
                marginTop: 2,
              }}
            >
              {title}
            </div>
          </div>
          <div
            onClick={onCancel}
            style={{
              cursor: 'pointer',
              fontFamily: theme.fontMono,
              fontSize: 18,
              color: theme.inkDim,
              padding: '0 8px',
            }}
          >
            ×
          </div>
        </div>
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>{children}</div>
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Btn onClick={onCancel}>CANCEL · ESC</Btn>
          {primary && (
            <Btn primary onClick={primary.onClick} disabled={primary.disabled}>
              {primary.label}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
