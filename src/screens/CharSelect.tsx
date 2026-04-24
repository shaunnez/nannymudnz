import { useCallback, useEffect, useMemo, useState } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, Btn, Chip, GuildMonogram } from '../ui';
import { GuildDetails } from './GuildDetails';
import type { GameMode } from '../state/useAppState';
import { SidePanel, StatBar } from './CharSelectPanels';

interface Props {
  mode: GameMode;
  initialP1: GuildId;
  initialP2: GuildId;
  onBack: () => void;
  onReady: (p1: GuildId, p2: GuildId) => void;
}

type Slot = 'p1' | 'cpu';

const COLS = 5;
const ROWS = 3;
const TILE_SIZE = 160;
const TILE_GAP = 20;

function pickRandom<T>(list: readonly T[], exclude?: T): T {
  const pool = exclude ? list.filter((x) => x !== exclude) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function CharSelect({ mode, initialP1, initialP2, onBack, onReady }: Props) {
  const ids = useMemo(() => GUILDS.map((g) => g.id), []);
  const hasOpponent = mode === 'vs';

  const [cursors, setCursors] = useState<Record<Slot, number>>(() => {
    const p1Idx = Math.max(0, ids.indexOf(initialP1));
    const cpuIdx = Math.max(
      0,
      ids.indexOf(initialP2 !== initialP1 ? initialP2 : ids[(p1Idx + 2) % ids.length]),
    );
    return { p1: p1Idx, cpu: cpuIdx };
  });

  // null = not yet explicitly clicked. For non-VS, cpu is pre-seeded (never shown,
  // just passed to onReady so the caller always gets two valid IDs).
  const [picks, setPicks] = useState<Record<Slot, GuildId | null>>(() => ({
    p1: null,
    cpu: hasOpponent ? null : pickRandom(ids, initialP1),
  }));

  const [activeSlot, setActiveSlot] = useState<Slot>('p1');
  const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);

  // READY enables when both slots have an explicit click-pick.
  // Non-VS: only p1 needs a pick; cpu was pre-seeded above.
  const readyToGo = hasOpponent
    ? picks.p1 !== null && picks.cpu !== null
    : picks.p1 !== null;

  const move = useCallback(
    (dx: number, dy: number) => {
      setCursors((c) => {
        const cur = c[activeSlot];
        const r = Math.floor(cur / COLS);
        const col = cur % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return { ...c, [activeSlot]: nr * COLS + nc };
      });
    },
    [activeSlot],
  );

  useEffect(() => {
    if (detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (hasOpponent) setActiveSlot((s) => (s === 'p1' ? 'cpu' : 'p1'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (readyToGo) {
          onReady(picks.p1!, picks.cpu!);
        } else {
          setPicks((p) => ({ ...p, [activeSlot]: ids[cursors[activeSlot]] }));
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSlot, cursors, detailsFor, hasOpponent, ids, move, onBack, onReady, picks, readyToGo]);

  const hoveredId = ids[cursors[activeSlot]];
  const hoveredGuild = GUILDS.find((g) => g.id === hoveredId)!;
  const hoveredMeta = GUILD_META[hoveredId];

  const bodyColumns = '280px 1fr 280px';
  const tileSize = TILE_SIZE;
  const tileGap = TILE_GAP;

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
            SELECT · 15 GUILDS · {mode.toUpperCase()}
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, textAlign: 'center' }}>
            {hasOpponent ? 'Pick your guild and opponent' : 'Choose your guild'}
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
          {hasOpponent && (
            <Btn size="md" onClick={() => setActiveSlot((s) => (s === 'p1' ? 'cpu' : 'p1'))}>
              SWITCH · {activeSlot === 'p1' ? 'P1' : 'CPU'}
            </Btn>
          )}
          <Btn
            size="md"
            primary
            disabled={!readyToGo}
            onClick={() => onReady(picks.p1!, picks.cpu!)}
          >
            READY →
          </Btn>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: bodyColumns,
          overflow: 'hidden',
        }}
      >
        <SidePanel
          role="P1"
          guildId={picks.p1 ?? ids[cursors.p1]}
          locked={hasOpponent ? picks.p1 !== null : false}
          active={activeSlot === 'p1'}
          statusText={!hasOpponent ? 'HOVER' : undefined}
          onView={() => setDetailsFor(picks.p1 ?? ids[cursors.p1])}
        />

        <div
          style={{
            padding: '20px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`,
              gap: tileGap,
              justifyContent: 'center',
            }}
          >
            {GUILDS.map((g, i) => {
              const meta = GUILD_META[g.id];
              const acc = guildAccent(meta.hue);
              const p1Here = cursors.p1 === i;
              const cpuHere = hasOpponent && cursors.cpu === i;
              const isActiveTile = activeSlot === 'p1' ? p1Here : cpuHere;
              const p1Picked = !hasOpponent && picks.p1 === g.id;
              return (
                <div
                  key={g.id}
                  onMouseEnter={() => {
                    // Hover moves the active cursor so the panel + preview strip update.
                    // Clicks set the sticky pick separately.
                    setCursors((c) => ({ ...c, [activeSlot]: i }));
                  }}
                  onClick={() => {
                    setCursors((c) => ({ ...c, [activeSlot]: i }));
                    setPicks((p) => ({ ...p, [activeSlot]: g.id }));
                  }}
                  style={{
                    position: 'relative',
                    width: tileSize,
                    cursor: 'pointer',
                    outline: p1Picked ? `2px solid ${theme.accent}` : 'none',
                    outlineOffset: 4,
                  }}
                >
                  <GuildMonogram guildId={g.id} size={tileSize} selected={p1Here || cpuHere} />
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: 8,
                      fontFamily: theme.fontMono,
                      fontSize: 20,
                      color: isActiveTile ? acc : theme.inkDim,
                      letterSpacing: 2,
                    }}
                  >
                    {g.name.toUpperCase()}
                  </div>
                  {p1Here && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: acc,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ P1{picks.p1 === g.id ? '·✓' : ''}
                    </div>
                  )}
                  {cpuHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: acc,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ CPU{picks.cpu === g.id ? '·✓' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 'auto',
              padding: '16px 18px',
              border: `1px solid ${theme.lineSoft}`,
              background: theme.panel,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 20,
                  color: guildAccent(hoveredMeta.hue),
                }}
              >
                {hoveredGuild.name}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Chip tone="accent" mono>{hoveredMeta.tag}</Chip>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 30 }}>
              {(Object.entries(hoveredGuild.stats) as [keyof Stats, number][]).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} max={20} hue={hoveredMeta.hue} />
              ))}
            </div>
          </div>
        </div>

        {hasOpponent ? (
          <SidePanel
            role="CPU"
            guildId={picks.cpu ?? ids[cursors.cpu]}
            locked={picks.cpu !== null}
            active={activeSlot === 'cpu'}
            onView={() => setDetailsFor(picks.cpu ?? ids[cursors.cpu])}
          />
        ) : (
          <SidePanel
            role="P1"
            guildId={picks.p1 ?? ids[cursors.p1]}
            locked={picks.p1 !== null}
            active={false}
            statusText="SELECTED"
            onView={() => setDetailsFor(picks.p1 ?? ids[cursors.p1])}
          />
        )}
      </div>

      {detailsFor && <GuildDetails guildId={detailsFor} onClose={() => setDetailsFor(null)} />}

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
        <span>{hasOpponent ? '↵ PICK / READY' : '↵ SELECT'}</span>
        {hasOpponent && <span>TAB SWITCH</span>}
        <span>ESC BACK</span>
      </div>
    </div>
  );
}
