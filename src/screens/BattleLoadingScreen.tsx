import { useEffect, useRef, useState } from 'react';
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

  const row1 = slots.slice(0, 4);
  const row2 = slots.slice(4, 8);

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
          HUE · {stage.hue}°
        </div>
      </div>

      {/* Fighter grid — 1 or 2 rows of 4 */}
      <div
        style={{
          flex: 1, position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 6, padding: '10px 24px',
        }}
      >
        <FighterRow slots={row1} slotOffset={0} getProgress={getProgress} />
        {row2.length > 0 && (
          <FighterRow slots={row2} slotOffset={4} getProgress={getProgress} />
        )}
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

interface RowProps {
  slots: BattleSlot[];
  slotOffset: number;
  getProgress: (slot: BattleSlot, i: number) => number;
}

function FighterRow({ slots, slotOffset, getProgress }: RowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${slots.length}, 1fr)`, gap: 6 }}>
      {slots.map((slot, i) => (
        <FighterCard key={i} slot={slot} progress={getProgress(slot, i + slotOffset)} />
      ))}
    </div>
  );
}

interface CardProps {
  slot: BattleSlot;
  progress: number;
}

function FighterCard({ slot, progress }: CardProps) {
  const isOff = slot.type === 'off';
  const isHuman = slot.type === 'human';
  const meta = isOff ? null : GUILD_META[slot.guildId];
  const guild = isOff ? null : GUILDS.find((g) => g.id === slot.guildId);
  const cardAccent = meta ? guildAccent(meta.hue) : theme.lineSoft;
  const teamColor = slot.team ? TEAM_COLORS[slot.team] : cardAccent;
  const borderColor = isHuman ? theme.accent : teamColor;
  const pct = Math.round(progress * 100);
  const ready = progress >= 1;

  if (isOff) {
    return (
      <div
        style={{
          padding: '8px 12px',
          border: `1px solid ${theme.lineSoft}`,
          background: theme.bgDeep,
          opacity: 0.25,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 68,
        }}
      >
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
          —
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        border: `1px solid ${borderColor}`,
        background: isHuman ? `${theme.accent}0a` : theme.bgDeep,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      {/* Identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GuildMonogram guildId={slot.guildId} size={36} selected={ready} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink,
              letterSpacing: '-0.01em', lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {guild?.name ?? slot.guildId}
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: teamColor, letterSpacing: 2, marginTop: 2 }}>
            {meta?.tag.toUpperCase() ?? ''}
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto', fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2,
            color: ready ? theme.good : theme.warn, flexShrink: 0,
          }}
        >
          {ready ? 'READY' : 'LOADING…'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 2,
          }}
        >
          <span>PROGRESS</span>
          <span style={{ color: ready ? cardAccent : theme.ink }}>{pct}%</span>
        </div>
        <div
          style={{
            width: '100%', height: 5,
            background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: `${pct}%`,
              background: isHuman ? theme.accent : cardAccent,
              transition: 'width 80ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
