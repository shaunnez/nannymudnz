// app.jsx — Root: browser chrome, screen router, tweaks panel, shared state

const SCREEN_ORDER = [
  { id: 'title',     label: '01 · Title' },
  { id: 'menu',      label: '02 · Main Menu' },
  { id: 'charselect',label: '03 · Char Select' },
  { id: 'team',      label: '04 · Team Config' },
  { id: 'stage',     label: '05 · Stage Select' },
  { id: 'loading',   label: '06 · Loading' },
  { id: 'battle',    label: '07 · Battle HUD' },
  { id: 'pause',     label: '08 · Pause' },
  { id: 'results',   label: '09 · Results' },
  { id: 'moves',     label: '10 · Move List' },
  { id: 'guild',     label: '11 · Guild Detail' },
  { id: 'settings',  label: '12 · Settings' },
  { id: 'mp_hub',    label: '13 · MP Hub' },
  { id: 'mp_create', label: '14 · Create Room' },
  { id: 'mp_join',   label: '15 · Join by Code' },
  { id: 'mp_lobby',  label: '16 · Room Lobby' },
  { id: 'mp_cs',     label: '17 · 8P Char Select' },
  { id: 'mp_load',   label: '18 · 8P Loading' },
  { id: 'mp_battle', label: '19 · 8P Battle' },
  { id: 'mp_results',label: '20 · 8P Results' },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "screen": "title",
  "showChrome": true,
  "animateHud": true,
  "showLog": true
}/*EDITMODE-END*/;

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('nannymud-state') || '{}');
    return { ...TWEAK_DEFAULTS, p1: 'knight', p2: 'mage', stageId: 'assembly', guildId: 'mage', winner: 'P1', mpRoom: null, mpSlots: null, ...s };
  } catch { return { ...TWEAK_DEFAULTS, p1: 'knight', p2: 'mage', stageId: 'assembly', guildId: 'mage', winner: 'P1', mpRoom: null, mpSlots: null }; }
}

function App() {
  const [state, setState] = React.useState(loadState);
  const theme = THEMES.terminal;

  React.useEffect(() => { localStorage.setItem('nannymud-state', JSON.stringify(state)); }, [state]);
  const set = (patch) => setState(s => ({ ...s, ...patch }));
  const go = (screen, extras = {}) => set({ screen, ...extras });

  // Helper: enter a room (from hub or after create/join)
  const enterRoom = (room) => {
    const slots = typeof seedSlotsForRoom === 'function' ? seedSlotsForRoom(room) : null;
    set({ screen: 'mp_lobby', mpRoom: room, mpSlots: slots });
  };
  const launchMP = () => {
    // Go through char select → loading → battle → results
    go('mp_cs');
  };

  // If user navigates to an MP screen via screen-nav, ensure we have a plausible demo state.
  // - For mp_lobby / mp_cs: show whatever slots exist (user may have just created a room with 1 slot).
  // - For mp_load / mp_battle / mp_results: these need a FULL roster to demonstrate 8-player layouts,
  //   so auto-seed 8 players if the current room isn't already full.
  React.useEffect(() => {
    const mpScreens = ['mp_lobby', 'mp_cs', 'mp_load', 'mp_battle', 'mp_results'];
    const needsFullRoster = ['mp_load', 'mp_battle', 'mp_results'];
    if (!mpScreens.includes(state.screen)) return;

    const filledCount = (state.mpSlots || []).filter(s => !s.empty).length;
    const missingRoom = !state.mpRoom || !state.mpSlots;
    const mustFill = needsFullRoster.includes(state.screen) && filledCount < 2;

    if (missingRoom || mustFill) {
      const ffa = MP_MODES.find(m => m.id === 'ffa') || MP_MODES[0];
      const room = { ...MP_ROOMS[0], mode: ffa, max: ffa.max, filled: ffa.max };
      const slots = seedSlotsForRoom(room);
      const patched = slots.map(s => s.isYou ? { ...s, guild: state.p1 } : s);
      set({ mpRoom: room, mpSlots: patched });
    }
  }, [state.screen]);

  // Edit-mode handshake
  const [editOn, setEditOn] = React.useState(false);
  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditOn(false);
    };
    window.addEventListener('message', h);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', h);
  }, []);
  const setKey = (k, v) => {
    set({ [k]: v });
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*'); } catch {}
  };

  // Keyboard navigation
  React.useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (state.screen === 'battle') go('pause');
        else if (state.screen === 'pause') go('battle');
        else if (state.screen !== 'title' && state.screen !== 'menu') go('menu');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [state.screen]);

  let body = null;
  switch (state.screen) {
    case 'title':
      body = <TitleScreen theme={theme} onStart={() => go('menu')} />; break;
    case 'menu':
      body = <MainMenuScreen theme={theme} onPick={(mode, id) => {
        if (mode === 'moves') go('moves');
        else if (mode === 'settings') go('settings');
        else if (mode === 'mp_hub') go('mp_hub');
        else go('charselect');
      }} />; break;
    case 'charselect':
      body = <CharacterSelect theme={theme} p1={state.p1} p2={state.p2}
        onP1={id => set({ p1: id })} onP2={id => set({ p2: id })}
        onBack={() => { const r = state.returnTo; set({ returnTo: null }); go(r || 'menu'); }}
        onReady={() => { const r = state.returnTo; if (r) { set({ returnTo: null }); go(r); } else go('team'); }} />; break;
    case 'team':
      body = <TeamConfig theme={theme} p1={state.p1} p2={state.p2}
        onP1={id => set({ p1: id })} onP2={id => set({ p2: id })}
        onBack={() => go('charselect')} onNext={() => go('stage')} />; break;
    case 'stage':
      body = <StageSelect theme={theme} stageId={state.stageId}
        onStage={id => set({ stageId: id })}
        onBack={() => go('team')} onNext={() => go('loading')} />; break;
    case 'loading':
      body = <LoadingScreen theme={theme} p1Id={state.p1} p2Id={state.p2} stageId={state.stageId}
        onDone={() => go('battle')} />; break;
    case 'battle':
      body = <BattleHUD theme={theme} p1Id={state.p1} p2Id={state.p2} stageId={state.stageId} showLog={state.showLog !== false}
        onPause={() => go('pause')} onEnd={() => go('results', { winner: Math.random() > 0.5 ? 'P1' : 'P2' })} />; break;
    case 'pause':
      body = <>
        <BattleHUD theme={theme} p1Id={state.p1} p2Id={state.p2} stageId={state.stageId} showLog={state.showLog !== false} onPause={()=>{}} onEnd={()=>{}} />
        <div style={{ position: 'absolute', inset: 0 }}>
          <PauseMenu theme={theme} onResume={() => go('battle')} onRestart={() => go('loading')} onQuit={() => go('menu')} />
        </div>
      </>; break;
    case 'results':
      body = <ResultsScreen theme={theme} p1Id={state.p1} p2Id={state.p2} winner={state.winner || 'P1'}
        onAgain={() => go('loading')} onMenu={() => go('menu')} />; break;
    case 'moves':
      body = <MoveListScreen theme={theme} onBack={() => go('menu')} onGuild={id => go('guild', { guildId: id })} />; break;
    case 'guild':
      body = <GuildDetailScreen theme={theme} guildId={state.guildId} onBack={() => go('moves')} />; break;
    case 'settings':
      body = <SettingsScreen theme={theme} onBack={() => go('menu')} showLog={state.showLog !== false} onToggleLog={() => setKey('showLog', !(state.showLog !== false))} />; break;

    // --- MULTIPLAYER ---
    case 'mp_hub':
      body = <MultiplayerHub theme={theme} style="table"
        onBack={() => go('menu')}
        onCreate={() => go('mp_create')}
        onJoin={() => go('mp_join')}
        onEnterRoom={(r) => enterRoom(r)} />; break;
    case 'mp_create':
      body = <>
        <MultiplayerHub theme={theme} style="table"
          onBack={() => {}} onCreate={() => {}} onJoin={() => {}} onEnterRoom={() => {}} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'auto' }}>
          <CreateRoomModal theme={theme}
            initial={state.editingRoom || null}
            onCancel={() => { set({ editingRoom: null }); go(state.editingRoom ? 'mp_lobby' : 'mp_hub'); }}
            onCreate={(cfg) => {
              if (state.editingRoom) {
                // Edit mode: update existing room, preserve slots
                const updated = { ...state.mpRoom, name: cfg.name, mode: cfg.mode, max: cfg.mode.max, stageId: cfg.stageId, visibility: cfg.visibility, locked: cfg.locked, code: cfg.code, rounds: cfg.rounds, friendlyFire: cfg.friendlyFire, specSlots: cfg.specSlots };
                // Resize slots if needed
                let slots = state.mpSlots || [];
                if (slots.length > cfg.mode.max) slots = slots.slice(0, cfg.mode.max);
                while (slots.length < cfg.mode.max) slots.push({ i: slots.length, empty: true });
                set({ screen: 'mp_lobby', mpRoom: updated, mpSlots: slots, editingRoom: null });
              } else {
                const room = {
                  id: 'r_new', name: cfg.name, host: 'you', mode: cfg.mode,
                  filled: 1, max: cfg.mode.max, locked: cfg.locked, code: cfg.code,
                  region: 'EU-N', ping: 14, stageId: cfg.stageId, state: 'LOBBY',
                  visibility: cfg.visibility, rounds: cfg.rounds, friendlyFire: cfg.friendlyFire, specSlots: cfg.specSlots,
                };
                const firstSlots = [{ i: 0, name: 'you', guild: state.p1, team: cfg.mode.teams ? 1 : null, ping: 14, ready: false, isHost: true, isYou: true }];
                while (firstSlots.length < cfg.mode.max) firstSlots.push({ i: firstSlots.length, empty: true });
                set({ screen: 'mp_lobby', mpRoom: room, mpSlots: firstSlots });
              }
            }} />
        </div>
      </>; break;
    case 'mp_join':
      body = <>
        <MultiplayerHub theme={theme} style="table"
          onBack={() => {}} onCreate={() => {}} onJoin={() => {}} onEnterRoom={() => {}} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'auto' }}>
          <JoinByCodeModal theme={theme}
            onCancel={() => go('mp_hub')}
            onJoin={(code) => {
              const hit = MP_ROOMS.find(r => r.code === code);
              const room = hit || { id: 'r_join', name: `Room #${code}`, host: 'remote', mode: MP_MODES[0], filled: 4, max: 8, locked: true, code, region: '??', ping: 48, stageId: 'market', state: 'LOBBY' };
              enterRoom(room);
            }} />
        </div>
      </>; break;
    case 'mp_lobby':
      body = <RoomLobby theme={theme} room={state.mpRoom} slots={state.mpSlots} myGuild={state.p1}
        onBack={() => go('mp_hub')}
        onChangeGuild={() => go('charselect', { returnTo: 'mp_lobby' })}
        onEditRoom={() => set({ editingRoom: state.mpRoom, screen: 'mp_create' })}
        onLaunch={() => launchMP()} />; break;
    case 'mp_cs':
      body = <MPCharSelect8 theme={theme} slots={state.mpSlots} room={state.mpRoom}
        layout="list"
        onBack={() => go('mp_lobby')}
        onReady={() => go('mp_load')} />; break;
    case 'mp_load':
      body = <MPLoadingScreen theme={theme} slots={state.mpSlots} room={state.mpRoom}
        onDone={() => go('mp_battle')} />; break;
    case 'mp_battle':
      body = <MPBattleHUD8 theme={theme} slots={state.mpSlots} room={state.mpRoom} showLog={state.showLog !== false}
        onPause={() => go('pause')}
        onEnd={() => go('mp_results')} />; break;
    case 'mp_results':
      body = <MPResults8 theme={theme} slots={state.mpSlots} room={state.mpRoom}
        onAgain={() => go('mp_load')}
        onMenu={() => go('mp_hub')} />; break;
    default:
      body = <div style={{ color: theme.ink, padding: 40 }}>Unknown screen: {state.screen}</div>;
  }

  const appContent = (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: theme.bg,
      color: theme.ink,
      fontFamily: theme.fontBody,
      overflow: 'hidden',
    }}>
      {/* theme-level overlays */}
      {theme.id === 'terminal' && (
        <div style={{ position: 'absolute', inset: 0, background: SCANLINE, pointerEvents: 'none', opacity: 0.6, zIndex: 5, mixBlendMode: 'overlay' }} />
      )}
      {theme.id === 'grimoire' && (
        <div style={{ position: 'absolute', inset: 0, background: PAPER, pointerEvents: 'none', opacity: 0.25, zIndex: 5, mixBlendMode: 'multiply' }} />
      )}

      {body}

      {/* Screen navigator — always visible, unobtrusive */}
      <ScreenNav theme={theme} screen={state.screen} setScreen={s => go(s)} />

      {/* Tweaks panel */}
      {editOn && <TweaksPanel theme={theme} state={state} setKey={setKey} />}
    </div>
  );

  // Frame selection: show browser chrome unless disabled
  if (!state.showChrome) {
    return <div style={{ width: '100vw', height: '100vh' }}>{appContent}</div>;
  }

  return (
    <ScaleToFit designW={1440} designH={880} padding={20} bg="#0a0906">
      <ChromeWindow
        tabs={[{ title: 'Nannymud — LF of Lysator' }, { title: 'forums.lysator' }]}
        activeIndex={0}
        url="nannymud.lysator.liu.se/play"
        width={1440} height={880}
      >
        {appContent}
      </ChromeWindow>
    </ScaleToFit>
  );
}

// Downscale a fixed design size to fit any viewport, letterboxed on bg.
function ScaleToFit({ designW, designH, padding = 0, bg, children }) {
  const [dim, setDim] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => {
    const h = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const availW = dim.w - padding * 2;
  const availH = dim.h - padding * 2;
  const scale = Math.min(availW / designW, availH / designH, 1);
  return (
    <div style={{ width: '100vw', height: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: designW, height: designH, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

function ScreenNav({ theme, screen, setScreen }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2 }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: '4px 10px', background: theme.panel, border: `1px solid ${theme.line}`,
        color: theme.accent, cursor: 'pointer',
      }}>
        {open ? '× CLOSE' : '◇ SCREENS'}
      </div>
      {open && (
        <div style={{ marginTop: 4, background: theme.panel, border: `1px solid ${theme.line}`, width: 200 }}>
          {SCREEN_ORDER.map(s => (
            <div key={s.id} onClick={() => { setScreen(s.id); setOpen(false); }}
              style={{
                padding: '6px 10px', cursor: 'pointer',
                color: screen === s.id ? theme.accent : theme.inkDim,
                borderLeft: `2px solid ${screen === s.id ? theme.accent : 'transparent'}`,
                background: screen === s.id ? theme.panelRaised : 'transparent',
              }}>
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TweaksPanel({ theme, state, setKey }) {
  return (
    <div style={{ position: 'absolute', bottom: 18, right: 18, zIndex: 30, width: 240, background: theme.panel, border: `1px solid ${theme.accent}`, padding: 14, fontFamily: theme.fontMono, fontSize: 11, color: theme.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, letterSpacing: 3, color: theme.accent }}>
        <span>TWEAKS</span><span>v0.5</span>
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setKey('showChrome', !state.showChrome)}>
        <span>BROWSER CHROME</span>
        <span style={{ color: state.showChrome ? theme.accent : theme.inkMuted }}>{state.showChrome ? '■ ON' : '□ OFF'}</span>
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setKey('animateHud', !state.animateHud)}>
        <span>ANIMATE HUD</span>
        <span style={{ color: state.animateHud ? theme.accent : theme.inkMuted }}>{state.animateHud ? '■ ON' : '□ OFF'}</span>
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setKey('showLog', !(state.showLog !== false))}>
        <span>COMBAT LOG</span>
        <span style={{ color: state.showLog !== false ? theme.accent : theme.inkMuted }}>{state.showLog !== false ? '■ ON' : '□ OFF'}</span>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.lineSoft}`, color: theme.inkMuted, fontSize: 10 }}>
        ESC from any screen returns here.
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
