import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FULLSCREEN_EXIT_EVENT } from './fullscreenConstants';
import { FullscreenContext } from './useFullscreen';

interface Props {
  children: ReactNode;
}

export function ScalingFrame({ children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wasFullscreenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // Browser refused (iframe without allow="fullscreen", user gesture
        // missing, etc.). Graceful no-op.
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      if (wasFullscreenRef.current && !nowFullscreen) {
        window.dispatchEvent(new CustomEvent(FULLSCREEN_EXIT_EVENT));
      }
      wasFullscreenRef.current = nowFullscreen;
      setIsFullscreen(nowFullscreen);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      // Don't hijack modified F (Ctrl+F find, Cmd+F, Alt+F, etc.).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // Don't hijack F while typing in an input.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggle }}>
      <div ref={rootRef} style={outerStyle}>
        <div style={innerStyle}>
          {children}
        </div>
      </div>
    </FullscreenContext.Provider>
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
