import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { theme, SectionLabel } from '../ui';
import type { AppScreen, GameMode } from '../state/useAppState';

interface MenuItem {
  id: string;
  label: string;
  sub: string;
  target: AppScreen | null;
  mode?: GameMode;
  slider?: boolean;
  enabled: boolean;  // false → visually dimmed, click is no-op (unbuilt screens)
}

// Items whose target screen doesn't exist yet are marked enabled:false and
// dimmed. Batch 3 turns on charselect; batch 6 enables moves + settings; batch
// 7 enables mp_hub.
const MENU_ITEMS: MenuItem[] = [
  { id: 'vs',    label: 'VERSUS',        sub: 'Two-player arena combat',       target: 'charselect', mode: 'vs',    enabled: true },
  { id: 'stage', label: 'STAGE MODE',    sub: 'Ascend the fifteen guilds',     target: 'charselect', mode: 'stage', enabled: true },
  { id: 'surv',  label: 'SURVIVAL',      sub: 'Endless waves, ranked table',   target: 'charselect', mode: 'surv',  enabled: true },
  { id: 'mp',    label: 'MULTIPLAYER',   sub: 'Up to 8 · FFA · Teams · Co-op', target: 'mp_hub',     enabled: true },
  { id: 'batt',  label: 'BATTLE',        sub: '4 vs 4 · configure all 8 slots',target: 'charselect', mode: 'batt',  enabled: false },
  { id: 'champ', label: 'CHAMPIONSHIP',  sub: 'Bracketed tournament',          target: 'charselect', mode: 'champ', enabled: true },
  { id: 'diff',  label: '1P DIFFICULTY', sub: 'Training · Knight · Master',    target: null, slider: true, enabled: true },
  { id: 'moves', label: 'MOVE LIST',     sub: 'Ability reference per guild',   target: 'moves',      enabled: true },
  { id: 'set',   label: 'SETTINGS',      sub: 'Controls · video · audio',      target: 'settings',   enabled: true },
];

const DIFFICULTY_LABELS = ['Training', 'Easy', 'Knight', 'Veteran', 'Master', 'Mats Himself'];

const NEWS = [
  { d: '20 APR', t: 'Mats returns the Red Throne rotation', b: 'The passive drain has been reduced by 20%. Champion mains rejoice and retreat — briefly.' },
  { d: '18 APR', t: 'Lepers balance patch',                 b: 'Contagion no longer jumps to dead targets. Miasma aura no longer removes carpet textures in Market Square.' },
  { d: '15 APR', t: 'Mages Guild hosts open tower',         b: 'Walk the windows. Do not linger. Recruitment open until the solstice.' },
  { d: '11 APR', t: 'Server anniversary — 36 years',        b: 'Founded April 20, 1990 at Lysator. Original wizards: Beldin, Titleist, Vulcan, Astrodeath.' },
];

interface Props {
  onPick: (target: AppScreen, mode?: GameMode) => void;
}

export function MainMenu({ onPick }: Props) {
  const [sel, setSel] = useState(0);
  const [difficulty, setDifficulty] = useState(2);

  const activate = (index: number) => {
    const item = MENU_ITEMS[index];
    if (!item || !item.enabled || !item.target) return;
    onPick(item.target, item.mode);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSel((s) => (s + 1) % MENU_ITEMS.length);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSel((s) => (s - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        activate(sel);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      {/* LEFT — menu list */}
      <div
        style={{
          flex: '0 0 46%',
          padding: '52px 48px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.inkMuted,
            letterSpacing: 3,
            marginBottom: 6,
          }}
        >
          MAIN MENU
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 36,
            color: theme.ink,
            letterSpacing: '-0.02em',
            marginBottom: 22,
          }}
        >
          Choose your engagement
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {MENU_ITEMS.map((m, i) => {
            const active = i === sel;
            const disabledColor = theme.inkMuted;
            return (
              <div
                key={m.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => activate(i)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: `1px solid ${theme.lineSoft}`,
                  cursor: m.enabled && m.target ? 'pointer' : 'default',
                  opacity: m.enabled ? 1 : 0.45,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.fontMono,
                    fontSize: 15,
                    fontWeight: 500,
                    color: active ? theme.accent : theme.ink,
                    letterSpacing: 1,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 21,
                      color: active && m.enabled ? theme.accent : theme.ink,
                      letterSpacing: '0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    {active && m.enabled && (
                      <span style={{ color: theme.accent, marginRight: 8 }}>▸</span>
                    )}
                    {m.label}
                    {!m.enabled && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontFamily: theme.fontMono,
                          fontSize: 9,
                          color: disabledColor,
                          letterSpacing: 2,
                        }}
                      >
                        — SOON
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fontBody,
                      fontSize: 14,
                      color: theme.inkDim,
                      lineHeight: 1.5,
                      marginTop: 4,
                    }}
                  >
                    {m.sub}
                  </div>
                  {m.slider && active && (
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <input
                        type="range"
                        min={0}
                        max={5}
                        value={difficulty}
                        onChange={(e) => setDifficulty(+e.target.value)}
                        style={{ flex: 1, accentColor: theme.accent }}
                      />
                      <span
                        style={{
                          fontFamily: theme.fontMono,
                          fontSize: 11,
                          color: theme.accent,
                          minWidth: 100,
                        }}
                      >
                        {DIFFICULTY_LABELS[difficulty]}
                      </span>
                    </div>
                  )}
                </div>
                {m.target && (
                  <ChevronRight
                    size={22}
                    strokeWidth={2.25}
                    color={active && m.enabled ? theme.accent : theme.inkDim}
                    style={{ display: 'block' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — news / scroll */}
      <div
        style={{
          flex: 1,
          padding: '56px 48px 56px 32px',
          borderLeft: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          overflow: 'hidden',
        }}
      >
        <SectionLabel kicker="SCROLL" right="NANNY.LYSATOR.LIU.SE">
          News from the Wizards
        </SectionLabel>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflow: 'auto',
          }}
        >
          {NEWS.map((n, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr',
                gap: 14,
                paddingBottom: 14,
                borderBottom: `1px solid ${theme.lineSoft}`,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.accent,
                  letterSpacing: 1,
                }}
              >
                {n.d}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: theme.fontDisplay,
                    fontSize: 16,
                    color: theme.ink,
                    marginBottom: 4,
                  }}
                >
                  {n.t}
                </div>
                <div
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 12,
                    color: theme.inkDim,
                    lineHeight: 1.5,
                  }}
                >
                  {n.b}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 'auto',
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
          }}
        >
          <span>P1 · KEYBOARD</span>
          <span>P2 · NONE</span>
          <span>PING · 14MS</span>
        </div>
      </div>
    </div>
  );
}
