import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BattleSlot } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import { STAGES_BY_ID } from '../data/stages';
import type { StageId } from '../data/stages';
import { theme, guildAccent, GuildMonogram } from '../ui';
import { TIPS } from './LoadingScreen';

const TEAM_COLORS: Record<string, string> = {
  A: theme.team1,
  B: theme.team2,
  C: theme.team3,
  D: theme.team4,
};

function makeSimDurationsMs(count: number): number[] {
  return Array.from({ length: count }, () => 600 + Math.random() * 1400);
}

interface Props {
  slots: BattleSlot[];
  stageId: StageId;
  /** 0–1 actual Phaser asset load progress for the human player. */
  humanProgress: number;
}

export function BattleLoadingScreen({ slots, stageId, humanProgress }: Props) {
  const stage = STAGES_BY_ID[stageId];
  const accent = `oklch(0.72 0.18 ${stage.hue})`;
  const simDurationsRef = useRef(makeSimDurationsMs(slots.length));
  const startRef = useRef(performance.now());
  const [cpuProgress, setCpuProgress] = useState<number[]>(() => slots.map(() => 0));
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      let allDone = true;
      const next = slots.map((s, i) => {
        if (s.type !== 'cpu') return 0;
        const p = Math.min(1, elapsed / simDurationsRef.current[i]);
        if (p < 1) allDone = false;
        return p;
      });
      setCpuProgress(next);
      if (!allDone) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 1400);
    return () => clearInterval(id);
  }, []);

  const getProgress = (slot: BattleSlot, i: number): number => {
    if (slot.type === 'human') return humanProgress;
    if (slot.type === 'cpu') return cpuProgress[i] ?? 0;
    return 1; // 'off' slots are shown as complete/placeholder
  };

  const active = slots.filter((s) => s.type !== 'off');
  const n = active.length;
  const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  // Compute initial monogram size synchronously from window so there's no flash on first paint.
  // Header ~68px, footer ~66px, grid padding 40px, gaps 12px per gutter.
  const initMonogramSize = computeMonogramSize(cols, rows);

  return (
    <div
      style={{
        width: '100%', height: '100%', position: 'relative',
        background: `linear-gradient(180deg, ${accent}22, ${theme.bgDeep} 70%)`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* hatching overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `repeating-linear-gradient(135deg, transparent 0 22px, ${accent}12 22px 23px)`,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '16px 32px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          position: 'relative',
        }}
      >
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            NOW LOADING · BATTLE
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>
            {stage.name}
          </div>
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>
          {n} FIGHTERS
        </div>
      </div>

      {/* Fighter grid — responsive columns based on fighter count */}
      <div
        style={{
          flex: 1, position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          alignContent: 'stretch',
          gap: 12, padding: '20px 24px',
        }}
      >
        {active.map((slot, i) => (
          <FighterCard key={i} slot={slot} progress={getProgress(slot, slots.indexOf(slot))} initMonogramSize={initMonogramSize} />
        ))}
      </div>

      {/* Tips footer */}
      <div
        style={{
          position: 'relative',
          padding: '14px 32px 18px',
          borderTop: `1px solid ${theme.lineSoft}`,
          background: theme.bgDeep,
        }}
      >
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
          ▸ ADVICE FROM THE WIZARDS
        </div>
        <div
          key={tipIdx}
          style={{
            fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim,
            fontStyle: 'italic', lineHeight: 1.55, marginTop: 4,
          }}
        >
          {TIPS[tipIdx]}
        </div>
      </div>
    </div>
  );
}

function computeMonogramSize(cols: number, rows: number): number {
  const gridW = window.innerWidth - 48;          // 24px grid padding each side
  const gridH = window.innerHeight - 80 - 70 - 40; // header ~80, footer ~70, grid padding 40
  const cardW = (gridW - 12 * (cols - 1)) / cols;
  const cardH = (gridH - 12 * (rows - 1)) / rows;
  // contentRect excludes border+padding: card is border(1)+pad(14) each side horiz → -30 extra,
  // border(1)+pad(12/14) vert → -28 extra. Card content overhead ~130px tall, ~28px wide.
  return Math.max(48, Math.min(cardW - 58, cardH - 158));
}

interface CardProps {
  slot: BattleSlot;
  progress: number;
  initMonogramSize: number;
}

function FighterCard({ slot, progress, initMonogramSize }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [monogramSize, setMonogramSize] = useState(initMonogramSize);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const available = Math.min(width - 28, height - 130);
      setMonogramSize(Math.max(48, available));
    });
    obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);
  const isHuman = slot.type === 'human';
  const meta = GUILD_META[slot.guildId];
  const guild = GUILDS.find((g) => g.id === slot.guildId);
  const cardAccent = meta ? guildAccent(meta.hue) : theme.lineSoft;
  const teamColor = slot.team ? TEAM_COLORS[slot.team] : cardAccent;
  const borderColor = isHuman ? theme.accent : teamColor;
  const pct = Math.round(progress * 100);
  const ready = progress >= 1;

  return (
    <div
      ref={cardRef}
      style={{
        padding: '12px 14px 14px',
        border: `1px solid ${borderColor}`,
        background: isHuman ? `${theme.accent}0a` : theme.bgDeep,
        boxShadow: isHuman ? `0 0 0 1px ${theme.accent}44 inset` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}
    >
      {/* Status badge */}
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 8, color: teamColor, letterSpacing: 2 }}>
          {slot.team ? `TEAM ${slot.team}` : (isHuman ? 'YOU' : 'CPU')}
        </span>
        <span style={{ fontFamily: theme.fontMono, fontSize: 8, letterSpacing: 2, color: ready ? theme.good : theme.warn }}>
          {ready ? 'READY' : `${pct}%`}
        </span>
      </div>

      {/* Monogram */}
      <GuildMonogram guildId={slot.guildId} size={monogramSize} selected={isHuman} />

      {/* Name + tag */}
      <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
        <div style={{
          fontFamily: theme.fontDisplay, fontSize: 13, color: cardAccent,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {guild?.name ?? slot.guildId}
        </div>
        {meta?.tag && (
          <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 2, marginTop: 2 }}>
            {meta.tag.toUpperCase()}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ alignSelf: 'stretch', height: 4, background: theme.line, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: `${pct}%`,
          background: isHuman ? theme.accent : cardAccent,
          transition: 'width 80ms linear',
          boxShadow: isHuman ? `0 0 8px ${theme.accent}` : 'none',
        }} />
      </div>
    </div>
  );
}
