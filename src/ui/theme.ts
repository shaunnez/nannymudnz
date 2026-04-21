// Terminal theme tokens — ported from design_handoff_nannymud/theme.jsx (THEMES.terminal).
// Source-of-truth values; the handoff README has stale colors — ignore them.

export const theme = {
  id: 'terminal' as const,
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

  accent: '#5cf2c2',
  warn: '#ffb347',
  good: '#5cf2c2',
  bad: '#ff5d73',

  team1: '#5cf2c2',
  team2: '#ff5d73',
  team3: '#ffb347',
  team4: '#928bff',

  fontDisplay: '"Space Grotesk", "Inter Tight", system-ui, sans-serif',
  fontBody: '"Inter", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
} as const;

export type Theme = typeof theme;

export const SCANLINE_BG =
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='1' fill='rgba(255,255,255,0.03)'/></svg>")`;

export function guildAccent(hue: number): string {
  return `oklch(0.72 0.19 ${hue})`;
}

export function guildAccentSoft(hue: number): string {
  return `oklch(0.72 0.19 ${hue} / 0.18)`;
}

export function guildAccentDim(hue: number): string {
  return `oklch(0.55 0.14 ${hue})`;
}
