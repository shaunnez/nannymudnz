import { useCallback, useEffect, useMemo, useState } from 'react';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/stages';
import { theme, Btn } from '../ui';

interface Props {
  initialStage: StageId;
  onBack: () => void;
  onReady: (stageId: StageId) => void;
}

const COLS = 3;
const ROWS = 3;

export function StageSelect({ initialStage, onBack, onReady }: Props) {
  const startIdx = useMemo(() => {
    const i = STAGES.findIndex((s) => s.id === initialStage);
    return i >= 0 ? i : 0;
  }, [initialStage]);
  const [cursor, setCursor] = useState(startIdx);

  const cur = STAGES[cursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;
  const canCommit = cur.enabled;

  const move = useCallback((dx: number, dy: number) => {
    setCursor((c) => {
      const r = Math.floor(c / COLS);
      const col = c % COLS;
      const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
      const nc = Math.max(0, Math.min(COLS - 1, col + dx));
      return nr * COLS + nc;
    });
  }, []);

  const commit = useCallback(() => {
    if (!canCommit) return;
    onReady(cur.id);
  }, [canCommit, cur.id, onReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, move, onBack]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '20px 36px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.lineSoft}`,
          gap: 16,
        }}
      >
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onBack}>← BACK</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            STAGE · {String(cursor + 1).padStart(2, '0')} / {String(STAGES.length).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, textAlign: 'center' }}>
            Pick the battlefield
          </span>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <Btn size="md" primary disabled={!canCommit} onClick={commit}>FIGHT →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        <div style={{ padding: 36, display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: 14 }}>
          {STAGES.map((s, i) => {
            const acc = `oklch(0.70 0.16 ${s.hue})`;
            const active = i === cursor;
            const locked = !s.enabled;
            return (
              <div
                key={s.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => { if (!locked) onReady(s.id); }}
                style={{
                  position: 'relative',
                  border: `1px solid ${active ? acc : theme.lineSoft}`,
                  background: `linear-gradient(145deg, ${acc}22, ${theme.panel} 70%)`,
                  outline: active ? `1px solid ${acc}` : 'none',
                  outlineOffset: 2,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: 16,
                  opacity: locked ? 0.55 : 1,
                  transition: 'border-color 120ms ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `repeating-linear-gradient(135deg, transparent 0 14px, ${acc}15 14px 15px)`,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 12,
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: theme.inkMuted,
                    letterSpacing: 2,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: acc,
                    letterSpacing: 2,
                  }}
                >
                  HUE {s.hue}°
                </div>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 26,
                      color: theme.ink,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.05,
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: theme.fontMono,
                      fontSize: 10,
                      color: locked ? theme.warn : theme.inkMuted,
                      letterSpacing: 2,
                    }}
                  >
                    {locked ? 'LOCKED · SOON' : active ? '◆ SELECTED' : 'READY'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
              {canCommit ? 'AVAILABLE' : 'COMING SOON'}
            </div>
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 42,
                color: theme.ink,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                marginTop: 6,
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
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `repeating-linear-gradient(135deg, transparent 0 18px, ${accent}12 18px 19px)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 14,
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 2,
              }}
            >
              [ stage preview ]
            </div>
          </div>

          <div
            style={{
              fontFamily: theme.fontBody,
              fontSize: 13,
              color: theme.inkDim,
              lineHeight: 1.55,
              fontStyle: 'italic',
            }}
          >
            {cur.blurb}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STAGES.map((s, i) => {
              const act = i === cursor;
              const acc = `oklch(0.70 0.16 ${s.hue})`;
              return (
                <div
                  key={s.id}
                  onClick={() => { if (s.enabled) onReady(s.id); else setCursor(i); }}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 10px 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: '6px 4px',
                    borderBottom: `1px solid ${theme.lineSoft}`,
                    cursor: s.enabled ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: act ? accent : theme.inkMuted }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ width: 8, height: 8, background: acc, opacity: act ? 1 : s.enabled ? 0.55 : 0.25 }} />
                  <span
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 13,
                      color: act ? accent : s.enabled ? theme.ink : theme.inkMuted,
                    }}
                  >
                    {s.name}
                  </span>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                    {s.enabled ? (act ? '◆' : '') : 'SOON'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>◀▶▲▼ MOVE</span>
        <span>↵ FIGHT</span>
        <span>ESC BACK</span>
        <span style={{ marginLeft: 'auto' }}>
          {STAGES.filter((s) => s.enabled).length} / {STAGES.length} UNLOCKED
        </span>
      </div>
    </div>
  );
}
