// screens-02.jsx — Character Select, Stage Select, Team/Slot Config

// =================================================================
// 03 · CHARACTER SELECT — P1/P2 cursors, lock-in, hover preview
// =================================================================
function CharacterSelect({ theme, p1, p2, onP1, onP2, onBack, onReady }) {
  const [active, setActive] = React.useState('p1'); // which cursor is moving
  const [cursor, setCursor] = React.useState({ p1: 0, p2: 2 });
  const [locked, setLocked] = React.useState({ p1: false, p2: false });

  const cols = 5;
  const rows = 3;
  const move = React.useCallback((dx, dy) => {
    setCursor(c => {
      const cur = c[active]; const r = Math.floor(cur / cols); const col = cur % cols;
      const nr = Math.max(0, Math.min(rows - 1, r + dy));
      const nc = Math.max(0, Math.min(cols - 1, col + dx));
      return { ...c, [active]: nr * cols + nc };
    });
  }, [active]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowLeft') move(-1, 0);
      if (e.key === 'ArrowRight') move(1, 0);
      if (e.key === 'ArrowUp') move(0, -1);
      if (e.key === 'ArrowDown') move(0, 1);
      if (e.key === 'Tab') { e.preventDefault(); setActive(a => a === 'p1' ? 'p2' : 'p1'); }
      if (e.key === 'Enter') {
        const idx = cursor[active];
        if (active === 'p1') { onP1(GUILDS[idx].id); setLocked(l => ({ ...l, p1: true })); setActive('p2'); }
        else { onP2(GUILDS[idx].id); setLocked(l => ({ ...l, p2: true })); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [move, cursor, active, onP1, onP2]);

  const hovered = GUILDS[cursor[active]];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* Top header */}
      <div style={{ padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>SELECT ⋅ 15 GUILDS</span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Choose your guild</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
          <Btn theme={theme} size="sm" onClick={() => setActive(a => a === 'p1' ? 'p2' : 'p1')}>SWITCH · {active.toUpperCase()}</Btn>
          <Btn theme={theme} size="sm" primary disabled={!(locked.p1 && locked.p2)} onClick={onReady}>READY →</Btn>
        </div>
      </div>

      {/* main body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 0, overflow: 'hidden' }}>
        {/* P1 panel */}
        <PlayerPanel theme={theme} player="P1" guild={p1} active={active === 'p1'} locked={locked.p1} />

        {/* grid */}
        <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
            {GUILDS.map((g, i) => {
              const r = Math.floor(i / cols); const c = i % cols;
              const p1Here = cursor.p1 === i;
              const p2Here = cursor.p2 === i;
              const acc = guildAccent(g, theme.id);
              return (
                <div key={g.id} onClick={() => { if (active === 'p1') { setCursor(x=>({...x,p1:i})); onP1(g.id); setLocked(l=>({...l,p1:true})); setActive('p2'); } else { setCursor(x=>({...x,p2:i})); onP2(g.id); setLocked(l=>({...l,p2:true})); } }}
                  style={{ position: 'relative', cursor: 'pointer' }}>
                  <GuildMonogram theme={theme} guild={g} size={112} selected={p1Here || p2Here} />
                  <div style={{ textAlign: 'center', marginTop: 6, fontFamily: theme.fontMono, fontSize: 10, color: (p1Here || p2Here) ? acc : theme.inkDim, letterSpacing: 1 }}>{g.name.toUpperCase()}</div>
                  {p1Here && (
                    <div style={{ position: 'absolute', top: 4, left: 4, fontFamily: theme.fontMono, fontSize: 10, color: acc, letterSpacing: 2, textShadow: `0 0 4px ${theme.bgDeep}`, zIndex: 2 }}>◆ P1{locked.p1 ? '·L' : ''}</div>
                  )}
                  {p2Here && (
                    <div style={{ position: 'absolute', top: 4, right: 4, fontFamily: theme.fontMono, fontSize: 10, color: acc, letterSpacing: 2, textShadow: `0 0 4px ${theme.bgDeep}`, zIndex: 2 }}>◆ P2{locked.p2 ? '·L' : ''}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hover preview strip */}
          <div style={{ marginTop: 'auto', padding: '16px 18px', border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>HOVERED</span>
              <span style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: guildAccent(hovered, theme.id) }}>{hovered.name}</span>
              <span style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, fontStyle: 'italic' }}>{hovered.sub}</span>
              <span style={{ marginLeft: 'auto' }}><Chip theme={theme} tone="accent" mono>{hovered.tag}</Chip></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {Object.entries(hovered.stats).map(([k,v]) => (
                <StatBar key={k} theme={theme} label={k} value={v} max={20} guild={hovered} />
              ))}
            </div>
          </div>
        </div>

        {/* P2 panel */}
        <PlayerPanel theme={theme} player="P2" guild={p2} active={active === 'p2'} locked={locked.p2} />
      </div>

      {/* footer controls hint */}
      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>◀▶▲▼ MOVE</span><span>↵ LOCK</span><span>TAB SWITCH</span><span>ESC BACK</span>
      </div>
    </div>
  );
}

function PlayerPanel({ theme, player, guild, active, locked }) {
  const g = GUILDS.find(x => x.id === guild) || GUILDS[0];
  const accent = guildAccent(g, theme.id);
  return (
    <div style={{ padding: 24, borderRight: player === 'P1' ? `1px solid ${theme.lineSoft}` : 'none', borderLeft: player === 'P2' ? `1px solid ${theme.lineSoft}` : 'none', display: 'flex', flexDirection: 'column', gap: 12, background: active ? theme.panel : 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 3, color: active ? theme.accent : theme.inkMuted }}>{player}{active ? ' ◆' : ''}</span>
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: locked ? theme.good : theme.warn }}>{locked ? 'LOCKED' : 'SELECTING…'}</span>
      </div>
      <GuildMonogram theme={theme} guild={g} size={180} selected={locked} />
      <div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, letterSpacing: '-0.01em' }}>{g.name}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim, fontStyle: 'italic' }}>{g.sub}</div>
      </div>
      <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.55 }}>{g.bio}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Chip theme={theme} tone="accent" mono>{g.resource.name}·{g.resource.max}</Chip>
        <Chip theme={theme} mono>HP·{g.vitals.HP}</Chip>
        <Chip theme={theme} mono>ARM·{g.vitals.Armor}</Chip>
        <Chip theme={theme} mono>MR·{g.vitals.MR}</Chip>
        <Chip theme={theme} mono>MV·{g.vitals.Move}</Chip>
      </div>
      <div style={{ marginTop: 'auto', borderTop: `1px solid ${theme.lineSoft}`, paddingTop: 10 }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, marginBottom: 6 }}>ULT · ↓↑↓↑J</div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: accent }}>{g.abilities[4].name}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim }}>{g.abilities[4].fx}</div>
      </div>
    </div>
  );
}

function StatBar({ theme, label, value, max, guild }) {
  const pct = value / max;
  const accent = guildAccent(guild, theme.id);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 1, marginBottom: 3 }}>
        <span>{label}</span><span style={{ color: theme.ink }}>{value}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 6, background: i < value ? accent : theme.bgDeep, border: `1px solid ${i < value ? accent : theme.lineSoft}` }} />
        ))}
      </div>
    </div>
  );
}

// =================================================================
// 04 · STAGE SELECT — carousel
// =================================================================
function StageSelect({ theme, stageId, onStage, onBack, onNext }) {
  const idx = STAGES.findIndex(s => s.id === stageId);
  const cur = STAGES[idx] || STAGES[0];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;

  const step = (d) => { const n = (idx + d + STAGES.length) % STAGES.length; onStage(STAGES[n].id); };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.lineSoft}` }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>STAGE ⋅ {String(idx+1).padStart(2,'0')}/{STAGES.length}</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Pick the battlefield</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
          <Btn theme={theme} size="sm" primary onClick={onNext}>FIGHT →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        {/* Big preview */}
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{
            flex: 1, position: 'relative',
            border: `1px solid ${theme.lineSoft}`,
            background: `linear-gradient(145deg, ${accent}22, ${theme.panel} 70%)`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 28,
            overflow: 'hidden',
          }}>
            {/* striped placeholder */}
            <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, transparent 0 18px, ${accent}15 18px 19px)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>[ stage render placeholder ]</span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 2 }}>HUE · {cur.hue}°</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: accent, letterSpacing: 3 }}>{cur.sub.toUpperCase()}</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 72, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{cur.name}</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, fontStyle: 'italic', marginTop: 12, maxWidth: 520 }}>{cur.flavor}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <Btn theme={theme} onClick={() => step(-1)}>◀ PREV</Btn>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
              {STAGES.map((_, i) => (
                <span key={i} style={{ color: i === idx ? theme.accent : theme.inkMuted, margin: '0 4px' }}>{i === idx ? '■' : '·'}</span>
              ))}
            </div>
            <Btn theme={theme} onClick={() => step(1)}>NEXT ▶</Btn>
          </div>
        </div>

        {/* List */}
        <div style={{ borderLeft: `1px solid ${theme.lineSoft}`, padding: '20px 24px', overflow: 'auto' }}>
          <SectionLabel theme={theme} kicker="ALL" right={`${STAGES.length} LOCATIONS`}>Stages</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {STAGES.map((s, i) => {
              const act = i === idx;
              const acc = `oklch(0.70 0.16 ${s.hue})`;
              return (
                <div key={s.id} onClick={() => onStage(s.id)}
                  style={{ display: 'grid', gridTemplateColumns: '28px 14px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${theme.lineSoft}`, cursor: 'pointer' }}>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: act ? theme.accent : theme.inkMuted }}>{String(i+1).padStart(2,'0')}</span>
                  <span style={{ width: 10, height: 10, background: acc, border: `1px solid ${acc}`, opacity: act ? 1 : 0.4 }} />
                  <div>
                    <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: act ? theme.accent : theme.ink }}>{s.name}</div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{s.sub.toUpperCase()}</div>
                  </div>
                  {act && <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent }}>◆</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 05 · TEAM / SLOT CONFIG
// =================================================================
const TEAM_COLORS = ['#d9a441', '#5cf2c2', '#ff5d73', '#9a7cff', '#ffb347', '#5cb7f2', '#c994ff', '#86e35a'];

function TeamConfig({ theme, p1, p2, onP1, onP2, onBack, onNext }) {
  const [slots, setSlots] = React.useState([
    { type: 'HUMAN', guild: p1, color: 0, team: 'A', name: 'PLAYER ONE' },
    { type: 'HUMAN', guild: p2, color: 1, team: 'B', name: 'PLAYER TWO' },
    { type: 'CPU',   guild: 'hunter', color: 2, team: 'A', name: 'CPU · VETERAN' },
    { type: 'CPU',   guild: 'leper',  color: 3, team: 'B', name: 'CPU · VETERAN' },
    { type: 'OFF',   guild: null,     color: 4, team: 'A', name: '—' },
    { type: 'OFF',   guild: null,     color: 5, team: 'B', name: '—' },
    { type: 'OFF',   guild: null,     color: 6, team: 'A', name: '—' },
    { type: 'OFF',   guild: null,     color: 7, team: 'B', name: '—' },
  ]);

  const update = (i, patch) => setSlots(s => s.map((sl, j) => j === i ? { ...sl, ...patch } : sl));
  const cycleType = (i) => {
    const order = ['HUMAN', 'CPU', 'OFF'];
    setSlots(s => s.map((sl, j) => j === i ? { ...sl, type: order[(order.indexOf(sl.type) + 1) % 3] } : sl));
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.lineSoft}` }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>SLOTS ⋅ CONFIG</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Set the field</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
          <Btn theme={theme} size="sm" primary onClick={onNext}>STAGE →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, padding: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, overflow: 'auto' }}>
        {slots.map((s, i) => {
          const g = s.guild ? GUILDS.find(x => x.id === s.guild) : null;
          const color = TEAM_COLORS[s.color];
          const isOff = s.type === 'OFF';
          return (
            <div key={i} style={{
              border: `1px solid ${isOff ? theme.lineSoft : color}`,
              background: isOff ? 'transparent' : theme.panel,
              padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
              opacity: isOff ? 0.55 : 1, position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>SLOT·{String(i+1).padStart(2,'0')}</span>
                <span onClick={() => cycleType(i)} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 10, color: isOff ? theme.inkMuted : color, letterSpacing: 2, border: `1px solid ${isOff ? theme.lineSoft : color}`, padding: '2px 6px' }}>{s.type} ↻</span>
              </div>
              {g ? (
                <GuildMonogram theme={theme} guild={g} size={110} />
              ) : (
                <div style={{ height: 110, border: `1px dashed ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>EMPTY</div>
              )}
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink }}>{g ? g.name : '—'}</div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>{s.name}</div>
              </div>
              {!isOff && (
                <>
                  <div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>TEAM</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['A','B','C','D'].map(t => (
                        <span key={t} onClick={() => update(i, { team: t })} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontFamily: theme.fontMono, fontSize: 11, cursor: 'pointer', border: `1px solid ${s.team===t ? color : theme.lineSoft}`, color: s.team===t ? color : theme.inkDim }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>COLOR</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {TEAM_COLORS.map((c, ci) => (
                        <span key={ci} onClick={() => update(i, { color: ci })} style={{ width: 20, height: 20, background: c, cursor: 'pointer', opacity: s.color === ci ? 1 : 0.35, border: s.color === ci ? `1px solid ${theme.ink}` : `1px solid transparent` }} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>CLICK TYPE TO CYCLE: HUMAN / CPU / OFF</span><span>PICK TEAM + COLOR</span><span>SLOTS · {slots.filter(s => s.type !== 'OFF').length} ACTIVE</span>
      </div>
    </div>
  );
}

Object.assign(window, { CharacterSelect, StageSelect, TeamConfig });
