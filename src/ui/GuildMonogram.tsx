import { useState, type CSSProperties } from 'react';
import type { GuildId } from '../simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, guildAccentSoft, guildAccentDim } from './theme';

interface GuildMonogramProps {
  guildId: GuildId;
  size?: number;
  selected?: boolean;
  dim?: boolean;
}

export function GuildMonogram({
  guildId,
  size = 64,
  selected = false,
  dim = false,
}: GuildMonogramProps) {
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);
  const accentSoft = guildAccentSoft(meta.hue);
  const accentDim = guildAccentDim(meta.hue);
  const [portraitFailed, setPortraitFailed] = useState(false);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        background: `linear-gradient(135deg, ${accentSoft}, transparent 70%), ${theme.panelRaised}`,
        border: `1px solid ${selected ? accent : theme.line}`,
        boxShadow: selected ? `inset 0 0 0 1px ${accent}, 0 0 0 2px ${accent}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: dim ? theme.inkMuted : selected ? accent : theme.ink,
        fontFamily: theme.fontMono,
        fontSize: Math.round(size * 0.42),
        fontWeight: 500,
        letterSpacing: 1,
        opacity: dim ? 0.45 : 1,
        transition: 'all 120ms ease',
        overflow: 'hidden',
      }}
    >
      {selected && (
        <>
          <span style={cornerStyle(accent, { top: 3, left: 3 }, 'tl')} />
          <span style={cornerStyle(accent, { top: 3, right: 3 }, 'tr')} />
          <span style={cornerStyle(accent, { bottom: 3, left: 3 }, 'bl')} />
          <span style={cornerStyle(accent, { bottom: 3, right: 3 }, 'br')} />
        </>
      )}
      {portraitFailed ? (
        <span style={{ position: 'relative', zIndex: 1 }}>{meta.glyph}</span>
      ) : (
        <img
          src={`/sprites/${guildId}/portrait.png`}
          alt={guildId}
          onError={() => setPortraitFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            zIndex: 1,
            opacity: dim ? 0.6 : 1,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 6,
          right: 6,
          height: 1,
          background: accentDim,
          opacity: 0.5,
        }}
      />
    </div>
  );
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function cornerStyle(accent: string, pos: CSSProperties, corner: Corner): CSSProperties {
  const borders: CSSProperties = {};
  if (corner === 'tl') {
    borders.borderTop = `1px solid ${accent}`;
    borders.borderLeft = `1px solid ${accent}`;
  }
  if (corner === 'tr') {
    borders.borderTop = `1px solid ${accent}`;
    borders.borderRight = `1px solid ${accent}`;
  }
  if (corner === 'bl') {
    borders.borderBottom = `1px solid ${accent}`;
    borders.borderLeft = `1px solid ${accent}`;
  }
  if (corner === 'br') {
    borders.borderBottom = `1px solid ${accent}`;
    borders.borderRight = `1px solid ${accent}`;
  }
  return {
    position: 'absolute',
    width: 6,
    height: 6,
    ...pos,
    ...borders,
  };
}
