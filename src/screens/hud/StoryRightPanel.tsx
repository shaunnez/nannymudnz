import type { Actor } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';
import { AbilityStrip } from './AbilityStrip';

interface Props {
  actor: Actor;
  simTimeMs: number;
  bossSpawned: boolean;
}

const SLOT_COUNT = 6;

export function StoryRightPanel({ actor, simTimeMs, bossSpawned }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 10,
          letterSpacing: 3,
          color: bossSpawned ? theme.bad : theme.inkDim,
        }}
      >
        {bossSpawned ? 'P1 · ABILITIES' : 'STANDBY'}
      </div>
      {bossSpawned ? (
        <AbilityStrip actor={actor} side="p1" showKeys={false} simTimeMs={simTimeMs} />
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: SLOT_COUNT }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 68,
                height: 92,
                background: theme.panel,
                border: `1px solid ${theme.lineSoft}`,
                borderRadius: 4,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
