import { theme } from './theme';

interface MeterBarProps {
  value: number;
  max: number;
  color: string;
  height?: number;
  label?: string;
  segmented?: boolean;
  flash?: boolean;
}

export function MeterBar({
  value,
  max,
  color,
  height = 8,
  label,
  segmented = false,
  flash = false,
}: MeterBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkDim,
            letterSpacing: 1,
            marginBottom: 2,
          }}
        >
          <span>{label}</span>
          <span>
            {Math.round(value)}/{max}
          </span>
        </div>
      )}
      <div
        style={{
          height,
          background: theme.bgDeep,
          border: `1px solid ${theme.lineSoft}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct * 100}%`,
            background: color,
            transition: 'width 200ms linear',
            boxShadow: flash ? `0 0 10px ${color}` : 'none',
          }}
        />
        {segmented &&
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(i + 1) * 10}%`,
                width: 1,
                background: theme.bgDeep,
              }}
            />
          ))}
      </div>
    </div>
  );
}
