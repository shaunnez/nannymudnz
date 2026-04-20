import { createContext, useContext } from 'react';

interface FullscreenCtx {
  isFullscreen: boolean;
  toggle: () => void;
}

export const FullscreenContext = createContext<FullscreenCtx>({
  isFullscreen: false,
  toggle: () => {},
});

export function useFullscreen(): FullscreenCtx {
  return useContext(FullscreenContext);
}
