import type { BattleSlot, BattStatEntry } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, Btn, GuildMonogram, SectionLabel, SCANLINE_BG } from '../ui';

interface Props {
  slots: BattleSlot[];
  battStats: Record<string, BattStatEntry> | null;
  playerWon: boolean;
  myActorId?: string;
  onRematch: () => void;
  onMenu: () => void;
}

const TEAM_COLORS: Record<string, string> = {
  A: theme.team1,
  B: theme.team2,
  C: theme.team3,
  D: theme.team4,
};

function computeScore(entry: BattStatEntry): number {
  return Math.round(entry.kills * 500 + entry.dmgDealt * 0.5 - entry.deaths * 200 + entry.healing * 0.3);
}

export function BattleResultsScreen({ slots, battStats, playerWon, myActorId, onRematch, onMenu }: Props) {
  const activeSlots = slots.filter((s) => s.type !== 'off');

  // Map slot index → battStats entry. Human slot is 'player'; CPU slots are 'battle_N'.
  // battStats keys order: player first, then battle_1, battle_2, …
  const statKeys = battStats ? Object.keys(battStats) : [];

  const rows = activeSlots.map((slot, i) => {
    const actorId = i === 0 ? 'player' : (statKeys.filter((k) => k !== 'player')[i - 1] ?? `battle_${i}`);
    const entry: BattStatEntry = battStats?.[actorId] ?? { kills: 0, deaths: 0, dmgDealt: 0, healing: 0 };
    const guild = GUILDS.find((g) => g.id === slot.guildId) ?? GUILDS[0];
    const score = computeScore(entry);
    // isMe: if myActorId provided (MP), only that actor is "you"; otherwise fall
    // back to the SP convention where the single human slot is the player.
    const isMe = myActorId != null ? actorId === myActorId : slot.type === 'human';
    return { slot, guild, entry, score, isMe };
  }).sort((a, b) => b.score - a.score);

  const winner = rows[0];
  const maxScore = Math.max(1, rows[0]?.score ?? 1);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: SCANLINE_BG, pointerEvents: 'none' }} />

      {/* Winner banner */}
      <div style={{ padding: '24px 36px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>RESULTS · BATTLE</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 56, color: theme.accent, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 4 }}>
            {winner?.isMe ? (playerWon ? 'You win' : 'You lose') : `${winner?.guild.name} wins`}
          </div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, marginTop: 6 }}>
            {activeSlots.length} fighters
          </div>
        </div>
        {winner && (
          <GuildMonogram guildId={winner.guild.id} size={80} selected />
        )}
      </div>

      {/* Scoreboard */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 36px' }}>
        <SectionLabel kicker="SCOREBOARD" right="SORTED BY SCORE">Final tally</SectionLabel>
        <div style={{ marginTop: 10 }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 36px 1.4fr 60px 48px 48px 72px 72px 1fr',
            gap: 12, padding: '8px 0',
            borderBottom: `1px solid ${theme.line}`,
            fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2,
          }}>
            <span>#</span><span></span><span>FIGHTER</span><span>TEAM</span>
            <span>K</span><span>D</span><span>DMG</span><span>HEAL</span><span>SCORE</span>
          </div>

          {rows.map((r, i) => {
            const teamColor = r.slot.team ? TEAM_COLORS[r.slot.team] : theme.inkDim;
            const isWinner = i === 0;
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '28px 36px 1.4fr 60px 48px 48px 72px 72px 1fr',
                gap: 12, padding: '8px 0',
                borderBottom: `1px solid ${theme.lineSoft}`,
                alignItems: 'center',
                background: r.isMe ? `${theme.accent}08` : 'transparent',
              }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: isWinner ? theme.accent : theme.inkDim }}>
                  {i + 1}
                </span>
                <GuildMonogram guildId={r.guild.id} size={32} selected={isWinner} />
                <div>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: isWinner ? theme.accent : theme.ink }}>
                    {r.isMe ? 'You' : r.guild.name}
                  </div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkDim, letterSpacing: 1 }}>
                    {r.guild.name.toUpperCase()}
                  </div>
                </div>
                <div>
                  {r.slot.team ? (
                    <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: teamColor, letterSpacing: 1, padding: '2px 5px', border: `1px solid ${teamColor}` }}>
                      T{r.slot.team}
                    </span>
                  ) : (
                    <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1 }}>SOLO</span>
                  )}
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.ink }}>{r.entry.kills}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.inkDim }}>{r.entry.deaths}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.inkDim }}>{Math.round(r.entry.dmgDealt)}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.good }}>{Math.round(r.entry.healing)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 5, background: theme.line, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${(r.score / maxScore) * 100}%`, background: isWinner ? theme.accent : theme.inkDim }} />
                  </div>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: isWinner ? theme.accent : theme.ink, minWidth: 36, textAlign: 'right' }}>
                    {r.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onRematch}>REMATCH →</Btn>
      </div>
    </div>
  );
}
