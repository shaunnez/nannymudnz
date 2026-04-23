import type { Actor } from '@nannymud/shared/simulation/types';
import { getGuild } from '@nannymud/shared/simulation/guildData';
import { theme } from '../../ui';
import { ComboDisplay } from '../../ui/ComboDisplay';

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
        const cdUntil = actor.abilityCooldowns.get(a.id) ?? 0;
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
              width: 68,
              height: 92,
              background: theme.panel,
              border: `1px solid ${side === 'p1' ? theme.team1 : theme.team2}`,
              borderRadius: 4,
              padding: 5,
              opacity: dim ? 0.45 : 1,
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: theme.ink,
              overflow: 'hidden',
            }}
          >
            {showKeys && (
              <div style={{ position: 'absolute', top: 3, left: 5, fontSize: 14, fontWeight: 700, color: theme.inkDim, letterSpacing: 0 }}>
                {KEY_LABELS[i]}
              </div>
            )}
            <div style={{ position: 'absolute', top: 3, right: 5, fontSize: 11, color: theme.accent }}>
              {a.cost}
            </div>
            <div style={{ position: 'absolute', bottom: 5, left: 4, right: 4, textAlign: 'center' }}>
              <div style={{ fontSize:8, lineHeight: 1.1, marginBottom: 3, color: theme.ink }}>{a.name}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ComboDisplay combo={a.combo} size={10} color={theme.inkMuted} gap={2} />
              </div>
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
