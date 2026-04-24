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
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          background: theme.bg,
          border: `1px solid ${theme.accent}`,
          boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 28px', borderBottom: `1px solid ${theme.lineSoft}` }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.inkMuted, letterSpacing: 3 }}>
            NANNYMUD
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 34, color: theme.ink, letterSpacing: '-0.02em', marginTop: 4 }}>
            Better as an app
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 12px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontFamily: theme.fontBody, fontSize: 19, color: theme.inkDim, lineHeight: 1.6 }}>
            Play in landscape for the best experience. For an optimal experience, save as a web app — fullscreen, no browser bar, no zoom issues.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '⋯',  text: 'Tap ⋯ or the Share button (📤) in Safari' },
              { icon: '☝️', text: 'Scroll up in the popup that appears' },
              { icon: '➕', text: 'Tap "Add to Home Screen"' },
              { icon: '✓',  text: 'Tap "Add" — done' },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '16px 18px',
                  background: theme.panel,
                  border: `1px solid ${theme.lineSoft}`,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{step.icon}</span>
                <span style={{ fontFamily: theme.fontBody, fontSize: 19, color: theme.ink, lineHeight: 1.4 }}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 28px',
            borderTop: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <button
            onClick={dismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.inkMuted,
              fontFamily: theme.fontMono,
              fontSize: 14,
              letterSpacing: 2,
              cursor: 'pointer',
              padding: '12px 0',
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
              fontSize: 16,
              letterSpacing: 3,
              cursor: 'pointer',
              padding: '16px 32px',
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
