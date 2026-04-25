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
      <PlayerSlot actor={p1} side="left" label="P1" showExtras={true} petMode={state.allies.find(a => a.kind === 'wolf_pet')?.petAiMode} />

      <div style={{ textAlign: 'center', minWidth: mode === 'vs' || mode === 'surv' ? 140 : 0 }}>
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
        {mode === 'surv' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3 }}>
              SURVIVAL
            </div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
              WAVE {String(state.currentWave).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 1 }}>
              {state.survivalScore.toLocaleString()} PTS
            </div>
          </div>
        )}
      </div>

      {mode === 'story' ? (
        <BossSlot boss={boss} />
      ) : p2 ? (
        <PlayerSlot actor={p2} side="right" label="P2" showExtras={true} />
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
  petMode,
}: {
  actor: Actor;
  side: 'left' | 'right';
  label: string;
  showExtras: boolean;
  petMode?: string;
}) {
  const guild = getGuild(actor.guildId!);
  const meta = GUILD_META[actor.guildId!];
  const accent = guildAccent(meta.hue);
  const teamColor = side === 'left' ? theme.accent : theme.warn;
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
          {showExtras && <PlayerExtras actor={actor} side={side} petMode={petMode} />}
          <span>
            <span style={{ color: accent }}>{resourceName}</span>{' '}
            {Math.round(actor.mp)}/{actor.mpMax}
          </span>
        </div>
      </div>
    </div>
  );
}
