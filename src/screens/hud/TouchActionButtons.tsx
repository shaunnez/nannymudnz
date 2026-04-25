import { useState } from 'react';
import { dispatchTouchButton } from '../../game/input/PhaserInputAdapter';

const BTN_SIZE = 64;
const LEFT_OFFSET = 55;

type TouchAction = 'attack' | 'block' | 'grab' | 'jump';

interface ActionBtnProps {
  label: string;
  action: TouchAction;
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

function SpaceBtn() {
  const [pressed, setPressed] = useState(false);
  const color = 'rgba(160,220,160,1)';

  const onStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    dispatchTouchButton('jump', true);
  };

  const onEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(false);
    dispatchTouchButton('jump', false);
  };

  return (
    <div
      onTouchStart={onStart}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      style={{
        width: BTN_SIZE * 3 + 12 * 2,
        height: 40,
        borderRadius: 20,
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
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 60ms ease, background 80ms ease, border-color 80ms ease',
        boxShadow: pressed ? `0 0 0 3px ${color}40` : 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 3,
          color: pressed ? color : 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'color 80ms ease',
        }}
      >
        SPACE
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
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <ActionBtn label="J" action="attack" color="rgba(255,200,80,1)" />
        <ActionBtn label="K" action="block"  color="rgba(120,180,255,1)" />
        <ActionBtn label="L" action="grab"   color="rgba(220,140,220,1)" />
      </div>
      <SpaceBtn />
    </div>
  );
}
