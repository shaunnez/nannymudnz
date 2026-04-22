import type { Actor, RoundState } from '@nannymud/shared/simulation/types';
import { getGuild } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../../data/guildMeta';
import { theme, guildAccent } from '../../ui';
import { MeterBar } from '../../ui/MeterBar';
import { RoundTimer } from './RoundTimer';

interface Props {
  p1: Actor;
  p2: Actor;
  round: RoundState | null;
  stageName: string;
  animate: boolean;
}

export function HudTopBar({ p1, p2, round, stageName, animate }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 72,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        padding: '6px 12px',
        background: theme.bg,
        borderBottom: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <PlayerSlot actor={p1} side="left" />
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 11,
            letterSpacing: 2,
            color: theme.inkDim,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {stageName}
        </div>
        <RoundTimer round={round} animate={animate} />
      </div>
      <PlayerSlot actor={p2} side="right" />
    </div>
  );
}

function PlayerSlot({ actor, side }: { actor: Actor; side: 'left' | 'right' }) {
  const guild = getGuild(actor.guildId!);
  const meta = GUILD_META[actor.guildId!];
  const accent = guildAccent(meta.hue);
  const teamColor = side === 'left' ? theme.team1 : theme.team2;
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  const row = side === 'left' ? 'row' : 'row-reverse';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: row,
        alignItems: 'center',
        gap: 10,
        justifyContent: align,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: theme.panel,
          border: `2px solid ${teamColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontDisplay,
          fontSize: 18,
          fontWeight: 700,
          color: accent,
        }}
      >
        {meta.glyph}
      </div>
      <div style={{ minWidth: 220, textAlign: side === 'left' ? 'left' : 'right' }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 14,
            color: theme.ink,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {guild.name}
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkDim, marginBottom: 4 }}>
          {meta.tag.toUpperCase()}
        </div>
        <MeterBar value={actor.hp} max={actor.hpMax} color={teamColor} height={8} />
        <div style={{ height: 3 }} />
        <MeterBar value={actor.mp} max={actor.mpMax} color={accent} height={5} />
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.inkDim,
            marginTop: 2,
          }}
        >
          HP {Math.round(actor.hp)}/{actor.hpMax} · {guild.resource.name.toUpperCase()}{' '}
          {Math.round(actor.mp)}/{actor.mpMax}
        </div>
      </div>
    </div>
  );
}
