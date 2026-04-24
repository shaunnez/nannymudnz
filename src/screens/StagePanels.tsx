import { theme } from '../ui';
import type { StageMeta } from '../data/stages';

export interface StageTileProps {
  stage: StageMeta;
  index: number;
  active: boolean;
  isHost: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

export function StageTile({ stage, index, active, isHost, onMouseEnter, onClick }: StageTileProps) {
  const acc = `oklch(0.70 0.16 ${stage.hue})`;
  const locked = !stage.enabled;

  return (
    <div
      onMouseEnter={isHost ? onMouseEnter : undefined}
      onClick={isHost ? onClick : undefined}
      style={{
        position: 'relative',
        border: `1px solid ${active ? acc : theme.lineSoft}`,
        background: theme.panel,
        outline: active ? `1px solid ${acc}` : 'none',
        outlineOffset: 2,
        cursor: !isHost ? 'default' : locked ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'border-color 120ms ease',
      }}
    >
      {stage.preview ? (
        <img
          src={stage.preview}
          alt={stage.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            filter: active ? 'none' : 'saturate(0.85) brightness(0.88)',
            transition: 'filter 120ms ease',
          }}
        />
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(145deg, ${acc}22, ${theme.panel} 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(135deg, transparent 0 14px, ${acc}18 14px 15px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: `1px solid ${acc}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.fontMono,
                fontSize: 20,
                color: acc,
              }}
            >
              ◇
            </div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.warn, letterSpacing: 3 }}>
              COMING SOON
            </div>
          </div>
        </>
      )}

      {/* Scrim */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55%',
          background: 'linear-gradient(to top, rgba(5,7,10,0.92) 0%, rgba(5,7,10,0.55) 55%, rgba(5,7,10,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Number badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.ink,
          letterSpacing: 2,
          background: 'rgba(5,7,10,0.6)',
          padding: '2px 6px',
          border: `1px solid ${active ? acc : 'transparent'}`,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* HUE badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: acc,
          letterSpacing: 2,
          background: 'rgba(5,7,10,0.6)',
          padding: '2px 6px',
        }}
      >
        HUE {stage.hue}°
      </div>

      {/* Bottom label */}
      <div style={{ position: 'relative', padding: 16 }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 26,
            color: theme.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {stage.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: locked ? theme.warn : active ? acc : theme.inkDim,
            letterSpacing: 2,
          }}
        >
          {locked ? 'LOCKED · SOON' : active ? '◆ SELECTED' : 'READY'}
        </div>
      </div>
    </div>
  );
}

export interface StageDetailPanelProps {
  stages: StageMeta[];
  cursor: number;
  isHost: boolean;
  onHover: (idx: number) => void;
  onCommit: (idx: number) => void;
}

export function StageDetailPanel({ stages, cursor, isHost, onHover, onCommit }: StageDetailPanelProps) {
  const cur = stages[cursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.lineSoft}`,
        padding: '28px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflow: 'auto',
      }}
    >
      <div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>
          {cur.enabled ? 'AVAILABLE' : 'COMING SOON'}
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 30,
            color: theme.ink,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            marginTop: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cur.name}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          border: `1px solid ${theme.lineSoft}`,
          background: `linear-gradient(145deg, ${accent}22, ${theme.panel} 70%)`,
          overflow: 'hidden',
        }}
      >
        {cur.preview ? (
          <img
            src={cur.preview}
            alt={cur.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(135deg, transparent 0 18px, ${accent}12 18px 19px)`,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 14,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
            background: cur.preview ? 'rgba(0,0,0,0.55)' : 'transparent',
            padding: cur.preview ? '2px 6px' : 0,
          }}
        >
          {cur.preview ? cur.name.toUpperCase() : '[ stage preview ]'}
        </div>
      </div>

      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 13,
          color: theme.inkDim,
          lineHeight: 1.55,
          fontStyle: 'italic',
          minHeight: `calc(13px * 1.55 * 3)`,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {cur.blurb}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderTop: `1px solid ${theme.lineSoft}`,
        }}
      >
        {stages.map((s, i) => {
          const act = i === cursor;
          const acc = `oklch(0.70 0.16 ${s.hue})`;
          return (
            <div
              key={s.id}
              onMouseEnter={() => { if (isHost) onHover(i); }}
              onClick={() => {
                if (!isHost) return;
                if (s.enabled) onCommit(i);
                else onHover(i);
              }}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '32px 12px 1fr auto',
                gap: 14,
                alignItems: 'center',
                padding: '0 6px',
                borderBottom: `1px solid ${theme.lineSoft}`,
                borderLeft: `2px solid ${act ? acc : 'transparent'}`,
                background: act ? `${acc}10` : 'transparent',
                cursor: !isHost ? 'default' : s.enabled ? 'pointer' : 'default',
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
            >
              <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: act ? accent : theme.inkMuted, letterSpacing: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ width: 10, height: 10, background: acc, opacity: act ? 1 : s.enabled ? 0.6 : 0.25 }} />
              <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, letterSpacing: '-0.01em', color: act ? accent : s.enabled ? theme.ink : theme.inkMuted }}>
                {s.name}
              </span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: s.enabled ? (act ? accent : theme.inkMuted) : theme.warn, letterSpacing: 2 }}>
                {s.enabled ? (act ? '◆ SELECTED' : 'READY') : 'SOON'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
