// screens-05.jsx — MULTIPLAYER HUB (3 style variants) + CREATE/JOIN modals
// Terminal theme only (per user request).

// =================================================================
// 13 · MULTIPLAYER HUB
// =================================================================
function MultiplayerHub({ theme, onBack, onCreate, onJoin, onEnterRoom, style = 'table' }) {
  const [query, setQuery] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('all');
  const [showFull, setShowFull] = React.useState(true);
  const [showLocked, setShowLocked] = React.useState(true);
  const [focusId, setFocusId] = React.useState(MP_ROOMS[0].id);
  const [tick, setTick] = React.useState(0);
  // live-feel: rooms breath player counts
  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2200);
    return () => clearInterval(t);
  }, []);

  const rooms = MP_ROOMS
    .map(r => ({ ...r, filled: Math.max(1, Math.min(r.max, r.filled + ((r.id.charCodeAt(1) + tick) % 5 === 0 ? 1 : (r.id.charCodeAt(1) + tick) % 7 === 0 ? -1 : 0))) }))
    .filter(r => (modeFilter === 'all' || r.mode.id === modeFilter))
    .filter(r => showFull || r.state !== 'FULL')
    .filter(r => showLocked || !r.locked)
    .filter(r => !query || r.name.toLowerCase().includes(query.toLowerCase()) || r.host.toLowerCase().includes(query.toLowerCase()) || r.code.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ padding: '18px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>MULTIPLAYER · LOBBY BROWSER</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, letterSpacing: '-0.01em' }}>
            {rooms.length} rooms open · {rooms.reduce((a, r) => a + r.filled, 0)} players online
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} onClick={onJoin}>JOIN BY CODE</Btn>
          <Btn theme={theme} primary onClick={onCreate}>+ HOST ROOM</Btn>
          <Btn theme={theme} size="sm" onClick={onBack}>← BACK</Btn>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '12px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 20, background: theme.panel }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>▸ SEARCH</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="name, host, code"
            style={{ flex: 1, background: theme.bgDeep, border: `1px solid ${theme.line}`, color: theme.ink, padding: '6px 10px', fontFamily: theme.fontMono, fontSize: 12, outline: 'none', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ id: 'all', l: 'ALL' }, ...MP_MODES.map(m => ({ id: m.id, l: m.label }))].map(m => (
            <span key={m.id} onClick={() => setModeFilter(m.id)}
              style={{ padding: '5px 10px', cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, border: `1px solid ${modeFilter === m.id ? theme.accent : theme.lineSoft}`, color: modeFilter === m.id ? theme.accent : theme.inkDim, background: modeFilter === m.id ? `${theme.accent}12` : 'transparent', borderRadius: 2 }}>
              {m.l}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowFull(!showFull)}>
          <span style={{ width: 12, height: 12, border: `1px solid ${showFull ? theme.accent : theme.line}`, background: showFull ? theme.accent : 'transparent' }} />
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 2 }}>FULL</span>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowLocked(!showLocked)}>
          <span style={{ width: 12, height: 12, border: `1px solid ${showLocked ? theme.accent : theme.line}`, background: showLocked ? theme.accent : 'transparent' }} />
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 2 }}>LOCKED</span>
        </label>
      </div>

      {/* Body: style-dependent */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {style === 'table' && <HubTable theme={theme} rooms={rooms} onEnter={onEnterRoom} focusId={focusId} setFocusId={setFocusId} />}
        {style === 'cards' && <HubCards theme={theme} rooms={rooms} onEnter={onEnterRoom} />}
        {style === 'split' && <HubSplit theme={theme} rooms={rooms} onEnter={onEnterRoom} focusId={focusId} setFocusId={setFocusId} />}
      </div>
    </div>
  );
}

// --- Table variant (LF2-ish, dense) -------------------------------
function HubTable({ theme, rooms, onEnter, focusId, setFocusId }) {
  const cols = [
    { k: 'name',   l: 'ROOM',    w: '2fr' },
    { k: 'host',   l: 'HOST',    w: '1fr' },
    { k: 'mode',   l: 'MODE',    w: '1fr' },
    { k: 'slots',  l: 'PLAYERS', w: '110px' },
    { k: 'region', l: 'REGION',  w: '70px' },
    { k: 'ping',   l: 'PING',    w: '60px' },
    { k: 'state',  l: 'STATE',   w: '90px' },
    { k: 'lock',   l: '',        w: '30px' },
  ];
  const grid = cols.map(c => c.w).join(' ');
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 36px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, padding: '10px 0', borderBottom: `1px solid ${theme.line}`, position: 'sticky', top: 0, background: theme.bg, zIndex: 2 }}>
        {cols.map(c => (
          <div key={c.k} style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{c.l}</div>
        ))}
      </div>
      {rooms.map(r => {
        const full = r.filled >= r.max;
        const active = r.id === focusId;
        return (
          <div key={r.id}
            onMouseEnter={() => setFocusId(r.id)}
            onDoubleClick={() => onEnter(r)}
            onClick={() => setFocusId(r.id)}
            style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, cursor: 'pointer', background: active ? `${theme.accent}09` : 'transparent', borderLeft: `2px solid ${active ? theme.accent : 'transparent'}`, paddingLeft: active ? 8 : 10 }}>
            <div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: active ? theme.accent : theme.ink, letterSpacing: '-0.01em' }}>{r.name}</div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1 }}>#{r.code}</div>
            </div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, alignSelf: 'center' }}>{r.host}</div>
            <div style={{ alignSelf: 'center' }}>
              <Chip theme={theme} mono>{r.mode.label}</Chip>
            </div>
            <div style={{ alignSelf: 'center', fontFamily: theme.fontMono, fontSize: 12, color: full ? theme.bad : theme.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{r.filled}/{r.max}</span>
              <SlotDots theme={theme} filled={r.filled} max={r.max} />
            </div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 1, alignSelf: 'center' }}>{r.region}</div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, alignSelf: 'center', color: r.ping < 60 ? theme.good : r.ping < 120 ? theme.warn : theme.bad }}>{r.ping}ms</div>
            <div style={{ alignSelf: 'center' }}>
              <Chip theme={theme} mono tone={r.state === 'LOBBY' ? 'good' : r.state === 'FULL' ? 'bad' : 'default'}>{r.state}</Chip>
            </div>
            <div style={{ alignSelf: 'center', color: r.locked ? theme.warn : theme.inkMuted, fontFamily: theme.fontMono, fontSize: 12 }}>{r.locked ? '🔒' : '—'}</div>
          </div>
        );
      })}
      {rooms.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: theme.inkMuted, fontFamily: theme.fontBody, fontStyle: 'italic' }}>
          No rooms match your filters. Loosen them, or host your own.
        </div>
      )}
    </div>
  );
}

function SlotDots({ theme, filled, max }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ width: 6, height: 6, background: i < filled ? theme.accent : theme.line, display: 'inline-block' }} />
      ))}
    </span>
  );
}

// --- Cards variant ------------------------------------------------
function HubCards({ theme, rooms, onEnter }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {rooms.map(r => {
          const full = r.filled >= r.max;
          return (
            <div key={r.id} onClick={() => onEnter(r)}
              style={{ border: `1px solid ${theme.line}`, background: theme.panel, padding: 16, cursor: 'pointer', borderRadius: 2, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Chip theme={theme} mono tone={r.state === 'LOBBY' ? 'good' : 'default'}>{r.state}</Chip>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>#{r.code}</span>
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: theme.ink, letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted, marginBottom: 12 }}>hosted by {r.host}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Chip theme={theme} mono>{r.mode.label}</Chip>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: full ? theme.bad : theme.ink }}>{r.filled}/{r.max}</span>
              </div>
              <SlotDots theme={theme} filled={r.filled} max={r.max} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 1 }}>
                <span>{r.region}</span>
                <span style={{ color: r.ping < 60 ? theme.good : r.ping < 120 ? theme.warn : theme.bad }}>{r.ping}ms</span>
                <span style={{ color: r.locked ? theme.warn : theme.inkMuted }}>{r.locked ? 'LOCKED' : 'OPEN'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Split: list on left, detail on right -------------------------
function HubSplit({ theme, rooms, onEnter, focusId, setFocusId }) {
  const focus = rooms.find(r => r.id === focusId) || rooms[0];
  return (
    <>
      <div style={{ flex: '0 0 52%', borderRight: `1px solid ${theme.lineSoft}`, overflow: 'auto' }}>
        {rooms.map(r => {
          const active = r.id === focus?.id;
          return (
            <div key={r.id} onClick={() => setFocusId(r.id)} onDoubleClick={() => onEnter(r)}
              style={{ padding: '14px 24px', borderBottom: `1px solid ${theme.lineSoft}`, cursor: 'pointer', background: active ? `${theme.accent}0f` : 'transparent', borderLeft: `3px solid ${active ? theme.accent : 'transparent'}`, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: active ? theme.accent : theme.ink }}>{r.name}</div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 1, marginTop: 2 }}>
                  {r.host} · {r.region} · #{r.code}
                </div>
              </div>
              <Chip theme={theme} mono>{r.mode.label}</Chip>
              <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: r.filled >= r.max ? theme.bad : theme.ink }}>{r.filled}/{r.max}</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, padding: 28, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {focus && <>
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>ROOM PREVIEW · #{focus.code}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 30, color: theme.ink, letterSpacing: '-0.01em', marginTop: 4 }}>{focus.name}</div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, marginTop: 6 }}>Hosted by <span style={{ color: theme.ink }}>{focus.host}</span> · {focus.region} · {focus.ping}ms · {focus.state}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 14, border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: theme.inkMuted, marginBottom: 6 }}>MODE</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: theme.ink }}>{focus.mode.label}</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim, marginTop: 2 }}>{focus.mode.sub}</div>
            </div>
            <div style={{ padding: 14, border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: theme.inkMuted, marginBottom: 6 }}>SLOTS</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 28, color: theme.accent }}>{focus.filled}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.inkDim }}>/ {focus.max}</span>
              </div>
              <div style={{ marginTop: 6 }}><SlotDots theme={theme} filled={focus.filled} max={focus.max} /></div>
            </div>
          </div>

          <div style={{ padding: 14, border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: theme.inkMuted, marginBottom: 8 }}>STAGE</div>
            {(() => { const s = STAGES.find(x => x.id === focus.stageId) || STAGES[0]; return (
              <>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: theme.ink }}>{s.name}</div>
                <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, fontStyle: 'italic', marginTop: 4 }}>{s.flavor}</div>
              </>
            ); })()}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            {focus.locked && <Btn theme={theme}>ENTER CODE</Btn>}
            <Btn theme={theme} primary onClick={() => onEnter(focus)}>JOIN ROOM →</Btn>
          </div>
        </>}
      </div>
    </>
  );
}

// =================================================================
// 14 · CREATE ROOM MODAL
// =================================================================
function CreateRoomModal({ theme, onCancel, onCreate, initial }) {
  const editing = !!initial;
  const [name, setName] = React.useState(initial?.name || 'New Scrim');
  const [modeId, setModeId] = React.useState(initial?.mode?.id || 'ffa');
  const [stageId, setStageId] = React.useState(initial?.stageId || 'market');
  const [visibility, setVisibility] = React.useState(initial?.visibility || 'public');
  const [locked, setLocked] = React.useState(initial?.locked || false);
  const [code] = React.useState(() => initial?.code || rollCode(6, Math.random() * 10 + 1));
  const [rounds, setRounds] = React.useState(initial?.rounds ?? 3);
  const [friendlyFire, setFf] = React.useState(initial?.friendlyFire ?? true);
  const [specSlots, setSpec] = React.useState(initial?.specSlots ?? 2);

  const mode = MP_MODES.find(m => m.id === modeId) || MP_MODES[0];

  return (
    <ModalShell theme={theme} title={editing ? 'EDIT ROOM' : 'HOST NEW ROOM'} kicker={editing ? '16 · EDIT' : '14 · CREATE'} onCancel={onCancel}
      primary={{ label: editing ? 'SAVE CHANGES →' : 'CREATE ROOM →', onClick: () => onCreate({ name, mode, stageId, visibility, locked, code, rounds, friendlyFire, specSlots }) }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field theme={theme} label="ROOM NAME">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={28}
              style={inputStyle(theme)} />
          </Field>
          <Field theme={theme} label="MODE">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {MP_MODES.map(m => (
                <span key={m.id} onClick={() => setModeId(m.id)}
                  style={{ padding: '8px 10px', cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 1, border: `1px solid ${modeId === m.id ? theme.accent : theme.lineSoft}`, color: modeId === m.id ? theme.accent : theme.inkDim, background: modeId === m.id ? `${theme.accent}12` : 'transparent', borderRadius: 2 }}>
                  <div>{m.label}</div>
                  <div style={{ color: theme.inkMuted, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>{m.sub} · max {m.max}</div>
                </span>
              ))}
            </div>
          </Field>
          <Field theme={theme} label="STAGE">
            <select value={stageId} onChange={e => setStageId(e.target.value)} style={{ ...inputStyle(theme), fontFamily: theme.fontBody }}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field theme={theme} label="VISIBILITY">
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'public',  l: 'PUBLIC',  d: 'Listed in browser' },
                { id: 'friends', l: 'FRIENDS', d: 'Friends-list only' },
                { id: 'private', l: 'PRIVATE', d: 'Code only' },
              ].map(v => (
                <span key={v.id} onClick={() => setVisibility(v.id)}
                  style={{ flex: 1, padding: '8px 10px', cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 1, border: `1px solid ${visibility === v.id ? theme.accent : theme.lineSoft}`, color: visibility === v.id ? theme.accent : theme.inkDim, background: visibility === v.id ? `${theme.accent}12` : 'transparent', borderRadius: 2 }}>
                  <div>{v.l}</div>
                  <div style={{ color: theme.inkMuted, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>{v.d}</div>
                </span>
              ))}
            </div>
          </Field>

          <Field theme={theme} label="ROOM CODE" right={<span style={{ color: locked ? theme.accent : theme.inkMuted, fontSize: 10, letterSpacing: 2 }} onClick={() => setLocked(!locked)}>{locked ? '■ LOCK REQUIRED' : '□ LOCK NOT REQUIRED'}</span>}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '10px 14px', background: theme.bgDeep, border: `1px solid ${theme.line}`, color: theme.accent, fontFamily: theme.fontMono, fontSize: 22, letterSpacing: 8, textAlign: 'center' }}>{code}</div>
              <Btn theme={theme} size="sm" onClick={() => navigator.clipboard?.writeText(code)} title="Copy to clipboard">COPY</Btn>
            </div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 1, marginTop: 6 }}>
              Anyone with this code can join. {visibility === 'private' && '(Only way in for private rooms.)'}
            </div>
          </Field>

          <Field theme={theme} label="OPTIONS">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <OptRow theme={theme} label="ROUNDS" right={
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 3, 5, 7].map(r => (
                    <span key={r} onClick={() => setRounds(r)} style={{ padding: '3px 8px', cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 11, border: `1px solid ${rounds === r ? theme.accent : theme.lineSoft}`, color: rounds === r ? theme.accent : theme.inkDim }}>BO{r}</span>
                  ))}
                </div>
              } />
              <OptRow theme={theme} label="FRIENDLY FIRE" right={
                <span onClick={() => setFf(!friendlyFire)} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 11, color: friendlyFire ? theme.accent : theme.inkMuted, letterSpacing: 2, border: `1px solid ${friendlyFire ? theme.accent : theme.lineSoft}`, padding: '3px 10px' }}>{friendlyFire ? 'ON' : 'OFF'}</span>
              } />
              <OptRow theme={theme} label="SPECTATOR SLOTS" right={
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 2, 4, 8].map(r => (
                    <span key={r} onClick={() => setSpec(r)} style={{ padding: '3px 8px', cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 11, border: `1px solid ${specSlots === r ? theme.accent : theme.lineSoft}`, color: specSlots === r ? theme.accent : theme.inkDim }}>{r}</span>
                  ))}
                </div>
              } />
            </div>
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

function OptRow({ theme, label, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${theme.lineSoft}` }}>
      <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 2 }}>{label}</span>
      {right}
    </div>
  );
}

// =================================================================
// 15 · JOIN BY CODE MODAL
// =================================================================
function JoinByCodeModal({ theme, onCancel, onJoin }) {
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const refs = React.useRef([]);
  const code = digits.join('');
  const recent = ['4X7HQP', 'MV2TAK', 'B9NRLE'];

  const setChar = (i, ch) => {
    const c = (ch || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 1);
    setDigits(d => { const n = [...d]; n[i] = c; return n; });
    if (c && refs.current[i + 1]) refs.current[i + 1].focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && refs.current[i - 1]) refs.current[i - 1].focus();
    if (e.key === 'Enter' && code.length === 6) onJoin(code);
  };

  const fill = (c) => {
    const ups = c.toUpperCase();
    setDigits([0,1,2,3,4,5].map(i => ups[i] || ''));
    setTimeout(() => refs.current[5]?.focus(), 0);
  };

  return (
    <ModalShell theme={theme} title="JOIN BY ROOM CODE" kicker="15 · JOIN" onCancel={onCancel}
      primary={{ label: 'JOIN ROOM →', disabled: code.length !== 6, onClick: () => onJoin(code) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '10px 0' }}>
        <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
          Your host shared a six-character code. It's case-insensitive. Letters only — no O or I, no 0 or 1.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {digits.map((d, i) => (
            <input key={i} ref={el => refs.current[i] = el}
              value={d} onChange={e => setChar(i, e.target.value.slice(-1))}
              onKeyDown={e => onKey(i, e)}
              onPaste={e => { e.preventDefault(); fill(e.clipboardData.getData('text')); }}
              maxLength={1}
              style={{ width: 52, height: 68, textAlign: 'center', fontFamily: theme.fontMono, fontSize: 32, color: theme.accent, background: theme.bgDeep, border: `1px solid ${d ? theme.accent : theme.line}`, borderRadius: 2, outline: 'none', letterSpacing: 0 }} />
          ))}
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
          {code.length}/6 · PASTE SUPPORTED
        </div>

        <div style={{ width: '100%', marginTop: 14, paddingTop: 18, borderTop: `1px solid ${theme.lineSoft}` }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 8 }}>RECENT</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {recent.map(r => (
              <span key={r} onClick={() => fill(r)}
                style={{ padding: '6px 12px', fontFamily: theme.fontMono, fontSize: 13, letterSpacing: 4, color: theme.inkDim, border: `1px solid ${theme.lineSoft}`, cursor: 'pointer', background: theme.panel }}>
                #{r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// =================================================================
// Shared Modal shell / Field / inputs
// =================================================================
function ModalShell({ theme, title, kicker, onCancel, primary, children }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, backdropFilter: 'blur(2px)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onCancel && onCancel(); }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 780, maxHeight: 'calc(100% - 80px)', background: theme.bg, border: `1px solid ${theme.accent}`, boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>{kicker}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>{title}</div>
          </div>
          <div onClick={onCancel} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 18, color: theme.inkDim, padding: '0 8px' }}>×</div>
        </div>
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>{children}</div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn theme={theme} onClick={onCancel}>CANCEL · ESC</Btn>
          {primary && <Btn theme={theme} primary onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</Btn>}
        </div>
      </div>
    </div>
  );
}

function Field({ theme, label, children, right }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function inputStyle(theme) {
  return {
    width: '100%', padding: '10px 12px',
    background: theme.bgDeep, border: `1px solid ${theme.line}`,
    color: theme.ink, fontFamily: theme.fontMono, fontSize: 14,
    outline: 'none', borderRadius: 2, letterSpacing: 1,
  };
}

Object.assign(window, { MultiplayerHub, CreateRoomModal, JoinByCodeModal });
