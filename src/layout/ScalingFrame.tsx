import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FULLSCREEN_EXIT_EVENT } from './fullscreenConstants';
import { FullscreenContext } from './useFullscreen';
import { loadKeyBindings, KEYBINDINGS_CHANGED_EVENT } from '../input/keyBindings';

interface Props {
  children: ReactNode;
}

function measure() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function ScalingFrame({ children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wasFullscreenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dims, setDims] = useState(measure);

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
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setDims(measure()), 150);
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  useEffect(() => {
    let fullscreenKey = loadKeyBindings().fullscreen;
    const refresh = () => { fullscreenKey = loadKeyBindings().fullscreen; };
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack modified variants (Ctrl+F find, Cmd+F, Alt+F, etc.).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== fullscreenKey.toLowerCase()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(KEYBINDINGS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(KEYBINDINGS_CHANGED_EVENT, refresh);
    };
  }, []);

  const { w, h } = dims;
  const gameW = Math.min(w, h * 16 / 9);
  const gameH = Math.min(h, w * 9 / 16);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggle }}>
      <div ref={rootRef} style={{ width: w, height: h, background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', margin: 0 }}>
        <div style={{ width: gameW, height: gameH, background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </FullscreenContext.Provider>
  );
}
