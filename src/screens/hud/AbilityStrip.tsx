import type { Actor } from '@nannymud/shared/simulation/types';
import { getGuild } from '@nannymud/shared/simulation/guildData';
import { theme } from '../../ui';

interface Props {
  actor: Actor;
  side: 'p1' | 'p2';
  showKeys: boolean;
  simTimeMs: number;
}

const KEY_LABELS = ['1', '2', '3', '4', '5', 'R'];

export function AbilityStrip({ actor, side, showKeys, simTimeMs }: Props) {
  const guild = getGuild(actor.guildId!);
  const cards = [...guild.abilities.slice(0, 5), guild.rmb];

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {cards.map((a, i) => {
        const cdUntil = actor.abilityCooldowns[a.id] || 0;
        const cdRemaining = Math.max(0, cdUntil - simTimeMs);
        const onCd = cdRemaining > 0;
        const cdFrac = onCd ? cdRemaining / a.cooldownMs : 0;
        const unaffordable = actor.mp < a.cost;
        const dim = onCd || unaffordable;

        return (
          <div
            key={a.id}
            style={{
              position: 'relative',
              width: 56,
              height: 64,
              background: theme.panel,
              border: `1px solid ${side === 'p1' ? theme.team1 : theme.team2}`,
              borderRadius: 4,
              padding: 4,
              opacity: dim ? 0.45 : 1,
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: theme.ink,
              overflow: 'hidden',
            }}
          >
            {showKeys && (
              <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, color: theme.inkDim }}>
                {KEY_LABELS[i]}
              </div>
            )}
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: theme.accent }}>
              {a.cost}
            </div>
            <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 9, lineHeight: 1.1 }}>{a.name}</div>
            </div>
            {onCd && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${cdFrac * 100}%`,
                  background: 'rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
