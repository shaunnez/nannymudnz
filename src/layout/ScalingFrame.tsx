import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FULLSCREEN_EXIT_EVENT } from './fullscreenConstants';
import { FullscreenContext } from './useFullscreen';
import { loadKeyBindings, KEYBINDINGS_CHANGED_EVENT } from '../input/keyBindings';

interface Props {
  children: ReactNode;
}

function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function measure(): { w: number; h: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (isStandalone()) return { w, h };

  // In browser mode subtract safe-area insets so the game frame clears the
  // home indicator bar (bottom) and notch (left/right in landscape).
  // env() resolves to 0 on devices/browsers that don't support it.
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'visibility:hidden', 'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';');
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const top    = parseFloat(cs.paddingTop)    || 0;
  const right  = parseFloat(cs.paddingRight)  || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  const left   = parseFloat(cs.paddingLeft)   || 0;
  el.remove();

  return { w: w - left - right, h: h - top - bottom };
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
