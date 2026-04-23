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
        height: 80,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        padding: '6px 14px',
        background: theme.bg,
        borderBottom: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <PlayerSlot actor={p1} side="left" label="P1" />
      <div style={{ textAlign: 'center', minWidth: 140 }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 14,
            letterSpacing: 3,
            color: theme.inkDim,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {stageName}
        </div>
        <RoundTimer round={round} animate={animate} />
      </div>
      <PlayerSlot actor={p2} side="right" label="P2" />
    </div>
  );
}

function PlayerSlot({ actor, side, label }: { actor: Actor; side: 'left' | 'right'; label: string }) {
  const guild = getGuild(actor.guildId!);
  const meta = GUILD_META[actor.guildId!];
  const accent = guildAccent(meta.hue);
  const teamColor = side === 'left' ? theme.team1 : theme.team2;
  const row = side === 'left' ? 'row' : 'row-reverse';
  const textAlign = side === 'left' ? 'left' : 'right';

  const resourceName = guild?.resource?.name?.toUpperCase() ?? '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: row,
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          width: 54,
          height: 54,
          borderRadius: 6,
          background: theme.panel,
          border: `2px solid ${teamColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontDisplay,
          fontSize: 20,
          fontWeight: 700,
          color: accent,
        }}
      >
        {meta.glyph}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign }}>
        <div
          style={{
            display: 'flex',
            flexDirection: row,
            alignItems: 'baseline',
            gap: 8,
            justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
          }}
        >
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 11,
              letterSpacing: 2,
              color: teamColor,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 20,
              color: theme.ink,
              letterSpacing: '0.01em',
            }}
          >
            {guild?.name}
          </span>
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkDim,
              letterSpacing: 2,
            }}
          >
            {meta.tag.toUpperCase()}
          </span>
        </div>
        <div style={{ marginTop: 2 }}>
          <MeterBar value={actor.hp} max={actor.hpMax} color={teamColor} height={10} />
        </div>
        <div
          style={{
            marginTop: 2,
            display: 'flex',
            flexDirection: row,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <MeterBar value={actor.mp} max={actor.mpMax} color={accent} height={5} />
          </div>
        </div>
        <div
          style={{
            marginTop: 2,
            display: 'flex',
            flexDirection: row,
            justifyContent: 'space-between',
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.inkDim,
            letterSpacing: 1,
          }}
        >
          <span>HP {Math.round(actor.hp)}/{actor.hpMax}</span>
          <span>
            <span style={{ color: accent }}>{resourceName}</span>{' '}
            {Math.round(actor.mp)}/{actor.mpMax}
          </span>
        </div>
      </div>
    </div>
  );
}
