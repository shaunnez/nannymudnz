import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { theme } from './theme';

const ARROW_ICONS: Record<string, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

const LETTER_TOKENS: Record<string, string> = {
  attack: 'J',
  block: 'K',
  grab: 'L',
};

interface Props {
  combo: string;
  size?: number;
  color?: string;
  gap?: number;
  style?: CSSProperties;
}

export function ComboDisplay({ combo, size = 14, color = theme.ink, gap = 3, style }: Props) {
  const segments = combo.split(',');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        fontFamily: theme.fontMono,
        fontSize: size,
        color,
        letterSpacing: 2,
        lineHeight: 1,
        ...style,
      }}
    >
      {segments.map((seg, i) => {
        const atoms = seg.split('+');
        return (
          <Fragment key={i}>
            {atoms.map((token, j) => {
              const t = token.trim();
              const Icon = ARROW_ICONS[t];
              const node = Icon ? (
                <Icon size={size} strokeWidth={2.5} style={{ display: 'block' }} />
              ) : (
                <span>{LETTER_TOKENS[t] ?? t}</span>
              );
              return (
                <Fragment key={j}>
                  {j > 0 && <span>+</span>}
                  {node}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </span>
  );
}
