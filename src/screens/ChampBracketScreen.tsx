import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState, BracketMatch } from '../state/championship';
import { getOpponent } from '../state/championship';
import { theme, GuildMonogram, Btn } from '../ui';

const ROUND_LABELS = ['QUARTER-FINALS', 'SEMI-FINALS', 'FINAL'];

interface Props {
  champ: ChampionshipState;
  onFight: () => void;
  onQuit: () => void;
}

function GuildSlot({ guildId, lost }: { guildId: GuildId; lost?: boolean }) {
  const guild = GUILDS.find(g => g.id === guildId) ?? GUILDS[0];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: lost ? 0.4 : 1,
        padding: '6px 10px',
        borderBottom: `1px solid ${theme.lineSoft}`,
      }}
    >
      <GuildMonogram guildId={guildId} size={28} selected={!lost} />
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: 13,
          color: lost ? theme.inkMuted : theme.ink,
          textDecoration: lost ? 'line-through' : 'none',
        }}
      >
        {guild.name}
      </div>
      {lost && (
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.bad,
            letterSpacing: 2,
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}

interface MatchCardProps {
  match: BracketMatch;
  playerGuildId: GuildId;
  isCurrentPlayerMatch: boolean;
}

function MatchCard({ match, isCurrentPlayerMatch }: MatchCardProps) {
  const p1Lost = match.winner !== null && match.winner !== match.p1;
  const p2Lost = match.winner !== null && match.winner !== match.p2;
  const isUnrevealed = match.winner === null && !isCurrentPlayerMatch;

  return (
    <div
      style={{
        border: `1px solid ${isCurrentPlayerMatch ? theme.accent : theme.lineSoft}`,
        background: theme.panel,
        minWidth: 170,
      }}
    >
      {isUnrevealed ? (
        <div
          style={{
            padding: '18px 10px',
            textAlign: 'center',
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.inkMuted,
            letterSpacing: 2,
          }}
        >
          ???
        </div>
      ) : (
        <>
          <GuildSlot guildId={match.p1} lost={p1Lost} />
          <div style={{ height: 1, background: theme.line }} />
          <GuildSlot guildId={match.p2} lost={p2Lost} />
        </>
      )}
    </div>
  );
}

export function ChampBracketScreen({ champ, onFight, onQuit }: Props) {
  const roundLabel = ROUND_LABELS[champ.currentRound] ?? 'FINAL';
  const opponent = getOpponent(champ);
  const oppGuild = GUILDS.find(g => g.id === opponent) ?? GUILDS[0];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 36px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <div>
          <Btn onClick={onQuit}>← QUIT</Btn>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            CHAMPIONSHIP · {roundLabel}
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>The bracket</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn primary onClick={onFight}>FIGHT →</Btn>
        </div>
      </div>

      {/* Bracket tree */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          overflow: 'auto',
          padding: '28px 36px',
          gap: 0,
        }}
      >
        {[0, 1, 2].map(roundIdx => {
          const round = champ.rounds[roundIdx];
          const label = ROUND_LABELS[roundIdx];
          const isCurrentRound = roundIdx === champ.currentRound;
          return (
            <div
              key={roundIdx}
              style={{
                borderRight: roundIdx < 2 ? `1px solid ${theme.lineSoft}` : 'none',
                paddingRight: 16,
                paddingLeft: roundIdx > 0 ? 16 : 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 9,
                  color: isCurrentRound ? theme.accent : theme.inkMuted,
                  letterSpacing: 3,
                  marginBottom: 8,
                }}
              >
                {label}
              </div>
              {round.matches.length === 0 ? (
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, padding: '16px 0' }}>
                  TBD
                </div>
              ) : (
                round.matches.map((m, mi) => {
                  const isPlayerMatch = m.p1 === champ.playerGuildId || m.p2 === champ.playerGuildId;
                  const isCurrent = isCurrentRound && isPlayerMatch;
                  return (
                    <div key={mi} style={{ marginBottom: 16 }}>
                      <MatchCard match={m} playerGuildId={champ.playerGuildId} isCurrentPlayerMatch={isCurrent} />
                      {isCurrent && (
                        <div
                          style={{
                            marginTop: 6,
                            fontFamily: theme.fontMono,
                            fontSize: 9,
                            color: theme.accent,
                            letterSpacing: 2,
                          }}
                        >
                          ▸ YOUR MATCH · vs {oppGuild.name.toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}

        {/* CHAMPION column */}
        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>
            CHAMPION
          </div>
          {(() => {
            const champion = champ.rounds[2]?.matches[0]?.winner;
            if (!champion) {
              return (
                <div
                  style={{
                    border: `1px dashed ${theme.lineSoft}`,
                    padding: '22px 10px',
                    textAlign: 'center',
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: theme.inkMuted,
                    letterSpacing: 2,
                  }}
                >
                  ???
                </div>
              );
            }
            return (
              <div
                style={{
                  border: `1px solid ${theme.accent}`,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <GuildMonogram guildId={champion} size={52} selected />
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.accent }}>
                  {GUILDS.find(g => g.id === champion)?.name}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
