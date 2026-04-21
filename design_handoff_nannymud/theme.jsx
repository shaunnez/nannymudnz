// theme.jsx — themes + shared primitives used by both aesthetic takes.

const THEMES = {
  grimoire: {
    id: 'grimoire',
    name: 'Grimoire Arcade',
    bg: '#1a140d',
    bgDeep: '#0f0b06',
    panel: '#241b12',
    panelRaised: '#2d2218',
    ink: '#f1e6cf',
    inkDim: '#c4b698',
    inkMuted: '#8a7b60',
    line: '#4a3a25',
    lineSoft: '#3a2c1c',
    accent: '#d9a441', // brass
    warn: '#c9542a',
    good: '#8db552',
    bad: '#b93434',
    fontDisplay: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    fontBody: '"Inter", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    paperGrain: 'radial-gradient(1200px 600px at 30% -10%, rgba(217,164,65,0.08), transparent 60%), radial-gradient(800px 500px at 80% 120%, rgba(185,52,52,0.07), transparent 70%)',
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal Esports',
    bg: '#0b0f14',
    bgDeep: '#05080c',
    panel: '#111820',
    panelRaised: '#172130',
    ink: '#e6edf3',
    inkDim: '#9fb0c2',
    inkMuted: '#5f7186',
    line: '#1e2b3b',
    lineSoft: '#15202d',
    accent: '#5cf2c2', // neon mint
    warn: '#ffb347',
    good: '#5cf2c2',
    bad: '#ff5d73',
    fontDisplay: '"Space Grotesk", "Inter Tight", system-ui, sans-serif',
    fontBody: '"Inter", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    paperGrain: 'radial-gradient(1200px 600px at 30% -10%, rgba(92,242,194,0.07), transparent 60%), radial-gradient(900px 500px at 85% 110%, rgba(92,120,255,0.05), transparent 70%)',
  },
};

// CRT scanline SVG as data URI (terminal theme)
const SCANLINE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='1' fill='rgba(255,255,255,0.03)'/></svg>")`;
const PAPER = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0.08 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`;

// === Shared atomic pieces ======================================================

function SectionLabel({ theme, children, kicker, right }) {
  const mono = { fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.inkMuted };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${theme.lineSoft}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        {kicker && <span style={mono}>{kicker}</span>}
        <span style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink, letterSpacing: theme.id === 'terminal' ? '-0.01em' : '0' }}>{children}</span>
      </div>
      {right && <div style={mono}>{right}</div>}
    </div>
  );
}

function Chip({ theme, children, tone = 'default', mono = false }) {
  const tones = {
    default: { bg: theme.panelRaised, fg: theme.inkDim, bd: theme.line },
    accent:  { bg: 'transparent', fg: theme.accent, bd: theme.accent },
    bad:     { bg: 'transparent', fg: theme.bad, bd: theme.bad },
    good:    { bg: 'transparent', fg: theme.good, bd: theme.good },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', border: `1px solid ${t.bd}`, color: t.fg, background: t.bg,
      fontFamily: mono ? theme.fontMono : theme.fontBody, fontSize: 10, letterSpacing: mono ? 1 : 0,
      textTransform: mono ? 'uppercase' : 'none', borderRadius: theme.id === 'terminal' ? 2 : 0,
    }}>{children}</span>
  );
}

// Monogram tile — no SVG art; pure type + color field.
function GuildMonogram({ theme, guild, size = 64, selected = false, dim = false }) {
  const accent = guildAccent(guild, theme.id);
  const accentSoft = guildAccentSoft(guild, theme.id);
  const accentDim = guildAccentDim(guild, theme.id);
  return (
    <div style={{
      width: size, height: size,
      position: 'relative',
      background: `linear-gradient(135deg, ${accentSoft}, transparent 70%), ${theme.panelRaised}`,
      border: `1px solid ${selected ? accent : theme.line}`,
      boxShadow: selected ? `inset 0 0 0 1px ${accent}, 0 0 0 2px ${accent}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: dim ? theme.inkMuted : (selected ? accent : theme.ink),
      fontFamily: theme.id === 'terminal' ? theme.fontMono : theme.fontDisplay,
      fontSize: Math.round(size * 0.42),
      fontWeight: theme.id === 'terminal' ? 500 : 600,
      letterSpacing: theme.id === 'terminal' ? 1 : -0.5,
      opacity: dim ? 0.45 : 1,
      transition: 'all 120ms ease',
      overflow: 'hidden',
    }}>
      {/* tiny corner tick for selected */}
      {selected && (
        <>
          <span style={{ position: 'absolute', top: 3, left: 3, width: 6, height: 6, borderTop: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` }} />
          <span style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderTop: `1px solid ${accent}`, borderRight: `1px solid ${accent}` }} />
          <span style={{ position: 'absolute', bottom: 3, left: 3, width: 6, height: 6, borderBottom: `1px solid ${accent}`, borderLeft: `1px solid ${accent}` }} />
          <span style={{ position: 'absolute', bottom: 3, right: 3, width: 6, height: 6, borderBottom: `1px solid ${accent}`, borderRight: `1px solid ${accent}` }} />
        </>
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{guild.glyph}</span>
      <div style={{
        position: 'absolute', bottom: 4, left: 6, right: 6,
        height: 1, background: accentDim, opacity: 0.5,
      }} />
    </div>
  );
}

// Ascii-ish divider
function Rule({ theme, char, full = false }) {
  const c = char || (theme.id === 'terminal' ? '─' : '·');
  return (
    <div style={{ fontFamily: theme.fontMono, color: theme.inkMuted, fontSize: 10, letterSpacing: 2, opacity: 0.7, userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      {full ? c.repeat(200) : c.repeat(40)}
    </div>
  );
}

// A thin bar with fill — used for HP, MP, etc.
function MeterBar({ theme, value, max, color, height = 8, label, segmented = false, flash = false }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 1, marginBottom: 2 }}>
          <span>{label}</span>
          <span>{Math.round(value)}/{max}</span>
        </div>
      )}
      <div style={{
        height, background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, width: `${pct * 100}%`,
          background: color, transition: 'width 200ms linear',
          boxShadow: flash ? `0 0 10px ${color}` : 'none',
        }} />
        {segmented && Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i + 1) * 10}%`, width: 1, background: theme.bgDeep }} />
        ))}
      </div>
    </div>
  );
}

// Rectangle button
function Btn({ theme, children, onClick, primary = false, disabled = false, size = 'md', title }) {
  const sizes = {
    sm: { pad: '4px 10px', fs: 11 },
    md: { pad: '8px 16px', fs: 13 },
    lg: { pad: '12px 24px', fs: 15 },
  };
  const s = sizes[size];
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{
        padding: s.pad, fontSize: s.fs,
        background: primary ? theme.accent : 'transparent',
        color: primary ? theme.bgDeep : theme.ink,
        border: `1px solid ${primary ? theme.accent : theme.line}`,
        fontFamily: theme.fontMono, letterSpacing: 1, textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        borderRadius: theme.id === 'terminal' ? 2 : 0,
        transition: 'all 100ms ease',
      }}
    >{children}</button>
  );
}

Object.assign(window, { THEMES, SCANLINE, PAPER, SectionLabel, Chip, GuildMonogram, Rule, MeterBar, Btn });
