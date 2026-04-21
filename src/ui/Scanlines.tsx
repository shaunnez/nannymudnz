import { SCANLINE_BG } from './theme';

export function Scanlines() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: SCANLINE_BG,
        pointerEvents: 'none',
        opacity: 0.6,
        zIndex: 5,
        mixBlendMode: 'overlay',
      }}
    />
  );
}
