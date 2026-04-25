import type { ReactNode, MouseEventHandler } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { theme } from './theme';

interface BtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  primary?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  type?: 'button' | 'submit';
}

const SIZES = {
  sm: { pad: '4px 10px', fs: 11 },
  md: { pad: '8px 16px', fs: 13 },
  lg: { pad: '12px 24px', fs: 15 },
} as const;

const SIZES_MOBILE = {
  sm: { pad: '4px 10px', fs: 11 },
  md: { pad: '12px 22px', fs: 15 },
  lg: { pad: '12px 24px', fs: 15 },
} as const;

export function Btn({
  children,
  onClick,
  primary = false,
  disabled = false,
  size = 'md',
  title,
  type = 'button',
}: BtnProps) {
  const mobile = useIsMobile();
  const s = mobile ? SIZES_MOBILE[size] : SIZES[size];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: s.pad,
        fontSize: s.fs,
        background: primary ? theme.accent : 'transparent',
        color: primary ? theme.bgDeep : theme.ink,
        border: `1px solid ${primary ? theme.accent : theme.line}`,
        fontFamily: theme.fontMono,
        letterSpacing: 1,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        borderRadius: 2,
        transition: 'all 100ms ease',
      }}
    >
      {children}
    </button>
  );
}
