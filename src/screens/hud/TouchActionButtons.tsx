import { useState } from 'react';
import { dispatchTouchButton } from '../../game/input/PhaserInputAdapter';

const BTN_SIZE = 64;
// left:55 keeps buttons ~24px from physical screen edge at 390px width (55 * 390/900)
// safely outside iOS Safari's ~20px edge-swipe zone
const LEFT_OFFSET = 55;

interface ActionBtnProps {
  label: string;
  action: 'attack' | 'block';
  color: string;
}

function ActionBtn({ label, action, color }: ActionBtnProps) {
  const [pressed, setPressed] = useState(false);

  const onStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    dispatchTouchButton(action, true);
  };

  const onEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(false);
    dispatchTouchButton(action, false);
  };

  return (
    <div
      onTouchStart={onStart}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: '50%',
        background: pressed ? `${color}30` : 'rgba(255,255,255,0.07)',
        border: `2px solid ${pressed ? color : 'rgba(255,255,255,0.22)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent' as string,
        cursor: 'pointer',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        transition: 'transform 60ms ease, background 80ms ease, border-color 80ms ease',
        boxShadow: pressed ? `0 0 0 3px ${color}40` : 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 22,
          fontWeight: 700,
          color: pressed ? color : 'rgba(255,255,255,0.7)',
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'color 80ms ease',
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
        left: LEFT_OFFSET,
        bottom: 168,
        display: 'flex',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      <ActionBtn label="J" action="attack" color="rgba(255,200,80,1)" />
      <ActionBtn label="K" action="block"  color="rgba(120,180,255,1)" />
    </div>
  );
}
