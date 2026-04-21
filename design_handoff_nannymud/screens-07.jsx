// screens-07.jsx — 8-PLAYER screens: char-select (3 layouts), loading, battle HUD, results.
// Built for 2–8 slots; gracefully handles partial fills.

const TEAM_COLORS = ['#5cf2c2', '#ff5d73', '#ffb347', '#928bff'];

// =================================================================
// Helpers
// =================================================================
function ensureSlots(slots, max = 8) {
  const arr = slots ? [...slots] : [];
  while (arr.length < max) arr.push({ i: arr.length, empty: true });
  return arr.slice(0, max);
}

function teamColorFor(slot) {
  return slot?.team ? TEAM_COLORS[(slot.team - 1) % TEAM_COLORS.length] : '#5cf2c2';
}

// =================================================================
// 16 · 8-PLAYER CHAR SELECT — three layout variants
// =================================================================
function MPCharSelect8({ theme, slots: slotsIn, room, onBack, onReady, layout = 'grid' }) {
  const [slots, setSlots] = React.useState(() => ensureSlots(slotsIn, room?.mode?.max || 8));
  const [focus, setFocus] = React.useState(slots.find(s => s.isYou)?.i ?? 0);
  const [locked, setLocked] = React.useState({}); // {slotIdx: true}
  const [detailsGuildId, setDetailsGuildId] = React.useState(null);
  const you = slots.find(s => s.isYou) || slots[0];

  const setGuildForYou = (gid) => {
    setSlots(ss => ss.map(s => s.isYou ? { ...s, guild: gid } : s));
  };
  const openDetails = (gid) => setDetailsGuildId(gid);
  const closeDetails = () => setDetailsGuildId(null);

  // bots cycle selections idly
  React.useEffect(() => {
    const t = setInterval(() => {
      setSlots(ss => ss.map(s => {
        if (s.empty || s.isYou) return s;
        if (locked[s.i]) return s;
        if (Math.random() > 0.15) return s;
        const next = GUILDS[(GUILDS.findIndex(g => g.id === s.guild) + 1) % GUILDS.length].id;
        return { ...s, guild: next };
      }));
    }, 1800);
    return () => clearInterval(t);
  }, [locked]);

  const toggleLock = (i) => setLocked(l => ({ ...l, [i]: !l[i] }));
  const allLocked = slots.filter(s => !s.empty).every(s => locked[s.i] || !s.isYou);

  const common = { theme, slots, focus, setFocus, you, setGuildForYou, locked, toggleLock, openDetails };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ padding: '14px 32px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            CHARACTER SELECT · {slots.filter(s => !s.empty).length} PLAYERS · {room?.mode?.label || 'FFA'}
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink, letterSpacing: '-0.01em' }}>{room?.name || 'Pick your guild'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} onClick={onBack}>← BACK</Btn>
          <Btn theme={theme} primary disabled={!you || !you.guild || !locked[you.i]} onClick={onReady}>{allLocked ? 'ALL LOCKED — BEGIN →' : 'WAITING FOR LOCK-IN…'}</Btn>
        </div>
      </div>

      {layout === 'grid' && <CS8_Grid {...common} />}
      {layout === 'rows' && <CS8_Rows {...common} />}
      {layout === 'list' && <CS8_List {...common} />}

      {detailsGuildId && (
        <GuildDetailOverlay theme={theme} guildId={detailsGuildId} you={you} locked={locked}
          onClose={closeDetails}
          onSelect={(gid) => { if (!locked[you?.i]) setGuildForYou(gid); closeDetails(); }} />
      )}
    </div>
  );
}

// Layout A: big shared roster + 8 portrait strip along the bottom (LF2 classic)
function CS8_Grid({ theme, slots, setGuildForYou, focus, setFocus, you, locked, toggleLock, openDetails }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* shared roster */}
      <div style={{ flex: 1, padding: '18px 32px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <SectionLabel theme={theme} kicker="ROSTER · 15 GUILDS" right="J/K PREVIEW · CLICK (?) FOR DETAILS · ENTER LOCK">Your pick</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 12 }}>
          {GUILDS.map(g => {
            const pickedBy = slots.filter(s => !s.empty && s.guild === g.id);
            const isYours = you?.guild === g.id;
            const accent = guildAccent(g, theme.id);
            return (
              <div key={g.id} onClick={() => setGuildForYou(g.id)}
                style={{
                  border: `1px solid ${isYours ? theme.accent : theme.line}`,
                  background: isYours ? `${theme.accent}0a` : theme.panel,
                  padding: 10, cursor: locked[you?.i] ? 'not-allowed' : 'pointer',
                  display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 10, alignItems: 'center',
                  opacity: locked[you?.i] && !isYours ? 0.55 : 1, position: 'relative',
                }}>
                <GuildMonogram theme={theme} guild={g} size={52} selected={isYours} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: isYours ? theme.accent : theme.ink, lineHeight: 1.1 }}>{g.name}</div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: accent, letterSpacing: 1, marginTop: 2 }}>{g.tag.toUpperCase()}</div>
                  {pickedBy.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {pickedBy.map(p => (
                        <span key={p.i} title={p.name} style={{ width: 16, height: 3, background: p.team ? teamColorFor(p) : accent }} />
                      ))}
                    </div>
                  )}
                </div>
                <span onClick={(e) => { e.stopPropagation(); openDetails && openDetails(g.id); }}
                      title="Guild details"
                      style={{ width: 22, height: 22, border: `1px solid ${theme.lineSoft}`, color: theme.inkDim, fontFamily: theme.fontMono, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 2 }}>?</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8 portrait strip */}
      <div style={{ padding: '14px 32px', borderTop: `1px solid ${theme.line}`, background: theme.panel, display: 'grid', gridTemplateColumns: `repeat(${slots.length}, 1fr)`, gap: 10 }}>
        {slots.map(s => <PortraitSlot key={s.i} theme={theme} slot={s} locked={locked[s.i]} onToggleLock={() => s.isYou && toggleLock(s.i)} />)}
      </div>
    </div>
  );
}

// Layout B: 2 rows of 4 mini-panels, each "cursor" bordered in team color
function CS8_Rows({ theme, slots, setGuildForYou, you, locked, toggleLock, openDetails }) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 1fr', gap: 10, padding: '18px 28px', overflow: 'hidden' }}>
      {[0, 1].map(row => (
        <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {slots.slice(row * 4, row * 4 + 4).map(s => (
            <MiniPanel key={s.i} theme={theme} slot={s} you={you} locked={locked[s.i]}
              onPick={(gid) => s.isYou && setGuildForYou(gid)}
              onLock={() => s.isYou && toggleLock(s.i)}
              onDetails={openDetails} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniPanel({ theme, slot, you, locked, onPick, onLock, onDetails }) {
  if (slot.empty) {
    return (
      <div style={{ border: `1px dashed ${theme.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: theme.inkMuted }}>
        EMPTY · WAITING FOR PLAYER
      </div>
    );
  }
  const guild = GUILDS.find(g => g.id === slot.guild) || GUILDS[0];
  const accent = guildAccent(guild, theme.id);
  const teamColor = teamColorFor(slot);
  const isYou = slot.isYou;
  return (
    <div style={{
      border: `2px solid ${isYou ? theme.accent : (slot.team ? teamColor : theme.line)}`,
      background: theme.panel, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 2,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>P{slot.i + 1} {isYou && '· YOU'}</span>
        {slot.team && <Chip theme={theme} mono>TEAM {slot.team}</Chip>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GuildMonogram theme={theme} guild={guild} size={56} selected={locked} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.name === 'you' ? 'You' : slot.name}</div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 1 }}>{guild.name}</div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1, marginTop: 2 }}>{slot.ping}ms</div>
        </div>
      </div>
      {/* mini roster of 15 glyphs — if YOU, clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginTop: 'auto' }}>
        {GUILDS.map(g => {
          const active = g.id === slot.guild;
          return (
            <span key={g.id} onClick={() => isYou && onPick(g.id)}
              style={{ aspectRatio: '1 / 1', background: active ? theme.accent : theme.bgDeep, color: active ? theme.bgDeep : theme.inkDim, border: `1px solid ${active ? theme.accent : theme.lineSoft}`, fontFamily: theme.fontMono, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isYou ? 'pointer' : 'default' }}>
              {g.glyph}
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: locked ? theme.good : theme.inkMuted }}>
          {locked ? '▸ LOCKED' : '○ CHOOSING'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {slot.guild && <Btn theme={theme} size="sm" onClick={() => onDetails && onDetails(slot.guild)}>DETAILS</Btn>}
          {isYou && <Btn theme={theme} size="sm" onClick={onLock}>{locked ? 'UNLOCK' : 'LOCK IN'}</Btn>}
        </div>
      </div>
    </div>
  );
}

// Layout C: vertical list of 8 players + shared picker panel
function CS8_List({ theme, slots, setGuildForYou, you, locked, toggleLock, openDetails }) {
  const selectedGuild = GUILDS.find(g => g.id === you?.guild) || GUILDS[0];
  const selectedAccent = guildAccent(selectedGuild, theme.id);
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden' }}>
      {/* player list */}
      <div style={{ borderRight: `1px solid ${theme.lineSoft}`, overflow: 'auto' }}>
        {slots.map(s => {
          if (s.empty) return (
            <div key={s.i} style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.lineSoft}`, fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: theme.inkMuted }}>
              SLOT {String(s.i + 1).padStart(2, '0')} · EMPTY
            </div>
          );
          const g = GUILDS.find(gg => gg.id === s.guild) || GUILDS[0];
          const accent = guildAccent(g, theme.id);
          return (
            <div key={s.i} style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 10, alignItems: 'center', borderLeft: `3px solid ${s.isYou ? theme.accent : 'transparent'}`, background: s.isYou ? `${theme.accent}08` : 'transparent' }}>
              <GuildMonogram theme={theme} guild={g} size={40} selected={locked[s.i]} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.ink }}>{s.name === 'you' ? 'You' : s.name}</div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 1 }}>{g.name}</div>
              </div>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: locked[s.i] ? theme.good : theme.inkMuted }}>{locked[s.i] ? 'LOCKED' : '...'}</span>
            </div>
          );
        })}
      </div>

      {/* picker panel */}
      <div style={{ padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionLabel theme={theme} kicker={`YOU · P${(you?.i ?? 0) + 1}`}>Select your guild</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {GUILDS.map(g => {
            const active = you?.guild === g.id;
            return (
              <div key={g.id} onClick={() => !locked[you?.i] && setGuildForYou(g.id)}
                style={{ cursor: locked[you?.i] ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, border: `1px solid ${active ? theme.accent : 'transparent'}`, background: active ? `${theme.accent}0a` : 'transparent' }}>
                <GuildMonogram theme={theme} guild={g} size={56} selected={active} />
                <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: active ? theme.accent : theme.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>{g.name}</div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 16, border: `1px solid ${theme.line}`, background: theme.panel, display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, alignItems: 'center' }}>
          <GuildMonogram theme={theme} guild={selectedGuild} size={80} selected />
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: selectedAccent, letterSpacing: 2 }}>{selectedGuild.tag.toUpperCase()}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink, letterSpacing: '-0.01em' }}>{selectedGuild.name}</div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, marginTop: 4, maxWidth: 520 }}>{selectedGuild.bio}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn theme={theme} size="sm" onClick={() => openDetails && openDetails(selectedGuild.id)}>DETAILS</Btn>
            <Btn theme={theme} primary onClick={() => toggleLock(you.i)}>{locked[you?.i] ? 'UNLOCK' : 'LOCK IN →'}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortraitSlot({ theme, slot, locked, onToggleLock }) {
  if (slot.empty) {
    return (
      <div style={{ border: `1px dashed ${theme.line}`, minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        P{slot.i + 1} · OPEN
      </div>
    );
  }
  const g = GUILDS.find(gg => gg.id === slot.guild) || GUILDS[0];
  const accent = guildAccent(g, theme.id);
  const teamColor = teamColorFor(slot);
  const ringColor = slot.isYou ? theme.accent : (slot.team ? teamColor : theme.line);
  return (
    <div onClick={onToggleLock} style={{ border: `2px solid ${ringColor}`, padding: 6, background: theme.panelRaised, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: slot.isYou ? 'pointer' : 'default' }}>
      <GuildMonogram theme={theme} guild={g} size={42} selected={locked} />
      <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.ink, letterSpacing: 1, textAlign: 'center' }}>
        {slot.name === 'you' ? 'YOU' : slot.name.toUpperCase().slice(0, 8)}
      </div>
      <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: accent, letterSpacing: 1 }}>{g.glyph}</div>
      <span style={{ fontFamily: theme.fontMono, fontSize: 8, color: locked ? theme.good : theme.inkMuted, letterSpacing: 1 }}>{locked ? 'LOCKED' : '...'}</span>
    </div>
  );
}

// =================================================================
// 17 · 8-PLAYER LOADING SCREEN
// =================================================================
function MPLoadingScreen({ theme, slots: slotsIn, room, onDone }) {
  const slots = ensureSlots(slotsIn, room?.mode?.max || 8);
  const filled = slots.filter(s => !s.empty);
  const [progress, setProgress] = React.useState(filled.map(() => 0));
  const stage = STAGES.find(s => s.id === room?.stageId) || STAGES[0];

  React.useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = () => {
      const dt = performance.now() - t0;
      setProgress(filled.map((_, i) => Math.min(1, dt / (2200 + i * 450))));
      if (dt < 4000) raf = requestAnimationFrame(step);
      else if (onDone) setTimeout(onDone, 400);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const teams = room?.mode?.teams || 0;
  const grouped = teams ? Array.from({ length: teams }, (_, t) => filled.filter(s => s.team === t + 1)) : null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: theme.bg, color: theme.ink }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>BATTLE PREPARING · {room?.mode?.label || 'FFA'}</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 28, color: theme.ink }}>{stage.name}</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, fontStyle: 'italic', marginTop: 2 }}>{stage.flavor}</div>
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.accent, letterSpacing: 2 }}>
          {filled.length} PLAYERS · CONNECTING…
        </div>
      </div>

      {/* Teams or FFA grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 36px', gap: 14, overflow: 'auto' }}>
        {teams ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${teams}, 1fr)`, gap: 14, flex: 1 }}>
            {grouped.map((teamSlots, ti) => {
              const color = TEAM_COLORS[ti % TEAM_COLORS.length];
              return (
                <div key={ti} style={{ border: `1px solid ${color}`, padding: 14, background: theme.panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color }}>Team {ti + 1}</span>
                    <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>{teamSlots.length} PLAYERS</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {teamSlots.map(s => <LoadCard key={s.i} theme={theme} slot={s} pct={progress[filled.indexOf(s)] || 0} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, filled.length)}, 1fr)`, gap: 10, flex: 1 }}>
            {filled.map((s, i) => <LoadCard key={s.i} theme={theme} slot={s} pct={progress[i] || 0} />)}
          </div>
        )}

        <div style={{ padding: '14px 18px', background: theme.panel, border: `1px solid ${theme.lineSoft}` }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: theme.accent, marginBottom: 6 }}>▸ TIP</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.ink }}>
            Hold <span style={{ fontFamily: theme.fontMono, color: theme.accent }}>↓</span> to defend; tap twice to dodge. Taunt (<span style={{ fontFamily: theme.fontMono, color: theme.accent }}>T</span>) builds your resource faster but interrupts on hit.
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadCard({ theme, slot, pct }) {
  const g = GUILDS.find(gg => gg.id === slot.guild) || GUILDS[0];
  const accent = guildAccent(g, theme.id);
  const teamColor = teamColorFor(slot);
  return (
    <div style={{ border: `1px solid ${slot.team ? teamColor : theme.line}`, background: theme.bgDeep, padding: 10, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10, alignItems: 'center' }}>
      <GuildMonogram theme={theme} guild={g} size={44} selected={pct > 0.98} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>P{slot.i + 1} {slot.isYou && '· YOU'}</div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.name === 'you' ? 'You' : slot.name} <span style={{ color: accent, fontSize: 11, fontFamily: theme.fontMono }}> · {g.glyph}</span>
        </div>
        <div style={{ marginTop: 6, height: 4, background: theme.line, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, background: pct > 0.98 ? theme.good : accent, transition: 'width 120ms linear' }} />
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginTop: 3 }}>
          {pct > 0.98 ? 'READY' : `${Math.floor(pct * 100)}%`}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 18 · 8-PLAYER BATTLE HUD — 4 top / 4 bottom (LF2 classic)
// =================================================================
function MPBattleHUD8({ theme, slots: slotsIn, room, onPause, onEnd, showLog = true }) {
  const slots = ensureSlots(slotsIn, room?.mode?.max || 8);
  const filled = slots.filter(s => !s.empty);
  const [states, setStates] = React.useState(() => filled.map((s) => {
    const g = GUILDS.find(gg => gg.id === s.guild) || GUILDS[0];
    return {
      id: s.i, hp: g.vitals.HP, hpMax: g.vitals.HP,
      mp: g.resource.max, mpMax: g.resource.max,
      dead: false, flash: false,
    };
  }));
  const [time, setTime] = React.useState(180);
  const [log, setLog] = React.useState([
    { t: 'system', m: `Round 1 · ${filled.length} fighters · FIGHT!` },
  ]);

  React.useEffect(() => {
    const dt = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(dt);
  }, []);

  // tick: random chip damage, occasional big hits
  React.useEffect(() => {
    const t = setInterval(() => {
      setStates(prev => prev.map(p => {
        if (p.dead) return p;
        const big = Math.random() < 0.08;
        const d = big ? 20 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 6);
        let hp = Math.max(0, p.hp - d);
        const dead = hp === 0;
        return { ...p, hp, dead, flash: big };
      }));
      setStates(cur => {
        // clear flash
        setTimeout(() => setStates(s2 => s2.map(p => ({ ...p, flash: false }))), 140);
        return cur;
      });
    }, 900);
    return () => clearInterval(t);
  }, []);

  // log generator
  React.useEffect(() => {
    const t = setInterval(() => {
      const alive = filled.filter((_, i) => !states[i]?.dead);
      if (alive.length < 2) return;
      const a = alive[Math.floor(Math.random() * alive.length)];
      const b = alive[Math.floor(Math.random() * alive.length)];
      if (a.i === b.i) return;
      const ga = GUILDS.find(g => g.id === a.guild);
      const ability = ga.abilities[Math.floor(Math.random() * ga.abilities.length)];
      const dmg = 20 + Math.floor(Math.random() * 40);
      setLog(l => [...l.slice(-40), { t: 'hit', m: `${a.name === 'you' ? 'You' : a.name} → ${b.name === 'you' ? 'you' : b.name} · ${ability.name} (${dmg})` }]);
    }, 1400);
    return () => clearInterval(t);
  }, [states]);

  const top = filled.slice(0, 4);
  const bottom = filled.slice(4, 8);

  const alive = states.filter(s => !s.dead).length;
  React.useEffect(() => {
    if (alive <= 1 && onEnd) setTimeout(() => onEnd(), 1200);
  }, [alive]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* TOP HUD — 4 players */}
      <PlayerBarRow theme={theme} players={top} states={states} alignTop />

      {/* CENTER — stage + timer + alive count */}
      <div style={{ flex: 1, position: 'relative', background: `linear-gradient(180deg, ${theme.bg}, ${theme.bgDeep})`, overflow: 'hidden' }}>
        <StageBackdrop theme={theme} stageId={room?.stageId} />

        {/* timer + alive */}
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <TimerBadge2 theme={theme} time={time} />
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>{alive} / {filled.length} ALIVE</div>
        </div>

        {/* Fighter tokens — scatter across stage */}
        <div style={{ position: 'absolute', inset: '30% 8% 10% 8%' }}>
          {filled.map((s, i) => {
            const st = states[i];
            const g = GUILDS.find(gg => gg.id === s.guild) || GUILDS[0];
            const accent = guildAccent(g, theme.id);
            const teamColor = teamColorFor(s);
            const x = 6 + ((i * 127) % 88);
            const y = 10 + ((i * 67) % 70);
            return (
              <div key={s.i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', textAlign: 'center', opacity: st?.dead ? 0.3 : 1, filter: st?.flash ? 'brightness(1.6)' : 'none', transition: 'filter 140ms' }}>
                <div style={{ fontFamily: theme.id === 'terminal' ? theme.fontMono : theme.fontDisplay, fontSize: 34, color: st?.dead ? theme.inkMuted : accent, lineHeight: 1, textShadow: st?.dead ? 'none' : `0 0 6px ${accent}` }}>{g.glyph}</div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 1, color: s.team ? teamColor : theme.ink, marginTop: 2 }}>{s.name === 'you' ? 'YOU' : s.name.toUpperCase().slice(0, 7)}</div>
                {st?.dead && <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.bad, letterSpacing: 2 }}>KO</div>}
              </div>
            );
          })}
        </div>

        {showLog && (
          <div style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 260, background: `${theme.bgDeep}dd`, border: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.accent, letterSpacing: 2 }}>▸ COMBAT LOG · {filled.length}P</span>
              <span onClick={onPause} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkDim, letterSpacing: 2 }}>ESC</span>
            </div>
            <div style={{ padding: '6px 12px', fontFamily: theme.fontMono, fontSize: 10, lineHeight: 1.5, color: theme.inkDim, overflow: 'auto' }}>
              {log.map((l, i) => <div key={i} style={{ color: l.t === 'system' ? theme.accent : theme.inkDim }}>{l.t === 'system' ? '▸ ' : '  '}{l.m}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM HUD — 4 players */}
      <PlayerBarRow theme={theme} players={bottom} states={states} offset={4} />
    </div>
  );
}

function PlayerBarRow({ theme, players, states, alignTop = false, offset = 0 }) {
  if (players.length === 0) return null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)`, gap: 4,
      padding: '8px 10px',
      background: theme.panel,
      borderBottom: alignTop ? `1px solid ${theme.line}` : 'none',
      borderTop: alignTop ? 'none' : `1px solid ${theme.line}`,
    }}>
      {players.map((s, i) => {
        const st = states[i + offset];
        const g = GUILDS.find(gg => gg.id === s.guild) || GUILDS[0];
        const accent = guildAccent(g, theme.id);
        const teamColor = teamColorFor(s);
        const hpPct = (st?.hp || 0) / (st?.hpMax || 1);
        const mpPct = (st?.mp || 0) / (st?.mpMax || 1);
        return (
          <div key={s.i} style={{
            padding: 6,
            border: `1px solid ${s.isYou ? theme.accent : (s.team ? teamColor : theme.lineSoft)}`,
            background: st?.dead ? `${theme.bad}11` : (s.isYou ? `${theme.accent}08` : theme.bgDeep),
            opacity: st?.dead ? 0.55 : 1,
            display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8,
            position: 'relative',
          }}>
            <GuildMonogram theme={theme} guild={g} size={36} selected={s.isYou} dim={st?.dead} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: s.team ? teamColor : theme.ink, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  P{s.i + 1}·{s.name === 'you' ? 'YOU' : s.name.toUpperCase().slice(0, 7)}
                </span>
                {st?.dead && <span style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.bad, letterSpacing: 1 }}>KO</span>}
              </div>
              <div style={{ marginTop: 3 }}>
                <div style={{ height: 6, background: theme.line, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${hpPct * 100}%`, background: hpPct > 0.35 ? theme.good : hpPct > 0.15 ? theme.warn : theme.bad, transition: 'width 200ms linear', boxShadow: st?.flash ? `0 0 10px ${theme.bad}` : 'none' }} />
                </div>
                <div style={{ height: 3, background: theme.line, position: 'relative', overflow: 'hidden', marginTop: 2 }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${mpPct * 100}%`, background: accent, transition: 'width 200ms linear' }} />
                </div>
              </div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 1, marginTop: 2 }}>
                {st?.hp || 0}/{st?.hpMax || 0}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimerBadge2({ theme, time }) {
  const crit = time <= 10;
  const m = Math.floor(time / 60), s = time % 60;
  return (
    <div style={{ padding: '4px 14px', border: `1px solid ${crit ? theme.bad : theme.accent}`, background: theme.bgDeep, fontFamily: theme.fontMono, fontSize: 22, letterSpacing: 3, color: crit ? theme.bad : theme.accent }}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  );
}

function StageBackdrop({ theme, stageId }) {
  const s = STAGES.find(x => x.id === stageId) || STAGES[0];
  const hue = s.hue;
  const bg = theme.id === 'terminal'
    ? `radial-gradient(600px 300px at 50% 60%, oklch(0.28 0.1 ${hue} / 0.4), transparent 70%)`
    : `radial-gradient(600px 300px at 50% 60%, oklch(0.35 0.12 ${hue} / 0.5), transparent 70%)`;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: bg, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
        ▸ {s.name.toUpperCase()}
      </div>
    </>
  );
}

// =================================================================
// 19 · 8-PLAYER RESULTS
// =================================================================
function MPResults8({ theme, slots: slotsIn, room, onAgain, onMenu }) {
  const slots = ensureSlots(slotsIn, room?.mode?.max || 8);
  const filled = slots.filter(s => !s.empty);
  const teams = room?.mode?.teams || 0;

  // Stable synthesized scoreboard — based on slot index + code
  const seed = (room?.code || 'ABCDEF').charCodeAt(0);
  const rows = filled.map((s, i) => {
    const base = Math.abs(Math.sin((i + 1) * 19 + seed)) * 100;
    return {
      slot: s,
      kills: Math.floor(base / 25),
      deaths: Math.floor(((seed + i * 13) % 9) / 2),
      dmg: 800 + Math.floor(base * 22),
      heal: Math.floor(base * 3),
      score: Math.floor(base * 13),
    };
  }).sort((a, b) => b.score - a.score);

  const winner = rows[0];
  const winnerTeam = winner?.slot?.team;
  const winningRows = winnerTeam ? rows.filter(r => r.slot.team === winnerTeam) : [winner];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* Winner banner */}
      <div style={{ padding: '28px 36px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 30, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>RESULTS · {room?.mode?.label || 'FFA'}</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 64, color: theme.accent, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6 }}>
            {winnerTeam ? `Team ${winnerTeam} wins` : `${winner?.slot?.name === 'you' ? 'You win' : `${winner?.slot?.name} wins`}`}
          </div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, marginTop: 6 }}>
            {filled.length} fighters · {(STAGES.find(s => s.id === room?.stageId) || STAGES[0]).name} · {room?.name || 'Room'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {winningRows.map(r => {
            const g = GUILDS.find(gg => gg.id === r.slot.guild) || GUILDS[0];
            return <GuildMonogram key={r.slot.i} theme={theme} guild={g} size={90} selected />;
          })}
        </div>
      </div>

      {/* Scoreboard */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
        <SectionLabel theme={theme} kicker="SCOREBOARD" right="SORTED BY SCORE">Final tally</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 42px 1.4fr 80px 60px 60px 90px 90px 1fr', gap: 14, padding: '10px 0', borderBottom: `1px solid ${theme.line}`, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
            <span>#</span><span></span><span>PLAYER</span><span>MODE</span><span>K</span><span>D</span><span>DMG</span><span>HEAL</span><span>SCORE</span>
          </div>
          {rows.map((r, i) => {
            const g = GUILDS.find(gg => gg.id === r.slot.guild) || GUILDS[0];
            const accent = guildAccent(g, theme.id);
            const teamColor = teamColorFor(r.slot);
            const maxScore = rows[0].score;
            return (
              <div key={r.slot.i} style={{ display: 'grid', gridTemplateColumns: '32px 42px 1.4fr 80px 60px 60px 90px 90px 1fr', gap: 14, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, alignItems: 'center', background: r.slot.isYou ? `${theme.accent}0a` : 'transparent' }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: i === 0 ? theme.accent : theme.inkDim }}>{i + 1}</span>
                <GuildMonogram theme={theme} guild={g} size={32} selected={i === 0} />
                <div>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.ink }}>{r.slot.name === 'you' ? 'You' : r.slot.name} {r.slot.isYou && <Chip theme={theme} mono tone="accent">YOU</Chip>}</div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 1 }}>{g.name}</div>
                </div>
                <div>{r.slot.team ? <Chip theme={theme} mono><span style={{ color: teamColor }}>T{r.slot.team}</span></Chip> : <Chip theme={theme} mono>SOLO</Chip>}</div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.ink }}>{r.kills}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.inkDim }}>{r.deaths}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.inkDim }}>{r.dmg}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.good }}>{r.heal}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: theme.line, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${(r.score / maxScore) * 100}%`, background: i === 0 ? theme.accent : accent }} />
                  </div>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.ink, minWidth: 40, textAlign: 'right' }}>{r.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn theme={theme} onClick={onMenu}>← LEAVE</Btn>
        <Btn theme={theme} primary onClick={onAgain}>REMATCH →</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { MPCharSelect8, MPLoadingScreen, MPBattleHUD8, MPResults8, GuildDetailOverlay });
// =================================================================
// GUILD DETAIL OVERLAY · compact modal for quick guild inspection in MP
// =================================================================
function GuildDetailOverlay({ theme, guildId, you, locked, onClose, onSelect }) {
  const g = GUILDS.find(x => x.id === guildId) || GUILDS[0];
  const accent = guildAccent(g, theme.id);
  const isYours = you?.guild === g.id;
  const canSelect = !locked?.[you?.i];

  // Close on ESC
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
         style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: 880, maxWidth: 'calc(100% - 60px)', maxHeight: 'calc(100% - 60px)', background: theme.bg, border: `1px solid ${accent}`, boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
          <GuildMonogram theme={theme} guild={g} size={72} selected />
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>GUILD DOSSIER · {g.tag.toUpperCase()}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 32, color: theme.ink, letterSpacing: '-0.015em', lineHeight: 1.05, marginTop: 2 }}>{g.name}</div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, fontStyle: 'italic', marginTop: 4, maxWidth: 580 }}>{g.bio}</div>
          </div>
          <div onClick={onClose} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 22, color: theme.inkDim, padding: '0 10px' }} title="Close · ESC">×</div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflow: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {/* Vitals + resource */}
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 10 }}>VITALS · SURVIVABILITY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {Object.entries(g.vitals).map(([k, v]) => (
                <div key={k} style={{ padding: '10px 12px', border: `1px solid ${theme.lineSoft}`, background: theme.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>{k.toUpperCase()}</span>
                  <span style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: theme.ink }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, padding: '12px 14px', border: `1px solid ${accent}`, background: `${accent}0c` }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>RESOURCE</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.ink, marginTop: 2 }}>{g.resource.name}</div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim, letterSpacing: 1, marginTop: 2 }}>CAPACITY · {g.resource.max}</div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>STATS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {Object.entries(g.stats).map(([k, v]) => (
                  <div key={k} style={{ padding: '6px 8px', border: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', fontFamily: theme.fontMono, fontSize: 11 }}>
                    <span style={{ color: theme.inkMuted, letterSpacing: 1 }}>{k}</span>
                    <span style={{ color: theme.ink }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Abilities */}
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 10 }}>ABILITIES · 5 + ULT</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.abilities.map((a, i) => {
                const isUlt = i === 4;
                return (
                  <div key={i} style={{ padding: '10px 12px', border: `1px solid ${isUlt ? accent : theme.lineSoft}`, background: isUlt ? `${accent}0a` : theme.panel, display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: isUlt ? accent : theme.inkMuted, letterSpacing: 2, textAlign: 'center' }}>{a.combo || `${a.slot}`}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: isUlt ? accent : theme.ink }}>{a.name}{isUlt && <span style={{ marginLeft: 6, fontFamily: theme.fontMono, fontSize: 9, color: accent, letterSpacing: 2 }}>ULT</span>}</div>
                      <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim }}>{a.fx}</div>
                    </div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1, textAlign: 'right' }}>
                      <div>CD·{a.cd}s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
            {isYours ? '▸ CURRENTLY EQUIPPED' : canSelect ? '▸ NOT SELECTED' : '▸ LOCKED — UNLOCK FIRST TO CHANGE'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn theme={theme} onClick={onClose}>CLOSE · ESC</Btn>
            {!isYours && canSelect && <Btn theme={theme} primary onClick={() => onSelect && onSelect(g.id)}>SELECT →</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}
