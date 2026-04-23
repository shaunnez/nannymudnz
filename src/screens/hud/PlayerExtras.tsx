import type { Actor } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';

interface Props {
  actor: Actor;
  side: 'left' | 'right';
}

export function PlayerExtras({ actor, side }: Props) {
  const parts: React.ReactNode[] = [];

  if (actor.guildId === 'monk' && typeof actor.chiOrbs === 'number') {
    parts.push(<OrbRow key="chi" filled={actor.chiOrbs} total={5} color={theme.warn} />);
  }

  if (actor.guildId === 'champion' && typeof actor.bloodtally === 'number') {
    parts.push(<OrbRow key="blood" filled={actor.bloodtally} total={10} color={theme.bad} size={5} />);
  }

  if (actor.guildId === 'cultist' && typeof actor.sanity === 'number') {
    const s = actor.sanity;
    let color: string = theme.good;
    if (s >= 80) color = theme.bad;
    else if (s >= 60) color = theme.warn;
    else if (s >= 40) color = theme.warn;
    parts.push(<TextChip key="sanity" label="SAN" value={`${Math.round(s)}%`} color={color} />);
  }

  if (actor.shapeshiftForm && actor.shapeshiftForm !== 'none') {
    parts.push(<TextChip key="form" label="FORM" value={actor.shapeshiftForm.toUpperCase()} color={theme.accent} />);
  }

  if (actor.primedClass && actor.guildId === 'master') {
    parts.push(<TextChip key="primed" label="PRIMED" value={actor.primedClass.toUpperCase()} color={theme.accent} />);
  }

  if (actor.heldPickup) {
    parts.push(
      <TextChip
        key="pickup"
        label="HOLD"
        value={`${actor.heldPickup.type.toUpperCase()} ×${actor.heldPickup.hitsLeft}`}
        color={theme.inkDim}
      />,
    );
  }

  if (actor.miasmaActive) {
    parts.push(<TextChip key="miasma" label="MIASMA" value="ON" color={theme.bad} />);
  }

  if (parts.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 4,
        display: 'flex',
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {parts}
    </div>
  );
}

function OrbRow({ filled, total, color, size = 6 }: { filled: number; total: number; color: string; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            style={{
              width: size * 2,
              height: size * 2,
              borderRadius: '50%',
              background: on ? color : theme.bgDeep,
              border: `1px solid ${on ? color : theme.line}`,
            }}
          />
        );
      })}
    </div>
  );
}

function TextChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span
      style={{
        fontFamily: theme.fontMono,
        fontSize: 9,
        letterSpacing: 1,
        color: theme.inkDim,
      }}
    >
      {label}{' '}
      <span style={{ color }}>{value}</span>
    </span>
  );
}
