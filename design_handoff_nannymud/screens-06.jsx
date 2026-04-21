// screens-06.jsx — ROOM LOBBY (pre-game): 8 slots, teams, ready-up, chat.

// Synthetic occupancy derived from the room object. Host is you = slot 0.
function seedSlotsForRoom(room) {
  const max = room?.mode?.max || 8;
  const teams = room?.mode?.teams || 0;
  const players = ['you', ...FAKE_PLAYERS.slice(0, Math.max(0, (room?.filled || 3) - 1))];
  // fill slot list to mode.max
  const slots = Array.from({ length: max }, (_, i) => {
    const name = players[i];
    if (!name) return { i, empty: true };
    const guild = GUILDS[(i * 3 + (room?.code?.charCodeAt(0) || 0)) % GUILDS.length].id;
    const team = teams ? (i % teams) + 1 : null;
    return {
      i, name, guild, team,
      ping: name === 'you' ? 14 : 20 + ((i * 37) % 180),
      ready: name === 'you' ? false : ((i * 19) % 3 !== 0),
      isHost: i === 0 || name === room?.host,
      isYou: name === 'you',
    };
  });
  return slots;
}

function RoomLobby({ theme, room, slots: extSlots, myGuild, onBack, onLaunch, onChangeGuild, onEditRoom }) {
  const [slots, setSlots] = React.useState(() => extSlots || seedSlotsForRoom(room));

  // If parent provides slots (edit flow / direct nav), sync into local state
  React.useEffect(() => {
    if (extSlots) setSlots(extSlots);
  }, [extSlots]);

  // Keep YOUR slot's guild synced with the currently selected guild (state.p1)
  React.useEffect(() => {
    if (!myGuild) return;
    setSlots(ss => ss.map(s => (s.isYou ? { ...s, guild: myGuild } : s)));
  }, [myGuild]);
  const [chat, setChat] = React.useState([
    { who: room?.host || 'Host', t: 'gl hf — first to 2' },
    { who: 'Lektor', t: 'need one more for 4v4' },
    { who: 'system', sys: true, t: `Room created. Code #${room?.code || 'XXXXXX'}` },
  ]);
  const [msg, setMsg] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const you = slots.find(s => s.isYou);
  const teams = room?.mode?.teams || 0;

  // sim: bots toggle ready occasionally
  React.useEffect(() => {
    const t = setInterval(() => {
      setSlots(ss => ss.map(s => s.empty || s.isYou ? s : (Math.random() < 0.2 ? { ...s, ready: !s.ready } : s)));
    }, 3600);
    return () => clearInterval(t);
  }, []);

  const toggleReady = () => setSlots(ss => ss.map(s => s.isYou ? { ...s, ready: !s.ready } : s));
  const switchTeam = (i) => {
    if (!teams) return;
    setSlots(ss => ss.map(s => s.i === i ? { ...s, team: (s.team % teams) + 1 } : s));
  };
  const kick = (i) => setSlots(ss => ss.map(s => s.i === i ? { i, empty: true } : s));

  const allReady = slots.filter(s => !s.empty && !s.isHost).every(s => s.ready);
  const canLaunch = you?.isHost && slots.filter(s => !s.empty).length >= 2 && allReady;

  const send = (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setChat(c => [...c, { who: 'you', t: msg.trim() }]);
    setMsg('');
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(room?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      {/* top bar */}
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>ROOM LOBBY · PRE-GAME · {slots.filter(s => !s.empty).length}/{slots.length}</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, letterSpacing: '-0.01em' }}>{room?.name || 'Untitled Room'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>CODE</div>
          <div onClick={copyCode} style={{ cursor: 'pointer', padding: '8px 14px', background: theme.bgDeep, border: `1px solid ${theme.accent}`, color: theme.accent, fontFamily: theme.fontMono, fontSize: 18, letterSpacing: 6 }} title="Click to copy">
            #{room?.code || 'XXXXXX'}
          </div>
          <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: copied ? theme.good : theme.inkMuted, letterSpacing: 2, width: 62 }}>{copied ? 'COPIED ✓' : 'CLICK·COPY'}</span>
        </div>
        <Btn theme={theme} onClick={onBack}>← LEAVE</Btn>
      </div>

      {/* Meta strip */}
      <div style={{ padding: '10px 32px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Chip theme={theme} mono tone="accent">{room?.mode?.label || 'FFA'}</Chip>
        <Chip theme={theme} mono>BO{room?.rounds || 3}</Chip>
        <Chip theme={theme} mono>{(STAGES.find(s => s.id === room?.stageId) || STAGES[0]).name}</Chip>
        <Chip theme={theme} mono>{room?.visibility?.toUpperCase() || 'PUBLIC'}</Chip>
        {room?.locked && <Chip theme={theme} mono tone="bad">LOCKED</Chip>}
        <Chip theme={theme} mono>FF · {room?.friendlyFire === false ? 'OFF' : 'ON'}</Chip>
        <Chip theme={theme} mono>SPECTATORS · {room?.specSlots ?? 2}</Chip>
      </div>

      {/* Body: slots grid + chat */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 0, overflow: 'hidden' }}>
        {/* slots */}
        <div style={{ padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel theme={theme} kicker="PLAYERS" right={teams ? `${teams} TEAMS · CLICK TEAM BADGE TO SWAP` : 'FREE-FOR-ALL'}>Slots</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            {slots.map(s => <SlotCard key={s.i} theme={theme} slot={s} teams={teams} isYouHost={you?.isHost} onKick={() => kick(s.i)} onSwitchTeam={() => switchTeam(s.i)} onChangeGuild={s.isYou ? onChangeGuild : null} />)}
          </div>

          {/* Footer actions */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, minWidth: 160 }}>
              {allReady ? '▸ ALL PLAYERS READY' : `▸ WAITING FOR ${slots.filter(s => !s.empty && !s.isHost && !s.ready).length} PLAYER(S)`}
            </div>
            {onChangeGuild && <Btn theme={theme} size="sm" onClick={onChangeGuild}>⇄ CHANGE GUILD</Btn>}
            {you?.isHost && onEditRoom && <Btn theme={theme} size="sm" onClick={onEditRoom}>✎ EDIT ROOM</Btn>}
            <Btn theme={theme} onClick={toggleReady}>{you?.ready ? '■ READY' : '□ READY UP'}</Btn>
            {you?.isHost && <Btn theme={theme} primary onClick={onLaunch} disabled={!canLaunch}>LAUNCH BATTLE →</Btn>}
          </div>
        </div>

        {/* chat */}
        <div style={{ borderLeft: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 3 }}>▸ LOBBY CHAT</span>
            <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{chat.length} msg</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: theme.fontMono, fontSize: 12 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ color: m.sys ? theme.inkMuted : theme.inkDim, fontStyle: m.sys ? 'italic' : 'normal' }}>
                {!m.sys && <span style={{ color: m.who === 'you' ? theme.accent : theme.ink }}>&lt;{m.who}&gt; </span>}
                {m.t}
              </div>
            ))}
          </div>
          <form onSubmit={send} style={{ padding: 12, borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 6 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="say something…"
              style={{ flex: 1, padding: '8px 10px', background: theme.bgDeep, border: `1px solid ${theme.line}`, color: theme.ink, fontFamily: theme.fontMono, fontSize: 12, outline: 'none', borderRadius: 2 }} />
            <Btn theme={theme} size="sm">SEND</Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

function SlotCard({ theme, slot, teams, isYouHost, onKick, onSwitchTeam, onChangeGuild }) {
  if (slot.empty) {
    return (
      <div style={{ padding: 14, border: `1px dashed ${theme.line}`, color: theme.inkMuted, fontFamily: theme.fontMono, fontSize: 11, letterSpacing: 2, textAlign: 'center', minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        EMPTY SLOT · WAITING…
      </div>
    );
  }
  const guild = GUILDS.find(g => g.id === slot.guild) || GUILDS[0];
  const accent = guildAccent(guild, theme.id);
  const teamColors = ['#5cf2c2', '#ff5d73', '#ffb347', '#928bff'];
  const teamColor = slot.team ? teamColors[(slot.team - 1) % teamColors.length] : theme.inkDim;
  return (
    <div style={{
      padding: 10, border: `1px solid ${slot.isYou ? theme.accent : theme.line}`, background: slot.isYou ? `${theme.accent}0a` : theme.panel,
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', position: 'relative', borderRadius: 2, minHeight: 84,
    }}>
      <GuildMonogram theme={theme} guild={guild} size={56} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink }}>{slot.name === 'you' ? 'You' : slot.name}</span>
          {slot.isHost && <Chip theme={theme} mono tone="accent">HOST</Chip>}
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 1, marginTop: 2 }}>{guild.name}</div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1, marginTop: 2 }}>
          {slot.ping}ms · slot {String(slot.i + 1).padStart(2, '0')}
          {onChangeGuild && <span onClick={onChangeGuild} style={{ marginLeft: 8, cursor: 'pointer', color: theme.accent, letterSpacing: 2 }}>[ CHANGE GUILD ]</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: slot.ready ? theme.good : theme.inkMuted, border: `1px solid ${slot.ready ? theme.good : theme.lineSoft}`, padding: '2px 8px' }}>
          {slot.ready ? '■ READY' : '□ WAIT'}
        </span>
        {teams > 0 && (
          <span onClick={onSwitchTeam}
            style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2, color: teamColor, border: `1px solid ${teamColor}`, padding: '2px 8px' }}>
            TEAM {slot.team}
          </span>
        )}
        {isYouHost && !slot.isYou && (
          <span onClick={onKick} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, opacity: 0.6 }} title="Host: kick">[ KICK ]</span>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { RoomLobby, seedSlotsForRoom });
