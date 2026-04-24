import { useState } from 'react';
import { theme } from '../ui';
import { useIsMobile } from '../hooks/useIsMobile';

const DISMISSED_KEY = 'nannymud:install-prompt-dismissed';

function isStandaloneApp(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function MobileWelcome() {
  const mobile = useIsMobile();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  );

  if (!mobile) return null;
  if (isStandaloneApp()) return null;
  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: theme.bg,
          border: `1px solid ${theme.accent}`,
          boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.lineSoft}` }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            NANNYMUD
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>
            Better as an app
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, lineHeight: 1.6 }}>
            Add to your home screen for fullscreen mode with no browser bar. You can play in portrait too, but landscape is where it's at.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📤', text: 'Tap the Share button in Safari' },
              { icon: '➕', text: 'Tap "Add to Home Screen"' },
              { icon: '✓',  text: 'Tap "Add" — done' },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 14px',
                  background: theme.panel,
                  border: `1px solid ${theme.lineSoft}`,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{step.icon}</span>
                <span style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.ink, lineHeight: 1.4 }}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={dismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.inkMuted,
              fontFamily: theme.fontMono,
              fontSize: 11,
              letterSpacing: 2,
              cursor: 'pointer',
              padding: '8px 0',
              WebkitTapHighlightColor: 'transparent' as string,
            }}
          >
            PLAY IN BROWSER
          </button>
          <button
            onClick={dismiss}
            style={{
              background: theme.accent,
              border: `1px solid ${theme.accent}`,
              color: '#000',
              fontFamily: theme.fontMono,
              fontSize: 12,
              letterSpacing: 3,
              cursor: 'pointer',
              padding: '10px 20px',
              fontWeight: 700,
              WebkitTapHighlightColor: 'transparent' as string,
            }}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
