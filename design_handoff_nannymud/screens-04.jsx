// screens-04.jsx — Move List, Guild Detail, Settings, Loading

// =================================================================
// 09 · MOVE LIST
// =================================================================
function MoveListScreen({ theme, onBack, onGuild }) {
  const [selId, setSelId] = React.useState('adventurer');
  const g = GUILDS.find(x => x.id === selId);
  const accent = guildAccent(g, theme.id);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>REFERENCE</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Move list · {g.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
          <Btn theme={theme} size="sm" primary onClick={() => onGuild(g.id)}>BIO →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
        {/* Guild list */}
        <div style={{ borderRight: `1px solid ${theme.lineSoft}`, overflow: 'auto', padding: '8px 0' }}>
          {GUILDS.map(x => {
            const act = x.id === selId;
            const a = guildAccent(x, theme.id);
            return (
              <div key={x.id} onClick={() => setSelId(x.id)} style={{ padding: '8px 20px', display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'center', cursor: 'pointer', borderLeft: `3px solid ${act ? a : 'transparent'}`, background: act ? theme.panel : 'transparent' }}>
                <GuildMonogram theme={theme} guild={x} size={28} selected={act} />
                <div>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: act ? a : theme.ink }}>{x.name}</div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1 }}>{x.tag}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Move detail */}
        <div style={{ padding: 28, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start', marginBottom: 20 }}>
            <GuildMonogram theme={theme} guild={g} size={120} selected />
            <div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>{g.sub.toUpperCase()}</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 56, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{g.name}</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, fontStyle: 'italic', marginTop: 8 }}>{g.tag} · {g.resource.name} / {g.resource.max}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {Object.entries(g.stats).map(([k,v]) => <Chip key={k} theme={theme} mono>{k} {v}</Chip>)}
              </div>
            </div>
          </div>

          <SectionLabel theme={theme} kicker="ABILITIES" right={`${g.abilities.length} + RMB`}>Combat moves</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 100px 1fr 160px 60px 70px', gap: 12, padding: '10px 0', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, borderBottom: `1px solid ${theme.lineSoft}` }}>
            <span>SLOT</span><span>COMBO</span><span>NAME / EFFECT</span><span>DAMAGE</span><span>CD</span><span>COST</span>
          </div>
          {[...g.abilities, { slot: 'R', combo: 'K+J', name: g.rmb.name, fx: g.rmb.fx, dmg: '—', cd: '—', cost: '—' }].map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 100px 1fr 160px 60px 70px', gap: 12, padding: '14px 0', borderBottom: `1px solid ${theme.lineSoft}`, alignItems: 'start' }}>
              <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: accent }}>{a.slot}</span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.ink, letterSpacing: 2 }}>{a.combo}</span>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: theme.ink }}>{a.name}</div>
                <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, marginTop: 2 }}>{a.fx}</div>
              </div>
              <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim }}>{a.dmg}</span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim }}>{typeof a.cd === 'number' ? `${a.cd}s` : a.cd}</span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim }}>{a.cost}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 10 · GUILD DETAIL / BIO
// =================================================================
function GuildDetailScreen({ theme, guildId, onBack }) {
  const g = GUILDS.find(x => x.id === guildId) || GUILDS[0];
  const accent = guildAccent(g, theme.id);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>GUILD DOSSIER</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>{g.sub}</div>
        </div>
        <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '40% 1fr', overflow: 'hidden' }}>
        {/* Hero */}
        <div style={{ padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: `linear-gradient(180deg, ${accent}14, transparent 60%)`, borderRight: `1px solid ${theme.lineSoft}` }}>
          <div>
            <GuildMonogram theme={theme} guild={g} size={200} selected />
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: accent, letterSpacing: 4, marginTop: 24 }}>Nº {String(GUILDS.indexOf(g)+1).padStart(2,'0')} / 15</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 88, color: theme.ink, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>{g.name}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: accent, fontStyle: 'italic', marginTop: 4 }}>{g.tag}</div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, lineHeight: 1.6, marginTop: 18, maxWidth: 460 }}>{g.bio}</div>
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, borderTop: `1px solid ${theme.lineSoft}`, paddingTop: 14 }}>
            RESOURCE · {g.resource.name.toUpperCase()} / {g.resource.max} — HP {g.vitals.HP} · ARMOR {g.vitals.Armor} · MR {g.vitals.MR} · MOVE {g.vitals.Move}
          </div>
        </div>

        {/* Stats + abilities */}
        <div style={{ padding: 36, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionLabel theme={theme} kicker="CORE STATS">Combat profile</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {Object.entries(g.stats).map(([k,v]) => <StatBar key={k} theme={theme} label={k} value={v} max={20} guild={g} />)}
          </div>

          <SectionLabel theme={theme} kicker="VITALS">Survivability</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {Object.entries(g.vitals).map(([k,v]) => (
              <div key={k} style={{ padding: '10px 12px', border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
                <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{k.toUpperCase()}</div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 28, color: theme.ink, letterSpacing: '-0.02em' }}>{v}</div>
              </div>
            ))}
          </div>

          <SectionLabel theme={theme} kicker="SIGNATURE MOVES">{g.abilities.length} abilities + RMB</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {g.abilities.map((a, i) => (
              <div key={i} style={{ padding: 12, border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 2 }}>SLOT {a.slot} · {a.combo}</span>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted }}>CD {a.cd}s · {a.cost}</span>
                </div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink }}>{a.name}</div>
                <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim, marginTop: 3 }}>{a.fx}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 11 · SETTINGS
// =================================================================
function SettingsScreen({ theme, onBack, showLog, onToggleLog }) {
  const [vol, setVol] = React.useState({ master: 80, music: 60, sfx: 90 });
  const [gfx, setGfx] = React.useState('HIGH');
  const [shake, setShake] = React.useState(true);
  const [rumble, setRumble] = React.useState(true);
  const [showPing, setShowPing] = React.useState(false);
  const [bindings, setBindings] = React.useState([
    { a: 'MOVE LEFT',  k1: '←', k2: 'A' },
    { a: 'MOVE RIGHT', k1: '→', k2: 'D' },
    { a: 'JUMP',       k1: '↑', k2: 'W' },
    { a: 'DEFEND',     k1: '↓', k2: 'S' },
    { a: 'ATTACK (J)', k1: 'J', k2: 'L-CLICK' },
    { a: 'SPECIAL (K)', k1: 'K', k2: 'R-CLICK' },
    { a: 'TAUNT',      k1: 'T', k2: '—' },
    { a: 'PAUSE',      k1: 'ESC', k2: 'START' },
  ]);
  const [rebinding, setRebinding] = React.useState(null); // {row, col}

  React.useEffect(() => {
    if (!rebinding) return;
    const h = (e) => {
      e.preventDefault();
      let key = e.key;
      if (key === ' ') key = 'SPACE';
      else if (key === 'Escape') { setRebinding(null); return; }
      else if (key.length === 1) key = key.toUpperCase();
      setBindings(bs => bs.map((b, i) => i === rebinding.row ? { ...b, [rebinding.col]: key } : b));
      setRebinding(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [rebinding]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>SETTINGS</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Controls, sound, video</div>
        </div>
        <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Left — bindings */}
        <div style={{ padding: 32, overflow: 'auto' }}>
          <SectionLabel theme={theme} kicker="CONTROLS">Key bindings</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginTop: 12 }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, paddingBottom: 4, borderBottom: `1px solid ${theme.lineSoft}` }}>ACTION</div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, paddingBottom: 4, borderBottom: `1px solid ${theme.lineSoft}`, textAlign: 'center', minWidth: 80 }}>PRIMARY</div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, paddingBottom: 4, borderBottom: `1px solid ${theme.lineSoft}`, textAlign: 'center', minWidth: 80 }}>ALT</div>
            {bindings.map((b, ri) => (
              <React.Fragment key={b.a}>
                <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.ink, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}` }}>{b.a}</div>
                {['k1','k2'].map(col => {
                  const isRebind = rebinding && rebinding.row === ri && rebinding.col === col;
                  return (
                    <div key={col}
                      onClick={() => setRebinding({ row: ri, col })}
                      style={{ fontFamily: theme.fontMono, fontSize: 12, cursor: 'pointer', color: isRebind ? theme.bg : (col === 'k1' ? theme.accent : theme.inkDim), padding: '10px 14px', textAlign: 'center', border: `1px solid ${isRebind ? theme.accent : (col === 'k1' ? theme.line : theme.lineSoft)}`, background: isRebind ? theme.accent : (col === 'k1' ? theme.panel : 'transparent'), marginBottom: 2, minWidth: 80 }}>
                      {isRebind ? 'PRESS KEY…' : b[col]}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right — audio/video */}
        <div style={{ padding: 32, borderLeft: `1px solid ${theme.lineSoft}`, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <SectionLabel theme={theme} kicker="AUDIO">Volume mix</SectionLabel>
            {['master','music','sfx'].map(k => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 44px', gap: 12, alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim, letterSpacing: 2 }}>{k.toUpperCase()}</span>
                <input type="range" min="0" max="100" value={vol[k]} onChange={e => setVol(v => ({ ...v, [k]: +e.target.value }))} style={{ accentColor: theme.accent }} />
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.accent }}>{vol[k]}</span>
              </div>
            ))}
          </div>
          <div>
            <SectionLabel theme={theme} kicker="VIDEO">Rendering</SectionLabel>
            <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
              {['LOW','MEDIUM','HIGH','RITUAL'].map(lv => (
                <span key={lv} onClick={() => setGfx(lv)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 2, cursor: 'pointer', border: `1px solid ${gfx === lv ? theme.accent : theme.lineSoft}`, color: gfx === lv ? theme.accent : theme.inkDim, background: gfx === lv ? `${theme.accent}14` : 'transparent' }}>{lv}</span>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel theme={theme} kicker="FEEDBACK">Toggles</SectionLabel>
            {[
              { l: 'SCREEN SHAKE', v: shake, fn: () => setShake(x => !x) },
              { l: 'CONTROLLER RUMBLE', v: rumble, fn: () => setRumble(x => !x) },
              { l: 'COMBAT LOG OVERLAY', v: showLog, fn: () => onToggleLog && onToggleLog() },
              { l: 'SHOW PING', v: showPing, fn: () => setShowPing(x => !x) },
            ].map(t => (
              <div key={t.l} onClick={t.fn} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, cursor: 'pointer' }}>
                <span style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.ink }}>{t.l}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 2, color: t.v ? theme.accent : theme.inkMuted, border: `1px solid ${t.v ? theme.accent : theme.lineSoft}`, padding: '2px 10px' }}>{t.v ? 'ON' : 'OFF'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 12 · LOADING SCREEN
// =================================================================
function LoadingScreen({ theme, p1Id, p2Id, stageId, onDone }) {
  const g1 = GUILDS.find(g => g.id === p1Id) || GUILDS[0];
  const g2 = GUILDS.find(g => g.id === p2Id) || GUILDS[1];
  const stage = STAGES.find(s => s.id === stageId) || STAGES[0];
  const [prog, setProg] = React.useState(0);
  const [tip, setTip] = React.useState(0);
  const tips = [
    'The Druid\'s wolf form hits harder; the bear form takes more. Shapeshift with right-click.',
    'Vampires lose bloodpool in daylight zones. Pick your arena carefully.',
    'Masters cycle primed classes with right-click — a mid-fight read on your opponent can win you a round.',
    'Cultists rise in sanity with every cast. At 100 they stun themselves. Time your Gaze into Abyss.',
    'The Champion loses HP when retreating from an enemy. Forward only.',
    'Nannymud was founded April 20, 1990 at Lysator, Linköping. Local god: Mats.',
  ];

  React.useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p += 4 + Math.random() * 6;
      setProg(Math.min(100, p));
      if (p >= 100) { clearInterval(iv); setTimeout(onDone, 600); }
    }, 140);
    const t = setInterval(() => setTip(x => (x + 1) % tips.length), 2400);
    return () => { clearInterval(iv); clearInterval(t); };
  }, [onDone, tips.length]);

  const acc1 = guildAccent(g1, theme.id);
  const acc2 = guildAccent(g2, theme.id);
  const stageAcc = `oklch(0.65 0.15 ${stage.hue})`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: `radial-gradient(circle at 30% 30%, ${acc1}14, transparent 50%), radial-gradient(circle at 70% 70%, ${acc2}14, transparent 50%), ${theme.bgDeep}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 160px 1fr', alignItems: 'center', padding: '0 80px', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <GuildMonogram theme={theme} guild={g1} size={180} selected />
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: acc1, letterSpacing: 4, marginTop: 14 }}>P1</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 44, color: theme.ink, lineHeight: 1, marginTop: 2 }}>{g1.name}</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkMuted, fontStyle: 'italic', marginTop: 4 }}>{g1.sub}</div>
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 120, color: theme.inkMuted, letterSpacing: '-0.04em', textAlign: 'center', lineHeight: 1 }}>vs</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <GuildMonogram theme={theme} guild={g2} size={180} selected />
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: acc2, letterSpacing: 4, marginTop: 14 }}>P2</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 44, color: theme.ink, lineHeight: 1, marginTop: 2 }}>{g2.name}</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkMuted, fontStyle: 'italic', marginTop: 4 }}>{g2.sub}</div>
        </div>
      </div>

      <div style={{ padding: 40, borderTop: `1px solid ${theme.lineSoft}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: stageAcc, letterSpacing: 4 }}>STAGE · {stage.sub.toUpperCase()}</span>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 32, color: theme.ink }}>{stage.name}</div>
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.accent, letterSpacing: 2 }}>{Math.round(prog)}%</div>
        </div>
        <div style={{ height: 4, background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`, position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', inset: 0, width: `${prog}%`, background: `linear-gradient(90deg, ${acc1}, ${acc2})`, transition: 'width 120ms linear' }} />
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, marginBottom: 2 }}>TIP {String(tip+1).padStart(2,'0')}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, fontStyle: 'italic', lineHeight: 1.5 }}>{tips[tip]}</div>
      </div>
    </div>
  );
}

Object.assign(window, { MoveListScreen, GuildDetailScreen, SettingsScreen, LoadingScreen });
