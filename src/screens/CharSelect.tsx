import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, Btn, Chip, GuildMonogram, ComboDisplay } from '../ui';
import { GuildDetails } from './GuildDetails';
import type { GameMode } from '../state/useAppState';

interface Props {
  mode: GameMode;
  initialP1: GuildId;
  initialP2: GuildId;
  onBack: () => void;
  onReady: (p1: GuildId, p2: GuildId) => void;
}

type Slot = 'p1' | 'opp';

const COLS = 5;
const ROWS = 3;
const TILE_SIZE = 190;
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
    const oppIdx = hasOpponent
      ? ids.indexOf(initialP2 !== initialP1 ? initialP2 : ids[(p1Idx + 2) % ids.length])
      : 0;
    return { p1: p1Idx, opp: Math.max(0, oppIdx) };
  });

  const [picks, setPicks] = useState<Record<Slot, GuildId>>(() => ({
    p1: initialP1,
    opp: hasOpponent
      ? initialP2 !== initialP1 ? initialP2 : pickRandom(ids, initialP1)
      : pickRandom(ids, initialP1),
  }));

  const [locked, setLocked] = useState<Record<Slot, boolean>>(() => ({
    p1: false,
    // Non-VS modes: opponent is spawned by game logic; treat as pre-resolved so READY gates only on P1.
    opp: !hasOpponent,
  }));

  const [active, setActive] = useState<Slot>('p1');
  const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);
  const canMove = !locked[active];

  const move = useCallback(
    (dx: number, dy: number) => {
      if (!canMove) return;
      setCursors((c) => {
        const cur = c[active];
        const r = Math.floor(cur / COLS);
        const col = cur % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        const nextIdx = nr * COLS + nc;
        return { ...c, [active]: nextIdx };
      });
    },
    [active, canMove],
  );

  const lockActive = useCallback(() => {
    if (locked[active]) return;
    const chosen = ids[cursors[active]];
    setPicks((p) => ({ ...p, [active]: chosen }));
    setLocked((l) => ({ ...l, [active]: true }));
    if (hasOpponent) {
      setActive((cur) => {
        const other: Slot = cur === 'p1' ? 'opp' : 'p1';
        return locked[other] ? cur : other;
      });
    }
  }, [active, cursors, hasOpponent, ids, locked]);

  const unlockActive = useCallback(() => {
    setLocked((l) => ({ ...l, [active]: false }));
  }, [active]);

  // In non-VS, opp is pre-locked and p1 has no lock gate — commit directly from READY/Enter.
  const readyToCommit = hasOpponent ? locked.p1 && locked.opp : true;

  useEffect(() => {
    if (detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (hasOpponent) setActive((p) => (p === 'p1' ? 'opp' : 'p1'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!hasOpponent) {
          setPicks((p) => ({ ...p, p1: ids[cursors.p1] }));
          return;
        }
        if (readyToCommit) onReady(picks.p1, picks.opp);
        else lockActive();
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        if (locked[active]) unlockActive();
        else onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, cursors, detailsFor, hasOpponent, ids, locked, lockActive, move, onBack, onReady, picks, readyToCommit, unlockActive]);

  const hoveredId = ids[cursors[active]];
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
            <Btn size="md" onClick={() => setActive((p) => (p === 'p1' ? 'opp' : 'p1'))}>
              SWITCH · {active === 'p1' ? 'P1' : 'CPU'}
            </Btn>
          )}
          <Btn
            size="md"
            primary
            disabled={!readyToCommit}
            onClick={() => onReady(picks.p1, picks.opp)}
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
          guildId={locked.p1 ? picks.p1 : ids[cursors.p1]}
          locked={hasOpponent ? locked.p1 : false}
          active={active === 'p1'}
          statusText={!hasOpponent ? 'HOVER' : undefined}
          onView={() => setDetailsFor(locked.p1 ? picks.p1 : ids[cursors.p1])}
        />

        <div
          style={{
            padding: '28px 36px',
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
              const oppHere = hasOpponent && cursors.opp === i;
              const isActiveTile = (active === 'p1' ? p1Here : oppHere);
              const p1Picked = !hasOpponent && picks.p1 === g.id;
              return (
                <div
                  key={g.id}
                  onMouseEnter={() => {
                    // Hover moves the active cursor so the panel + preview strip update.
                    // Clicks set the sticky pick separately.
                    if (!canMove) return;
                    setCursors((c) => ({ ...c, [active]: i }));
                  }}
                  onClick={() => {
                    if (locked[active]) return;
                    setCursors((c) => ({ ...c, [active]: i }));
                    setPicks((p) => ({ ...p, [active]: g.id }));
                    if (hasOpponent) {
                      // VS: lock this slot and swap to the other player.
                      setLocked((l) => ({ ...l, [active]: true }));
                      const other: Slot = active === 'p1' ? 'opp' : 'p1';
                      if (!locked[other]) setActive(other);
                    }
                    // Stage: click commits picks.p1 to the right-hand SELECTED panel. No lock.
                  }}
                  style={{
                    position: 'relative',
                    width: tileSize,
                    cursor: locked[active] ? 'default' : 'pointer',
                    outline: p1Picked ? `2px solid ${theme.accent}` : 'none',
                    outlineOffset: 4,
                  }}
                >
                  <GuildMonogram guildId={g.id} size={tileSize} selected={p1Here || oppHere} />
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
                      ◆ P1{locked.p1 ? '·L' : ''}
                    </div>
                  )}
                  {oppHere && (
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
                      ◆ CPU{locked.opp ? '·L' : ''}
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
            guildId={locked.opp ? picks.opp : ids[cursors.opp]}
            locked={locked.opp}
            active={active === 'opp'}
            onView={() => setDetailsFor(locked.opp ? picks.opp : ids[cursors.opp])}
          />
        ) : (
          <SidePanel
            role="P1"
            guildId={picks.p1}
            locked={true}
            active={false}
            statusText="SELECTED"
            onView={() => setDetailsFor(picks.p1)}
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
        <span>{hasOpponent ? '↵ LOCK / READY' : '↵ SELECT'}</span>
        {hasOpponent && <span>TAB SWITCH</span>}
        <span>ESC BACK</span>
      </div>
    </div>
  );
}

interface SidePanelProps {
  role: 'P1' | 'CPU';
  guildId: GuildId;
  locked: boolean;
  active: boolean;
  statusText?: string;
  onView: () => void;
}

function SidePanel({ role, guildId, locked, active, statusText, onView }: SidePanelProps) {
  const guild = GUILDS.find((g) => g.id === guildId)!;
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);
  const ult = guild.abilities[4];
  const labelColor = role === 'P1' ? theme.accent : theme.warn;

  return (
    <div
      style={{
        padding: 24,
        borderRight: role === 'P1' ? `1px solid ${theme.lineSoft}` : 'none',
        borderLeft: role === 'CPU' ? `1px solid ${theme.lineSoft}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: active ? theme.panel : 'transparent',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: theme.fontMono,
            fontSize: 14,
            letterSpacing: 3,
            color: active ? labelColor : theme.inkMuted,
          }}
        >
          {role === 'P1' ? 'P1 · HUMAN' : 'CPU · OPPONENT'}{active ? ' ◆' : ''}
        </span>
        <span
          style={{
            fontFamily: theme.fontMono,
            fontSize: 14,
            color: locked ? theme.good : theme.warn,
          }}
        >
          {statusText ?? (locked ? 'LOCKED' : 'SELECTING…')}
        </span>
      </div>
      <GuildMonogram guildId={guildId} size={180} selected={locked} />
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 30,
            color: theme.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
          }}
        >
          {guild.name}
        </div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 15, color: theme.inkDim, fontStyle: 'italic' }}>
          {meta.sub}
        </div>
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 15,
          color: theme.inkDim,
          lineHeight: 1.55,
          minHeight: 'calc(12px * 1.55 * 4)',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {meta.bio}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <VitalRow label={guild.resource.name} value={String(guild.resource.max)} accent={accent} emphasized />
        <VitalRow label="HP" value={String(guild.hpMax)} accent={accent} />
        <VitalRow label="ARMOR" value={String(meta.uiVitals.Armor)} accent={accent} />
        <VitalRow label="MR" value={String(meta.uiVitals.MR)} accent={accent} />
        <VitalRow label="MOVE" value={String(meta.uiVitals.Move)} accent={accent} />
      </div>
      <AccentBtn accent={accent} onClick={onView}>VIEW DETAILS</AccentBtn>
      <div style={{ marginTop: 'auto', borderTop: `1px solid ${theme.lineSoft}`, paddingTop: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: theme.fontMono,
            fontSize: 20,
            color: theme.inkMuted,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          <span>ULT ·</span>
          <ComboDisplay combo={ult.combo} size={20} color={theme.ink} />
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: accent }}>{ult.name}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim }}>
          {ult.description}
        </div>
      </div>
    </div>
  );
}

interface VitalRowProps {
  label: string;
  value: string;
  accent: string;
  emphasized?: boolean;
}

function VitalRow({ label, value, accent, emphasized }: VitalRowProps) {
  const fg = emphasized ? accent : theme.ink;
  const border = emphasized ? accent : theme.lineSoft;
  const bg = emphasized ? `${accent}14` : theme.panel;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <span
        style={{
          fontFamily: theme.fontMono,
          fontSize: emphasized ? 18 : 16,
          color: emphasized ? accent : theme.ink,
          fontWeight: emphasized ? 400 : 700,
          letterSpacing: 2,
        }}
      >
        {label.toUpperCase()}
      </span>
      <span
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: emphasized ? 20 : 16,
          color: fg,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface AccentBtnProps {
  accent: string;
  onClick: () => void;
  children: ReactNode;
}

function AccentBtn({ accent, onClick, children }: AccentBtnProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 20px',
        fontSize: 15,
        background: hover ? `${accent}22` : 'transparent',
        color: accent,
        border: `1px solid ${accent}`,
        fontFamily: theme.fontMono,
        letterSpacing: 2,
        textTransform: 'uppercase',
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 120ms ease',
        boxShadow: hover ? `0 0 0 1px ${accent}55` : 'none',
      }}
    >
      {children}
    </button>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  hue: number;
}

function StatBar({ label, value, max, hue }: StatBarProps) {
  const accent = guildAccent(hue);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: theme.fontMono,
          fontSize: 18,
          color: theme.inkDim,
          letterSpacing: 1,
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span style={{ color: theme.ink }}>{value}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 10,
              background: i < value ? accent : theme.bgDeep,
              border: `1px solid ${i < value ? accent : theme.lineSoft}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
