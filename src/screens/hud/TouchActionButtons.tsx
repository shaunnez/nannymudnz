import { dispatchTouchButton } from '../../game/input/PhaserInputAdapter';

const BTN_SIZE = 64;

interface ActionBtnProps {
  label: string;
  action: 'attack' | 'block';
  color: string;
}

function ActionBtn({ label, action, color }: ActionBtnProps) {
  return (
    <div
      onTouchStart={(e) => { e.preventDefault(); dispatchTouchButton(action, true); }}
      onTouchEnd={(e) => { e.preventDefault(); dispatchTouchButton(action, false); }}
      onTouchCancel={(e) => { e.preventDefault(); dispatchTouchButton(action, false); }}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: '50%',
        background: `${color}18`,
        border: `2px solid ${color}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent' as string,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 22,
          fontWeight: 700,
          color,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function TouchActionButtons() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 14,
        bottom: 148,
        display: 'flex',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      <ActionBtn label="J" action="attack" color="rgba(255,200,80,1)" />
      <ActionBtn label="K" action="block"  color="rgba(120,180,255,1)" />
    </div>
  );
}
