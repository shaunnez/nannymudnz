import type { Actor, RoundState, SimMode, SimState } from '@nannymud/shared/simulation/types';
import { getGuild } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../../data/guildMeta';
import { theme, guildAccent, GuildMonogram } from '../../ui';
import { MeterBar } from '../../ui/MeterBar';
import { RoundTimer } from './RoundTimer';
import { BossSlot } from './BossSlot';
import { PlayerExtras } from './PlayerExtras';

interface Props {
  mode: SimMode;
  p1: Actor;
  p2: Actor | null;
  round: RoundState | null;
  stageName: string;
  animate: boolean;
  state: SimState;
}

export function HudTopBar({ mode, p1, p2, round, stageName, animate, state }: Props) {
  const boss =
    mode === 'story'
      ? state.enemies.find((e) => e.isAlive && e.aiState.behavior === 'boss') ?? null
      : null;

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
        gap: 18,
        padding: '6px 14px',
        background: theme.bg,
        borderBottom: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <PlayerSlot actor={p1} side="left" label="P1" showExtras={mode === 'story'} />

      <div style={{ textAlign: 'center', minWidth: mode === 'vs' ? 140 : 0 }}>
        {mode === 'vs' && (
          <>
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 12,
                letterSpacing: 3,
                color: theme.inkDim,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              {stageName}
            </div>
            <RoundTimer round={round} animate={animate} />
          </>
        )}
      </div>

      {mode === 'story' ? (
        <BossSlot boss={boss} />
      ) : p2 ? (
        <PlayerSlot actor={p2} side="right" label="P2" showExtras={false} />
      ) : (
        <div />
      )}
    </div>
  );
}

function PlayerSlot({
  actor,
  side,
  label,
  showExtras,
}: {
  actor: Actor;
  side: 'left' | 'right';
  label: string;
  showExtras: boolean;
}) {
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
          borderRadius: 6,
          border: `2px solid ${teamColor}`,
          overflow: 'hidden',
          lineHeight: 0,
        }}
      >
        <GuildMonogram guildId={actor.guildId!} size={54} />
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
        {showExtras && <PlayerExtras actor={actor} side={side} />}
      </div>
    </div>
  );
}
