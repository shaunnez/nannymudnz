// screens-03.jsx — Battle HUD + Pause + Results

// =================================================================
// 06 · IN-BATTLE HUD — live-simulated HP/MP, combo, CDs
// =================================================================
function BattleHUD({ theme, p1Id, p2Id, stageId, onPause, onEnd, showLog = false }) {
  const g1 = GUILDS.find(g => g.id === p1Id) || GUILDS[0];
  const g2 = GUILDS.find(g => g.id === p2Id) || GUILDS[1];
  const stage = STAGES.find(s => s.id === stageId) || STAGES[0];

  // Live sim state
  const [p1, setP1] = React.useState({ hp: g1.vitals.HP, res: g1.resource.max * 0.7, combo: 0 });
  const [p2, setP2] = React.useState({ hp: g2.vitals.HP, res: g2.resource.max * 0.5, combo: 0 });
  const [time, setTime] = React.useState(90);
  const [cds, setCds] = React.useState({ p1: [0,0,0,0,0,0], p2: [0,0,0,0,0,0] });
  const [log, setLog] = React.useState([
    { t: 'SYS', m: 'Round 1 ready.' },
    { t: 'SYS', m: `${stage.name} — ${stage.sub}` },
    { t: 'P1', m: `${g1.name} has entered the arena.` },
    { t: 'P2', m: `${g2.name} has entered the arena.` },
  ]);
  const [flash, setFlash] = React.useState({ p1: false, p2: false });

  React.useEffect(() => {
    const tickResources = setInterval(() => {
      setP1(p => ({ ...p, res: Math.min(g1.resource.max, p.res + 2) }));
      setP2(p => ({ ...p, res: Math.min(g2.resource.max, p.res + 2) }));
      setTime(t => Math.max(0, t - 1));
    }, 1000);

    const tickCombat = setInterval(() => {
      // random action
      const who = Math.random() > 0.5 ? 'p1' : 'p2';
      const targetState = who === 'p1' ? setP2 : setP1;
      const attacker = who === 'p1' ? g1 : g2;
      const dmg = 4 + Math.floor(Math.random() * 18);
      targetState(s => ({ ...s, hp: Math.max(0, s.hp - dmg), combo: s.combo > 0 ? s.combo + 1 : 1 }));
      const maxHp = who === 'p1' ? g2.vitals.HP : g1.vitals.HP;
      setFlash(f => ({ ...f, [who === 'p1' ? 'p2' : 'p1']: true }));
      setTimeout(() => setFlash(f => ({ ...f, [who === 'p1' ? 'p2' : 'p1']: false })), 140);
      const abil = attacker.abilities[Math.floor(Math.random() * 5)];
      setLog(l => [...l.slice(-24), { t: who.toUpperCase(), m: `${attacker.name} uses ${abil.name} — ${dmg}` }]);
      // cooldown
      setCds(c => ({ ...c, [who]: c[who].map((v, i) => i === (abil.slot - 1) ? attacker.abilities[abil.slot - 1].cd : Math.max(0, v - 1)) }));
    }, 1400);

    const tickCombo = setInterval(() => {
      setP1(p => ({ ...p, combo: p.combo > 0 ? Math.max(0, p.combo - 1) : 0 }));
      setP2(p => ({ ...p, combo: p.combo > 0 ? Math.max(0, p.combo - 1) : 0 }));
      setCds(c => ({ p1: c.p1.map(v => Math.max(0, v - 1)), p2: c.p2.map(v => Math.max(0, v - 1)) }));
    }, 600);

    return () => { clearInterval(tickResources); clearInterval(tickCombat); clearInterval(tickCombo); };
  }, [g1, g2, stage.name, stage.sub]);

  const winner = time === 0 ? (p1.hp > p2.hp ? 'P1' : p2.hp > p1.hp ? 'P2' : 'DRAW') : (p1.hp === 0 ? 'P2' : p2.hp === 0 ? 'P1' : null);

  const acc1 = guildAccent(g1, theme.id);
  const acc2 = guildAccent(g2, theme.id);
  const stageAcc = `oklch(0.70 0.16 ${stage.hue})`;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: theme.bgDeep }}>
      {/* Arena placeholder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg, ${stageAcc}22, ${theme.bgDeep} 70%)` }}>
        <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, transparent 0 22px, ${stageAcc}10 22px 23px)` }} />

        {/* Floor line */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '22%', height: 1, background: theme.line, opacity: 0.5 }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '22%', height: '22%', background: `linear-gradient(180deg, ${theme.line}22, transparent)` }} />

        {/* Fighter shadows (placeholders) */}
        <div style={{ position: 'absolute', left: '22%', bottom: '22%', transform: 'translate(-50%, 0)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 120, height: 180, background: `linear-gradient(180deg, ${acc1}aa, ${acc1}44)`, border: `1px solid ${acc1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontDisplay, fontSize: 64, color: theme.bgDeep, fontWeight: 700 }}>{g1.glyph}</div>
          <div style={{ marginTop: 6, width: 90, height: 8, background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)' }} />
        </div>
        <div style={{ position: 'absolute', right: '22%', bottom: '22%', transform: 'translate(50%, 0) scaleX(-1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 120, height: 180, background: `linear-gradient(180deg, ${acc2}aa, ${acc2}44)`, border: `1px solid ${acc2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontDisplay, fontSize: 64, color: theme.bgDeep, fontWeight: 700, transform: 'scaleX(-1)' }}>{g2.glyph}</div>
          <div style={{ marginTop: 6, width: 90, height: 8, background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)' }} />
        </div>

        {/* stage name watermark */}
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>
          {stage.name.toUpperCase()} — {stage.sub.toUpperCase()}
        </div>

        {/* combo floaters */}
        {p1.combo > 2 && <ComboFloat theme={theme} count={p1.combo} left="18%" accent={acc1} />}
        {p2.combo > 2 && <ComboFloat theme={theme} count={p2.combo} right="18%" accent={acc2} />}

        {/* HUD TOP BAR */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'start' }}>
          <FighterHeader theme={theme} guild={g1} state={p1} side="L" accent={acc1} flash={flash.p1} />
          <TimerBadge theme={theme} time={time} />
          <FighterHeader theme={theme} guild={g2} state={p2} side="R" accent={acc2} flash={flash.p2} />
        </div>

        {/* winner overlay */}
        {winner && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.inkMuted, letterSpacing: 6 }}>MATCH END</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 120, color: theme.ink, letterSpacing: '-0.04em' }}>{winner === 'DRAW' ? 'DRAW' : winner}</div>
            <Btn theme={theme} primary onClick={onEnd}>VIEW RESULTS →</Btn>
          </div>
        )}
      </div>

      {/* BOTTOM BAR — abilities full width, log collapsible */}
      <div style={{ borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column' }}>
        {showLog && <BattleLog theme={theme} log={log} onPause={onPause} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <AbilityRack theme={theme} guild={g1} cds={cds.p1} side="L" accent={acc1} />
          <AbilityRack theme={theme} guild={g2} cds={cds.p2} side="R" accent={acc2} />
        </div>
      </div>
    </div>
  );
}

function FighterHeader({ theme, guild, state, side, accent, flash }) {
  const left = side === 'L';
  return (
    <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ position: 'relative' }}>
        <GuildMonogram theme={theme} guild={guild} size={58} selected />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: left ? 'left' : 'right' }}>
        <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>{side === 'L' ? 'P1' : 'P2'}</span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: theme.ink }}>{guild.name}</span>
          <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1, fontStyle: 'italic' }}>{guild.tag}</span>
        </div>
        <div style={{ transform: side === 'R' ? 'scaleX(-1)' : 'none' }}>
          <MeterBar theme={theme} value={state.hp} max={guild.vitals.HP} color={accent} height={14} flash={flash} />
          <div style={{ height: 4 }} />
          <MeterBar theme={theme} value={state.res} max={guild.resource.max} color={guild.resource.max <= 10 ? accent : `${accent}88`} height={6} segmented={guild.resource.max <= 10} />
        </div>
        <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', gap: 10, marginTop: 4, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1 }}>
          <span>HP {Math.round(state.hp)}/{guild.vitals.HP}</span>
          <span>{guild.resource.name.toUpperCase()} {Math.round(state.res)}/{guild.resource.max}</span>
        </div>
      </div>
    </div>
  );
}

function TimerBadge({ theme, time }) {
  const crit = time <= 10;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>TIME</div>
      <div style={{ fontFamily: theme.fontDisplay, fontSize: 44, color: crit ? theme.bad : theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {String(time).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginTop: 2 }}>ROUND 1/3</div>
    </div>
  );
}

function ComboFloat({ theme, count, left, right, accent }) {
  return (
    <div style={{
      position: 'absolute', top: '38%', ...(left ? { left } : { right }),
      transform: 'translateY(-50%)',
      textAlign: 'center', pointerEvents: 'none',
    }}>
      <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 4 }}>COMBO</div>
      <div style={{ fontFamily: theme.fontDisplay, fontSize: 54, color: accent, lineHeight: 1 }}>×{count}</div>
    </div>
  );
}

function AbilityRack({ theme, guild, cds, side, accent }) {
  return (
    <div style={{ padding: '12px 16px', borderRight: side === 'L' ? `1px solid ${theme.lineSoft}` : 'none', borderLeft: side === 'R' ? `1px solid ${theme.lineSoft}` : 'none' }}>
      <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginBottom: 6, textAlign: side === 'L' ? 'left' : 'right' }}>
        {side === 'L' ? 'P1 · ABILITIES' : 'P2 · ABILITIES'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {[...guild.abilities, { slot: 6, combo: 'K+J', name: guild.rmb.name, cd: 0 }].map((a, i) => {
          const ready = cds[i] === undefined ? true : cds[i] === 0;
          const cdPct = cds[i] && guild.abilities[i] ? (cds[i] / guild.abilities[i].cd) : 0;
          return (
            <div key={i} style={{
              aspectRatio: '1/1',
              position: 'relative', border: `1px solid ${ready ? accent : theme.line}`, background: ready ? `${accent}14` : theme.panel,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 6px',
              overflow: 'hidden',
            }}>
              {cdPct > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${cdPct * 100}%`, background: 'rgba(0,0,0,0.55)', transition: 'height 200ms linear' }} />
              )}
              <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 1, position: 'relative' }}>
                {i < 5 ? String(i + 1) : 'R'}
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 11, color: ready ? theme.ink : theme.inkDim, lineHeight: 1.1, position: 'relative' }}>{a.name}</div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: ready ? accent : theme.warn, position: 'relative', letterSpacing: 1 }}>
                {ready ? (a.combo || '—') : `${cds[i]}s`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BattleLog({ theme, log, onPause }) {
  const ref = React.useRef();
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  return (
    <div style={{ borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column', background: theme.bgDeep }}>
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 3 }}>▸ COMBAT LOG</span>
        <span onClick={onPause} style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, letterSpacing: 2 }}>[ESC] PAUSE</span>
      </div>
      <div ref={ref} style={{ padding: '4px 14px', height: 88, overflow: 'auto', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkDim, lineHeight: 1.5 }}>
        {log.map((l, i) => (
          <div key={i}>
            <span style={{ color: l.t === 'SYS' ? theme.inkMuted : l.t === 'P1' ? theme.accent : theme.bad, marginRight: 6 }}>[{l.t}]</span>
            {l.m}
          </div>
        ))}
      </div>
    </div>
  );
}

// =================================================================
// 07 · PAUSE
// =================================================================
function PauseMenu({ theme, onResume, onRestart, onQuit }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, background: theme.panel, border: `1px solid ${theme.line}`, padding: 36, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 12, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>ESC · RESUME</div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 4, marginBottom: 4 }}>II PAUSED</div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 48, color: theme.ink, letterSpacing: '-0.02em', marginBottom: 28 }}>Hold the line.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'RESUME',     sub: 'return to combat', fn: onResume, primary: true },
            { label: 'RESTART',    sub: 'reset current round', fn: onRestart },
            { label: 'SETTINGS',   sub: 'controls · audio · video' },
            { label: 'MOVE LIST',  sub: 'your guild reference' },
            { label: 'QUIT TO MENU', sub: 'abandon match', fn: onQuit, bad: true },
          ].map((m, i) => (
            <div key={i} onClick={m.fn} style={{ cursor: m.fn ? 'pointer' : 'default', display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${theme.lineSoft}` }}>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted }}>{String(i+1).padStart(2,'0')}</span>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: m.primary ? theme.accent : m.bad ? theme.bad : theme.ink }}>{m.label}</div>
                <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted }}>{m.sub}</div>
              </div>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted }}>→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 08 · RESULTS
// =================================================================
function ResultsScreen({ theme, p1Id, p2Id, winner, onAgain, onMenu }) {
  const g1 = GUILDS.find(g => g.id === p1Id) || GUILDS[0];
  const g2 = GUILDS.find(g => g.id === p2Id) || GUILDS[1];
  const winGuild = winner === 'P1' ? g1 : g2;
  const loseGuild = winner === 'P1' ? g2 : g1;
  const accW = guildAccent(winGuild, theme.id);
  const accL = guildAccent(loseGuild, theme.id);

  const stats = [
    { k: 'DAMAGE DEALT', v: [612, 487] },
    { k: 'DAMAGE TAKEN', v: [487, 612] },
    { k: 'ABILITIES CAST', v: [23, 19] },
    { k: 'MAX COMBO', v: [9, 6] },
    { k: 'CRIT %', v: ['24%', '16%'] },
    { k: 'HEALING', v: [80, 0] },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: theme.paperGrain, pointerEvents: 'none' }} />

      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>MATCH RESULT</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Final tally</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn theme={theme} size="sm" onClick={onMenu}>← MENU</Btn>
          <Btn theme={theme} size="sm" primary onClick={onAgain}>REMATCH →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Winner column */}
        <div style={{ padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: `linear-gradient(180deg, ${accW}14, transparent)` }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: accW, letterSpacing: 6, marginBottom: 10 }}>VICTOR · {winner}</div>
          <GuildMonogram theme={theme} guild={winGuild} size={160} selected />
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 64, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 18 }}>{winGuild.name}</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, fontStyle: 'italic', marginTop: 8, maxWidth: 380 }}>{winGuild.bio}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
            <Chip theme={theme} tone="good" mono>+42 RANKING</Chip>
            <Chip theme={theme} tone="accent" mono>FLAWLESS ROUND 2</Chip>
            <Chip theme={theme} mono>3 KO</Chip>
          </div>
        </div>

        {/* Stats column */}
        <div style={{ padding: 36, borderLeft: `1px solid ${theme.lineSoft}`, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
          <SectionLabel theme={theme} kicker="DETAIL">Match breakdown</SectionLabel>
          {stats.map((s, i) => {
            const [a, b] = s.v;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 1fr 60px', gap: 10, alignItems: 'center' }}>
                <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: accW, textAlign: 'right' }}>{a}</div>
                <div style={{ height: 8, background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`, position: 'relative' }}>
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: typeof a === 'string' ? '60%' : `${Math.min(100, a / 10)}%`, background: accW }} />
                </div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, textAlign: 'center' }}>{s.k}</div>
                <div style={{ height: 8, background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: typeof b === 'string' ? '40%' : `${Math.min(100, b / 10)}%`, background: accL }} />
                </div>
                <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: accL, textAlign: 'left' }}>{b}</div>
              </div>
            );
          })}

          <div style={{ marginTop: 18, padding: 14, border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 6 }}>KILLING BLOW</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: accW }}>{winGuild.abilities[4].name}</div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, marginTop: 4 }}>{winGuild.abilities[4].fx}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BattleHUD, PauseMenu, ResultsScreen });
