import { theme } from '../../ui';

export function MpLoading() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.fontMono,
        fontSize: 12,
        color: theme.inkMuted,
        letterSpacing: 3,
      }}
    >
      CONNECTING…
    </div>
  );
}
