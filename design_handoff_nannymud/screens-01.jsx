// screens.jsx — All 12 screens for the Nannymud prototype.
// Both aesthetic themes use the same component bodies; `theme` prop drives styling.

// =================================================================
// 01 · TITLE / SPLASH
// =================================================================
function TitleScreen({ theme, onStart }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 500); return () => clearInterval(t); }, []);
  const cursor = tick % 2 === 0 ? '▌' : ' ';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {/* subtle overlay */}
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 24, left: 24, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        LYSATOR · LINKÖPING · EST. 1990 · BUILD 0.4.2
      </div>
      <div style={{ position: 'absolute', top: 24, right: 24, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        FAN PROTOTYPE · NON-COMMERCIAL
      </div>

      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 6, marginBottom: 14 }}>
          THE FIFTEEN GUILDS PRESENT
        </div>
        <div style={{
          fontFamily: theme.fontDisplay,
          fontSize: 140, lineHeight: 0.9,
          color: theme.ink,
          letterSpacing: theme.id === 'terminal' ? '-0.04em' : '-0.02em',
          fontWeight: theme.id === 'terminal' ? 600 : 500,
        }}>
          NANNYMUD
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontStyle: 'italic', fontSize: 34, color: theme.accent, marginTop: -6, letterSpacing: theme.id === 'terminal' ? '0.02em' : '0.01em' }}>
          {theme.id === 'terminal' ? '// Little Fighter of Lysator' : 'Little Fighter of Lysator'}
        </div>

        <div style={{ marginTop: 60, fontFamily: theme.fontMono, fontSize: 12, color: theme.inkDim, letterSpacing: 3 }}>
          <span onClick={onStart} style={{ cursor: 'pointer', borderBottom: `1px dashed ${theme.accent}`, color: theme.accent, paddingBottom: 3 }}>
            PRESS START{cursor}
          </span>
        </div>
      </div>

      {/* bottom marquee */}
      <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 48, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>15 GUILDS</span><span>·</span><span>136 QUESTS</span><span>·</span><span>50,000 ROOMS</span><span>·</span><span>SINCE APRIL 20</span>
      </div>
    </div>
  );
}

// =================================================================
// 02 · MAIN MENU
// =================================================================
const MENU_ITEMS = [
  { id: 'vs',    label: 'VERSUS',        sub: 'Two-player arena combat',       mode: 'charselect' },
  { id: 'stage', label: 'STAGE MODE',    sub: 'Ascend the fifteen guilds',     mode: 'charselect' },
  { id: 'surv',  label: 'SURVIVAL',      sub: 'Endless waves, ranked table',   mode: 'charselect' },
  { id: 'mp',    label: 'MULTIPLAYER',   sub: 'Up to 8 · FFA · Teams · Co-op', mode: 'mp_hub' },
  { id: 'batt',  label: 'BATTLE',        sub: 'Up to 8 fighters, free-for-all',mode: 'charselect' },
  { id: 'champ', label: 'CHAMPIONSHIP',  sub: 'Bracketed tournament',          mode: 'charselect' },
  { id: 'diff',  label: '1P DIFFICULTY', sub: 'Training · Knight · Master',    mode: null, slider: true },
  { id: 'moves', label: 'MOVE LIST',     sub: 'Ability reference per guild',   mode: 'moves' },
  { id: 'set',   label: 'SETTINGS',      sub: 'Controls · video · audio',      mode: 'settings' },
];

function MainMenuScreen({ theme, onPick }) {
  const [sel, setSel] = React.useState(0);
  const [difficulty, setDifficulty] = React.useState(2);
  const diffLabels = ['Training', 'Easy', 'Knight', 'Veteran', 'Master', 'Mats Himself'];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* LEFT — menu list */}
      <div style={{ flex: '0 0 46%', padding: '56px 48px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 3, marginBottom: 6 }}>MAIN MENU</div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 42, color: theme.ink, letterSpacing: '-0.02em', marginBottom: 28 }}>
          Choose your engagement
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {MENU_ITEMS.map((m, i) => {
            const active = i === sel;
            return (
              <div key={m.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => m.mode ? onPick(m.mode, m.id) : null}
                style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'center',
                  padding: '12px 0', borderBottom: `1px solid ${theme.lineSoft}`,
                  cursor: m.mode ? 'pointer' : 'default',
                }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: active ? theme.accent : theme.inkMuted }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: active ? theme.accent : theme.ink, letterSpacing: theme.id === 'terminal' ? '0.02em' : 0 }}>
                    {active && <span style={{ color: theme.accent, marginRight: 8 }}>▸</span>}
                    {m.label}
                  </div>
                  <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkMuted }}>{m.sub}</div>
                  {m.slider && active && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="range" min="0" max="5" value={difficulty} onChange={e => setDifficulty(+e.target.value)}
                        style={{ flex: 1, accentColor: theme.accent }} />
                      <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.accent, minWidth: 100 }}>{diffLabels[difficulty]}</span>
                    </div>
                  )}
                </div>
                {m.mode && <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: active ? theme.accent : theme.inkMuted }}>→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — news / scroll */}
      <div style={{ flex: 1, padding: '56px 48px 56px 32px', borderLeft: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
        <SectionLabel theme={theme} kicker="SCROLL" right="NANNY.LYSATOR.LIU.SE">News from the Wizards</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {[
            { d: '20 APR', t: 'Mats returns the Red Throne rotation', b: 'The passive drain has been reduced by 20%. Champion mains rejoice and retreat — briefly.' },
            { d: '18 APR', t: 'Lepers balance patch', b: 'Contagion no longer jumps to dead targets. Miasma aura no longer removes carpet textures in Market Square.' },
            { d: '15 APR', t: 'Mages Guild hosts open tower', b: 'Walk the windows. Do not linger. Recruitment open until the solstice.' },
            { d: '11 APR', t: 'Server anniversary — 36 years', b: 'Founded April 20, 1990 at Lysator. Original wizards: Beldin, Titleist, Vulcan, Astrodeath.' },
          ].map((n, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${theme.lineSoft}` }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 1 }}>{n.d}</div>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink, marginBottom: 4 }}>{n.t}</div>
                <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.5 }}>{n.b}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 'auto', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
          <span>P1 · KEYBOARD</span><span>P2 · NONE</span><span>PING · 14MS</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TitleScreen, MainMenuScreen });
