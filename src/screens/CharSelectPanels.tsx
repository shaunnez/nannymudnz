import { useState } from 'react';
import type { ReactNode } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, GuildMonogram, ComboDisplay } from '../ui';

export interface SidePanelProps {
  role: 'P1' | 'CPU';
  guildId: GuildId;
  locked: boolean;
  active: boolean;
  statusText?: string;
  roleLabel?: string;
  onView: () => void;
}

export function SidePanel({ role, guildId, locked, active, statusText, roleLabel, onView }: SidePanelProps) {
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
            fontSize: 12,
            letterSpacing: 3,
            color: active ? labelColor : theme.inkMuted,
          }}
        >
          {roleLabel ?? (role === 'P1' ? 'P1 · HUMAN' : 'CPU · OPPONENT')}{active ? ' ◆' : ''}
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
          fontSize: 12,
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
            fontSize: 16,
            color: theme.inkDim,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          <span>ULT ·</span>
          <ComboDisplay combo={ult.combo} size={20} color={theme.ink} />
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: accent }}>{ult.name}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, minHeight: '65px' }}>
          {ult.description}
        </div>
      </div>
    </div>
  );
}

export interface VitalRowProps {
  label: string;
  value: string;
  accent: string;
  emphasized?: boolean;
}

export function VitalRow({ label, value, accent, emphasized }: VitalRowProps) {
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

export interface AccentBtnProps {
  accent: string;
  onClick: () => void;
  children: ReactNode;
}

export function AccentBtn({ accent, onClick, children }: AccentBtnProps) {
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

export interface StatBarProps {
  label: string;
  value: number;
  max: number;
  hue: number;
}

export function StatBar({ label, value, max, hue }: StatBarProps) {
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
