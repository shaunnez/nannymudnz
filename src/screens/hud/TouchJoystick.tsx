import { useCallback, useRef } from 'react';
import { dispatchTouchJoystick } from '../../game/input/PhaserInputAdapter';

const BASE_R = 52;   // outer circle radius in virtual px
const THUMB_R = 22;  // inner thumb radius
const DEAD = 14;     // dead-zone px before direction registers
const RUN_DIST = 38; // px beyond which we set running

export function TouchJoystick() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const origin = useRef({ cx: 0, cy: 0 });

  const push = useCallback((dx: number, dy: number) => {
    const dist = Math.sqrt(dx * dx + dy * dy);
    const cap = BASE_R - THUMB_R;
    const scale = dist > cap ? cap / dist : 1;

    if (thumbRef.current) {
      thumbRef.current.style.transform =
        `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
    }

    dispatchTouchJoystick({
      left: dx < -DEAD,
      right: dx > DEAD,
      up: dy < -DEAD,
      down: dy > DEAD,
      runningLeft: dx < -RUN_DIST,
      runningRight: dx > RUN_DIST,
    });
  }, []);

  const release = useCallback(() => {
    touchId.current = null;
    if (thumbRef.current) {
      thumbRef.current.style.transform = 'translate(-50%, -50%)';
    }
    dispatchTouchJoystick({ left: false, right: false, up: false, down: false, runningLeft: false, runningRight: false });
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchId.current !== null) return;
    const t = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    origin.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    touchId.current = t.identifier;
    push(t.clientX - origin.current.cx, t.clientY - origin.current.cy);
  }, [push]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchId.current) {
        push(t.clientX - origin.current.cx, t.clientY - origin.current.cy);
        break;
      }
    }
  }, [push]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) { release(); break; }
    }
  }, [release]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 148,
        width: BASE_R * 2,
        height: BASE_R * 2,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
        border: '2px solid rgba(255,255,255,0.18)',
        pointerEvents: 'auto',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent' as string,
        userSelect: 'none',
      }}
    >
      <div
        ref={thumbRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: THUMB_R * 2,
          height: THUMB_R * 2,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          border: '2px solid rgba(255,255,255,0.4)',
          pointerEvents: 'none',
          transition: 'none',
        }}
      />
    </div>
  );
}
