import { useEffect, useState } from 'react';

/** True when the narrowest screen dimension is under 600 CSS pixels — phones in any orientation. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => Math.min(window.screen.width, window.screen.height) < 600,
  );
  useEffect(() => {
    const check = () => setMobile(Math.min(window.screen.width, window.screen.height) < 600);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}
