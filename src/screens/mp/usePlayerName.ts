import { useCallback, useState } from 'react';

const KEY = 'nannymud-mp-player-name-v1';

export function usePlayerName(): [string, (n: string) => void] {
  const [name, setNameState] = useState(() => {
    try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
  });
  const setName = useCallback((n: string) => {
    setNameState(n);
    try { localStorage.setItem(KEY, n); } catch { /* quiet */ }
  }, []);
  return [name, setName];
}
