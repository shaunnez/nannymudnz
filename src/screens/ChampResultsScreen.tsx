import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState } from '../state/championship';
import { theme, GuildMonogram, Btn, SectionLabel } from '../ui';

const ROUND_NAMES = ['Quarter-Final', 'Semi-Final', 'Final'];

interface Props {
  champ: ChampionshipState;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export function ChampResultsScreen({ champ, onPlayAgain, onMenu }: Props) {
  const playerWon = !champ.playerEliminated;
  const playerGuild = GUILDS.find(g => g.id === champ.playerGuildId) ?? GUILDS[0];
  const finalChampion = champ.rounds[2]?.matches[0]?.winner;
  const championGuild = finalChampion ? (GUILDS.find(g => g.id === finalChampion) ?? GUILDS[0]) : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Banner */}
      <div style={{ padding: '32px 36px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 30, alignItems: 'center' }}>
        <div>
          {playerWon ? (
            <>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 4 }}>CHAMPIONSHIP · VICTORY</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 72, color: theme.accent, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6 }}>CHAMPION</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, marginTop: 8 }}>
                {playerGuild.name} has conquered all challengers.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.bad, letterSpacing: 4 }}>CHAMPIONSHIP · ELIMINATED</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 48, color: theme.bad, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 6 }}>
                Fell in {ROUND_NAMES[champ.matchHistory[champ.matchHistory.length - 1]?.round ?? 0]}
              </div>
              {championGuild && (
                <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, marginTop: 8 }}>
                  {championGuild.name} went on to claim the Championship.
                </div>
              )}
            </>
          )}
        </div>
        <GuildMonogram
          guildId={playerWon ? champ.playerGuildId : (finalChampion ?? champ.playerGuildId)}
          size={110}
          selected
        />
      </div>

      {/* Match history */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
        <SectionLabel kicker="MATCH HISTORY">Your fights</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {champ.matchHistory.length === 0 ? (
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2, padding: '16px 0' }}>NO FIGHTS RECORDED</div>
          ) : champ.matchHistory.map((h, i) => {
            const oppGuild = GUILDS.find(g => g.id === h.opponentGuildId) ?? GUILDS[0];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 14, alignItems: 'center', padding: '14px 16px', border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>{(ROUND_NAMES[h.round] ?? 'ROUND').toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <GuildMonogram guildId={oppGuild.id} size={36} selected={false} />
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink }}>vs {oppGuild.name}</div>
                </div>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: h.playerWon ? theme.accent : theme.bad }}>
                  {h.playerWon ? 'WIN' : 'LOSS'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onPlayAgain}>{playerWon ? 'PLAY AGAIN' : 'TRY AGAIN'} →</Btn>
      </div>
    </div>
  );
}
