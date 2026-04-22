import { theme } from '../../ui';

interface Props {
  code: string;
}

/**
 * Small badge that displays the room code in a corner so users can share it.
 * Position the parent with `position: relative` and place this absolutely as needed.
 */
export function RoomCodeBadge({ code }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
      }}
    >
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 9,
          color: theme.inkMuted,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        Room Code
      </div>
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 18,
          color: theme.accent,
          letterSpacing: 6,
          padding: '4px 10px',
          border: `1px solid ${theme.accent}55`,
          background: `${theme.accent}0e`,
        }}
      >
        {code}
      </div>
    </div>
  );
}
