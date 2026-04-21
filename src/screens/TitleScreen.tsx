import { useEffect, useState } from 'react';
import { theme } from '../ui';

interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Any non-modifier key starts. F is reserved for fullscreen in ScalingFrame.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') return;
      onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const cursor = tick % 2 === 0 ? '▌' : ' ';

  return (
    <div
      onClick={onStart}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        LYSATOR · LINKÖPING · EST. 1990 · BUILD 0.4.2
      </div>
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        FAN PROTOTYPE · NON-COMMERCIAL
      </div>

      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.inkMuted,
            letterSpacing: 6,
            marginBottom: 14,
          }}
        >
          THE FIFTEEN GUILDS PRESENT
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 140,
            lineHeight: 0.9,
            color: theme.ink,
            letterSpacing: '-0.04em',
            fontWeight: 600,
          }}
        >
          NANNYMUD
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontStyle: 'italic',
            fontSize: 34,
            color: theme.accent,
            marginTop: -6,
            letterSpacing: '0.02em',
          }}
        >
          // Little Fighter of Lysator
        </div>

        <div
          style={{
            marginTop: 60,
            fontFamily: theme.fontMono,
            fontSize: 12,
            color: theme.inkDim,
            letterSpacing: 3,
          }}
        >
          <span
            style={{
              cursor: 'pointer',
              borderBottom: `1px dashed ${theme.accent}`,
              color: theme.accent,
              paddingBottom: 3,
            }}
          >
            PRESS START{cursor}
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 48,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>15 GUILDS</span>
        <span>·</span>
        <span>136 QUESTS</span>
        <span>·</span>
        <span>50,000 ROOMS</span>
        <span>·</span>
        <span>SINCE APRIL 20</span>
      </div>
    </div>
  );
}
