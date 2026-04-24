import { useEffect, useState } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState } from '../state/championship';
import { theme, GuildMonogram, Btn } from '../ui';

const ROUND_NAMES = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
const NEXT_ROUND_NAMES = ['SEMI-FINALS', 'FINAL', '—'];

interface Props {
  champ: ChampionshipState;
  prevRound: 0 | 1 | 2;
  playerWon: boolean;
  onAdvance: () => void;
  onResults: () => void;
}

export function ChampTransitionScreen({ champ, prevRound, playerWon, onAdvance, onResults }: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const roundName = ROUND_NAMES[prevRound] ?? 'ROUND';
  const nextRoundName = NEXT_ROUND_NAMES[prevRound];
  const prevRoundData = champ.rounds[prevRound];
  const isEliminated = champ.playerEliminated;
  const isFinalWin = !isEliminated && prevRound === 2;

  const finalChampion = champ.rounds[2]?.matches[0]?.winner;
  const championGuild = finalChampion ? GUILDS.find(g => g.id === finalChampion) : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 48 }}>
      {/* Result banner */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>{roundName} RESULT</div>
        <div style={{
          fontFamily: theme.fontDisplay, fontSize: 72, lineHeight: 1, letterSpacing: '-0.03em',
          color: playerWon ? theme.accent : theme.bad, marginTop: 6,
        }}>
          {playerWon ? 'WIN' : 'ELIMINATED'}
        </div>
      </div>

      {/* Other match results (revealed with delay) */}
      {revealed && prevRoundData?.matches && prevRoundData.matches.length > 0 && (
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginBottom: 10 }}>{roundName} · ALL RESULTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prevRoundData.matches.map((m, i) => {
              const winner = m.winner;
              const loser = winner === m.p1 ? m.p2 : m.p1;
              const wg = winner ? GUILDS.find(g => g.id === winner) : null;
              const lg = GUILDS.find(g => g.id === loser);
              const isPlayerMatch = m.p1 === champ.playerGuildId || m.p2 === champ.playerGuildId;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${isPlayerMatch ? theme.accent : theme.lineSoft}`, background: theme.panel }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {winner && <GuildMonogram guildId={winner} size={28} selected />}
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: theme.accent }}>{wg?.name}</span>
                  </div>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>WINS</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: theme.inkMuted, textDecoration: 'line-through' }}>{lg?.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status line */}
      {revealed && !isEliminated && !isFinalWin && (
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 3 }}>
          {roundName} COMPLETE · ADVANCING TO {nextRoundName}
        </div>
      )}
      {revealed && isEliminated && championGuild && (
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2 }}>
          {championGuild.name.toUpperCase()} CLAIMED THE CHAMPIONSHIP
        </div>
      )}

      {/* CTA */}
      {revealed && (
        <div style={{ display: 'flex', gap: 10 }}>
          {isEliminated || isFinalWin ? (
            <Btn primary onClick={onResults}>VIEW RESULTS →</Btn>
          ) : (
            <Btn primary onClick={onAdvance}>ADVANCE TO {nextRoundName} →</Btn>
          )}
        </div>
      )}
    </div>
  );
}
