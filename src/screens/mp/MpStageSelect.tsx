import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { STAGES } from '../../data/stages';
import { isStageUnlocked } from '../../state/useStageProgress';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';
import { StageTile, StageDetailPanel } from '../StagePanels';

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

  // Relay host cursor to server so joiner sees it live.
  useEffect(() => {
    if (!isHost) return;
    room.send('hover_stage', { idx: cursor });
  }, [cursor, isHost, room]);

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

  const commit = useCallback(
    (idx: number) => {
      if (!isHost) return;
      const stage = STAGES[idx];
      if (!isStageUnlocked(stage.id)) return;
      room.send('pick_stage', { stageId: stage.id });
    },
    [isHost, room],
  );

  useEffect(() => {
    if (!isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); commit(cursor); }
      else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, cursor, isHost, move, onLeave]);

  // Non-host ESC to leave.
  useEffect(() => {
    if (isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, onLeave]);

  if (!state) return <MpLoading />;

  // Host uses local cursor; joiner mirrors server-broadcast host cursor.
  const displayCursor = isHost ? cursor : (state.hoveredStageIdx ?? 0);
  const cur = STAGES[displayCursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;

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
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            {isHost
              ? `STAGE · ${String(displayCursor + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`
              : 'STAGE · MULTIPLAYER'}
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, textAlign: 'center' }}>
            {isHost ? 'Pick the battlefield' : 'Host is picking a stage…'}
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <RoomCodeBadge code={state.code} />
          {isHost && (
            <Btn size="md" primary disabled={!isStageUnlocked(cur.id)} onClick={() => commit(displayCursor)}>
              FIGHT →
            </Btn>
          )}
        </div>
      </div>

      {/* Body — same 1fr 420px layout for host and joiner */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        <div
          style={{
            padding: 36,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gap: 14,
          }}
        >
          {STAGES.map((s, i) => (
            <StageTile
              key={s.id}
              stage={s}
              index={i}
              active={i === displayCursor}
              isHost={isHost}
              onMouseEnter={() => { if (isHost) setCursor(i); }}
              onClick={() => commit(i)}
            />
          ))}
        </div>
        <StageDetailPanel
          stages={STAGES}
          cursor={displayCursor}
          isHost={isHost}
          onHover={(i) => { if (isHost) setCursor(i); }}
          onCommit={commit}
        />
      </div>

      {/* Footer */}
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
          <span>Watching host pick…</span>
        )}
        <span>ESC LEAVE</span>
        <span style={{ marginLeft: 'auto', color: accent }}>
          {STAGES.filter((s) => isStageUnlocked(s.id)).length} / {STAGES.length} UNLOCKED
        </span>
      </div>
    </div>
  );
}
