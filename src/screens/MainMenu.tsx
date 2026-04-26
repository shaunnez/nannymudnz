import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { theme, SectionLabel } from '../ui';
import type { AppScreen, GameMode } from '../state/useAppState';
import { useIsMobile } from '../hooks/useIsMobile';

interface MenuItem {
  id: string;
  label: string;
  sub: string;
  target: AppScreen | null;
  mode?: GameMode;
  enabled: boolean;  // false → visually dimmed, click is no-op (unbuilt screens)
  href?: string;     // external link — opens in new tab instead of navigating
}

// Items whose target screen doesn't exist yet are marked enabled:false and
// dimmed. Batch 3 turns on charselect; batch 6 enables moves + settings; batch
// 7 enables mp_hub.
const MENU_ITEMS: MenuItem[] = [
  { id: 'vs',    label: 'VERSUS',        sub: 'Two-player arena combat',       target: 'charselect', mode: 'vs',    enabled: true },
  { id: 'stage', label: 'STAGE MODE',    sub: 'Ascend the fifteen guilds',     target: 'charselect', mode: 'stage', enabled: true },
  { id: 'surv',  label: 'SURVIVAL',      sub: 'Endless waves, ranked table',   target: 'charselect', mode: 'surv',  enabled: true },
  { id: 'mp',    label: 'MULTIPLAYER',   sub: 'Up to 8 · FFA · Teams · Co-op', target: 'mp_hub',     enabled: true },
  { id: 'batt',  label: 'BATTLE',        sub: '4 vs 4 · configure all 8 slots',target: 'charselect', mode: 'batt',  enabled: true },
  { id: 'champ', label: 'CHAMPIONSHIP',  sub: 'Bracketed tournament',          target: 'charselect', mode: 'champ', enabled: true },
  { id: 'moves', label: 'MOVE LIST',     sub: 'Ability reference per guild',   target: 'moves',      enabled: true },
  { id: 'guide', label: 'GAME GUIDE',   sub: 'Rules, guilds, and controls',   target: null,         enabled: true, href: 'https://github.com/shaunnez/nannymudnz/raw/refs/heads/main/docs/GAME-GUIDE.pdf' },
  { id: 'set',   label: 'SETTINGS',     sub: 'Controls · video · audio',      target: 'settings',   enabled: true },
];


const NEWS = [
  { d: '26 APR', t: 'Items — 21 pickups, crates, elemental throws',  b: 'Weapons, gems, and consumables drop from enemies and breakable crates. Gems apply passive buffs on pickup and remove on drop. Consumables self-use on contact. Throw weapons for elemental VFX — torch, bomb, smoke, throwing star.' },
  { d: '26 APR', t: 'Story mode reborn — stages, scaling, unlocks',  b: 'Each of the nine stages runs its own wave composition with guild enemies on the full vsAI pipeline. Stats scale per level. Beat a stage to unlock the next; a padlock shows uncleared maps.' },
  { d: '26 APR', t: 'Eight bosses with phase transitions',            b: 'Every stage ends in a multi-phase boss fight — health thresholds trigger new move sets, summons, and stat scaling. Eight boss variants in total.' },
  { d: '26 APR', t: 'Survival, Battle & Championship live',           b: 'All three modes are now playable end-to-end. Survival runs endless ranked waves. Battle is a configurable 4v4 with 8 slot-lock screens. Championship runs a full bracketed tournament.' },
  { d: '26 APR', t: 'Full mobile support',                            b: 'Virtual joystick, on-screen J/K/pause buttons, viewport scaling, install prompt, and portrait block. Runs on iOS and Android browsers.' },
  { d: '26 APR', t: 'Install as a PWA',                               b: 'Nannymud is now a Progressive Web App. Add to home screen for a fullscreen standalone launch and offline caching via service worker.' },
  { d: '26 APR', t: 'Per-mode difficulty + enemy HP scale',           b: 'Settings exposes independent CPU difficulty for VS, Battle, and Championship. Story mode adds an enemy HP scale slider (10–100 %).' },
  { d: '26 APR', t: 'New VFX toggle in Settings → Video',             b: 'Opt in to craftpix slash and explosion sprites — AI-generated pixel art overlaying procedural effects. The chibi Hunter sprite also swaps in when New VFX is enabled.' },
  { d: '26 APR', t: 'Loading screens overhauled',                     b: 'Unified tile grid shows real per-player asset progress. Battle mode gets an 8-card layout so you can see every fighter loading in.' },
  { d: '26 APR', t: 'Balance pass — all 15 guilds in the band',       b: 'Nine iterations of the 4 500-match runner. Every guild sits within 40–60 % win rate across all matchups.' },
  { d: '26 APR', t: 'MP lobby + room browser polished',               b: 'Public room list, chat panel, meta strip, slot cards, tap-to-ready on mobile, Battle 8-slot config grid, and host kick all landed.' },
  { d: '26 APR', t: '38-screen Playwright tour green',                b: 'Every screen visits cleanly. Deep-link any screen in dev with ?screen=results&outcome=win&p1=adventurer. Generates a screenshot bug report.' },
  { d: '24 APR', t: 'Druid bear form & Ranger wolf pet',              b: 'Druid shapeshifts into a bear with a new ability set; Hunter summons a wolf pet with its own AI and cycling modes.' },
  { d: '24 APR', t: 'PixelLab VFX sprites across all guilds',         b: 'Over 50 ability effects — impacts, flashes, bursts, and teleport pops — replaced with AI-generated pixel art.' },
  { d: '24 APR', t: 'LF2-style tiled stage backdrops',                b: 'All 9 stages now scroll with layered pixel-art backgrounds, matching the classic Little Fighter 2 look.' },
  { d: '24 APR', t: 'Stealth system & vampire nocturne',              b: 'Vampire can vanish from opponent view, break stealth for a bonus hit, and trigger a full nocturne darkness dome.' },
  { d: '24 APR', t: 'Live MP lobby with chat',                        b: 'Multiplayer lobby upgraded with player slot cards, room metadata strip, and real-time in-lobby chat.' },
  { d: '24 APR', t: 'Multiplayer stats & post-match screen',          b: 'Damage dealt, kills, ability usage, and a winner banner now appear at the end of every online match.' },
  { d: '24 APR', t: 'Public room browser live',                       b: 'Open lobbies are listed in real time — no code needed, just click and join.' },
  { d: '24 APR', t: 'Guild balancer ships',                           b: 'Automated 4 500-match bot-vs-bot matrix keeps all 15 guilds within a 40–60 % win-rate band.' },
  { d: '24 APR', t: '1v1 multiplayer launched (Colyseus)',            b: 'Full online 1v1 mode with server-authoritative simulation, state sync, and 50 ms interpolation went live.' },
];

interface Props {
  onPick: (target: AppScreen, mode?: GameMode) => void;
}

export function MainMenu({ onPick }: Props) {
  const [sel, setSel] = useState(0);
  const mobile = useIsMobile();

  const activate = (index: number) => {
    const item = MENU_ITEMS[index];
    if (!item || !item.enabled) return;
    if (item.href) { window.open(item.href, '_blank', 'noopener'); return; }
    if (!item.target) return;
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
          padding: mobile ? '47px 48px' : '52px 48px',
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
            marginBottom: mobile ? 20 : 22,
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
                  padding: mobile ? '11px 0' : '13px 0',
                  borderBottom: `1px solid ${theme.lineSoft}`,
                  cursor: m.enabled && (m.target || m.href) ? 'pointer' : 'default',
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
                </div>
                {(m.target || m.href) && (
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
          padding: '80px 48px 56px 32px',
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

      </div>
    </div>
  );
}
