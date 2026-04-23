import { useEffect } from 'react';
import { theme } from '../ui';

interface Props {
  onRematch: () => void;
  onMenu: () => void;
}

export function StoryGameOverOverlay({ onRematch, onMenu }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRematch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRematch, onMenu]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 420,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          padding: '40px 36px 32px',
          position: 'relative',
          fontFamily: theme.fontBody,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.bad,
            letterSpacing: 4,
            marginBottom: 6,
          }}
        >
          ✕ DEFEATED
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 52,
            color: theme.bad,
            letterSpacing: '-0.02em',
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          GAME OVER
        </div>
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: 13,
            color: theme.inkMuted,
            marginBottom: 32,
          }}
        >
          Your run has ended.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onRematch}
            style={{
              width: '100%',
              padding: '14px 0',
              background: theme.bad,
              border: 'none',
              color: theme.bg,
              fontFamily: theme.fontDisplay,
              fontSize: 18,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            REMATCH
          </button>
          <button
            onClick={onMenu}
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'transparent',
              border: `1px solid ${theme.line}`,
              color: theme.inkDim,
              fontFamily: theme.fontDisplay,
              fontSize: 15,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            MAIN MENU
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
          }}
        >
          ENTER · REMATCH &nbsp;&nbsp; ESC · MENU
        </div>
      </div>
    </div>
  );
}
