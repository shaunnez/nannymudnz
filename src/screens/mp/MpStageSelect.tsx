import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { STAGES } from '../../data/stages';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const COLS = 3;
const ROWS = 3;

export function MpStageSelect({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  const isHost = room.sessionId === (state?.hostSessionId ?? '');

  const [cursor, setCursor] = useState<number>(0);

  usePhaseBounce(state?.phase ?? 'stage_select', 'stage_select', onPhaseChange);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (!isHost) return;
      setCursor((c) => {
        const r = Math.floor(c / COLS);
        const col = c % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return nr * COLS + nc;
      });
    },
    [isHost],
  );

  const commit = useCallback(() => {
    if (!isHost) return;
    const stage = STAGES[cursor];
    if (!stage.enabled) return;
    room.send('pick_stage', { stageId: stage.id });
  }, [isHost, cursor, room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onLeave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, move, onLeave]);

  if (!state) return <MpLoading />;

  const cur = STAGES[cursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;
  const canCommit = isHost && cur.enabled;

  // The stage the host has broadcast picking (after server ack it stays in stageId).
  const hostPickedId = state.stageId;
  const hostPickedStage = STAGES.find((s) => s.id === hostPickedId);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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
          <Btn size="md" onClick={onLeave}>← LEAVE</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
            }}
          >
            {isHost
              ? `STAGE · ${String(cursor + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`
              : 'STAGE · MULTIPLAYER'}
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 26,
              color: theme.ink,
              textAlign: 'center',
            }}
          >
            {isHost ? 'Pick the battlefield' : 'Host is picking a stage…'}
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <RoomCodeBadge code={state.code} />
          {isHost && (
            <Btn size="md" primary disabled={!canCommit} onClick={commit}>
              FIGHT →
            </Btn>
          )}
        </div>
      </div>

      {/* Body */}
      {isHost ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
          {/* Stage grid */}
          <div
            style={{
              padding: 36,
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              gap: 14,
            }}
          >
            {STAGES.map((s, i) => {
              const acc = `oklch(0.70 0.16 ${s.hue})`;
              const active = i === cursor;
              const locked = !s.enabled;
              return (
                <div
                  key={s.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    setCursor(i);
                    if (!locked) room.send('pick_stage', { stageId: s.id });
                  }}
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
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        fontFamily: theme.fontDisplay,
                        fontSize: 22,
                        color: theme.ink,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.05,
                      }}
                    >
                      {s?.name}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 10,
                        color: locked ? theme.warn : active ? acc : theme.inkMuted,
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

          {/* Detail panel */}
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
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: accent,
                  letterSpacing: 3,
                }}
              >
                {cur.enabled ? 'AVAILABLE' : 'COMING SOON'}
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
                {cur?.name}
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
                const acc2 = `oklch(0.70 0.16 ${s.hue})`;
                return (
                  <div
                    key={s.id}
                    onClick={() => { if (s.enabled) room.send('pick_stage', { stageId: s.id }); else setCursor(i); }}
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
                    <span style={{ width: 8, height: 8, background: acc2, opacity: act ? 1 : s.enabled ? 0.55 : 0.25 }} />
                    <span
                      style={{
                        fontFamily: theme.fontDisplay,
                        fontSize: 13,
                        color: act ? accent : s.enabled ? theme.ink : theme.inkMuted,
                      }}
                    >
                      {s?.name}
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
      ) : (
        /* Non-host waiting view */
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 32,
          }}
        >
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 32,
              color: theme.inkMuted,
              letterSpacing: '-0.01em',
            }}
          >
            Host is picking a stage…
          </div>

          {hostPickedStage ? (
            <div
              style={{
                padding: '24px 40px',
                border: `1px solid ${`oklch(0.70 0.16 ${hostPickedStage.hue})`}55`,
                background: `oklch(0.70 0.16 ${hostPickedStage.hue} / 0.08)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 3,
                }}
              >
                SELECTED
              </div>
              <div
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 36,
                  color: theme.ink,
                }}
              >
                {hostPickedStage?.name}
              </div>
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 12,
                  color: theme.inkDim,
                  fontStyle: 'italic',
                }}
              >
                {hostPickedStage.blurb}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 12,
                color: theme.inkMuted,
                letterSpacing: 3,
              }}
            >
              Waiting for host to choose…
            </div>
          )}
        </div>
      )}

      {/* Keyboard hints */}
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
        {isHost ? (
          <>
            <span>◀▶▲▼ MOVE</span>
            <span>↵ FIGHT</span>
            <span>CLICK INSTANT PICK</span>
          </>
        ) : (
          <span>Waiting for host…</span>
        )}
        <span>ESC LEAVE</span>
        <span style={{ marginLeft: 'auto' }}>
          {STAGES.filter((s) => s.enabled).length} / {STAGES.length} UNLOCKED
        </span>
      </div>
    </div>
  );
}
