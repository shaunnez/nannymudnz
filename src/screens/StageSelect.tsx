import { useCallback, useEffect, useMemo, useState } from 'react';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/stages';
import { isStageUnlocked } from '../state/useStageProgress';
import { theme, Btn } from '../ui';
import { StageTile, StageDetailPanel } from './StagePanels';

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
  const canCommit = isStageUnlocked(cur.id);

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
          {STAGES.map((s, i) => (
            <StageTile
              key={s.id}
              stage={s}
              index={i}
              active={i === cursor}
              isHost={true}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { if (isStageUnlocked(s.id)) onReady(s.id); }}
            />
          ))}
        </div>

        <StageDetailPanel
          stages={STAGES}
          cursor={cursor}
          isHost={true}
          onHover={(i) => setCursor(i)}
          onCommit={(i) => onReady(STAGES[i].id)}
        />
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
          {STAGES.filter((s) => isStageUnlocked(s.id)).length} / {STAGES.length} UNLOCKED
        </span>
      </div>
    </div>
  );
}
