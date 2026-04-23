import type { Actor } from '@nannymud/shared/simulation/types';
import { theme } from '../../ui';
import { MeterBar } from '../../ui/MeterBar';

interface Props {
  boss: Actor | null;
}

export function BossSlot({ boss }: Props) {
  const name = boss?.kind ?? '';
  const hp = boss?.hp ?? 0;
  const hpMax = boss?.hpMax ?? 1;
  const visible = !!boss;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          width: 54,
          height: 54,
          borderRadius: 6,
          border: `2px solid ${theme.bad}`,
          background: `linear-gradient(135deg, rgba(255,93,115,0.15), transparent 70%), ${theme.panelRaised}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontMono,
          fontSize: 22,
          color: theme.bad,
        }}
      >
        ✴
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 11,
              letterSpacing: 2,
              color: theme.bad,
            }}
          >
            BOSS
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 18,
              color: theme.ink,
              letterSpacing: '0.01em',
              textTransform: 'uppercase',
            }}
          >
            {name}
          </span>
        </div>
        <div style={{ marginTop: 2 }}>
          <MeterBar value={hp} max={hpMax} color={theme.bad} height={10} />
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.inkDim,
            letterSpacing: 1,
            textAlign: 'right',
          }}
        >
          HP {Math.round(hp)}/{hpMax}
        </div>
      </div>
    </div>
  );
}
