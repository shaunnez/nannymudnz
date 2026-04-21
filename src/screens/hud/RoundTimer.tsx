import type { RoundState } from '../../simulation/types';
import { theme } from '../../ui';

interface Props {
  round: RoundState | null;
  animate: boolean;
}

export function RoundTimer({ round, animate }: Props) {
  const seconds = round ? Math.ceil(round.timeRemainingMs / 1000) : 0;
  const low = seconds <= 10 && round?.phase === 'fighting';
  const color = low ? theme.bad : theme.ink;
  const pulse = low && animate ? 'pulse 1s infinite' : undefined;

  return (
    <div style={{ textAlign: 'center', lineHeight: 1 }}>
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 60,
          fontVariantNumeric: 'tabular-nums',
          color,
          animation: pulse,
        }}
      >
        {String(seconds).padStart(2, '0')}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: theme.fontDisplay,
          fontSize: 10,
          letterSpacing: 2,
          color: theme.inkDim,
        }}
      >
        ROUND {round ? round.index + 1 : 1}/3
      </div>
    </div>
  );
}
