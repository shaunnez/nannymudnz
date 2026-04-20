import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// ScalingFrame fills the browser viewport with a black background and centers
// a 16:9 box inside it. Children render inside that box at whatever natural
// size they want; CSS aspect-ratio handles the letterbox math. The frame
// never overflows — on ultrawide monitors you get pillar bars, on narrow
// monitors you get letterbox bars.
export function ScalingFrame({ children }: Props) {
  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {children}
      </div>
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  background: '#000',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  margin: 0,
};

const innerStyle: React.CSSProperties = {
  aspectRatio: '16 / 9',
  width: 'min(100vw, calc(100vh * 16 / 9))',
  height: 'min(100vh, calc(100vw * 9 / 16))',
  background: '#0f172a',
  position: 'relative',
  overflow: 'hidden',
};
