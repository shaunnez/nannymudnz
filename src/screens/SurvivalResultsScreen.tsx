import { useEffect, useMemo, useState } from 'react';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, GuildMonogram, Btn, SectionLabel } from '../ui';

interface LeaderboardEntry {
  score: number;
  wave: number;
  date: string;
}

interface Props {
  guildId: GuildId;
  score: number;
  wave: number;
  onRetry: () => void;
  onMenu: () => void;
}

const storageKey = (gid: GuildId) => `nannymud-surv-${gid}`;

function loadEntries(gid: GuildId): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(gid));
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch { return []; }
}

function saveEntry(gid: GuildId, entry: LeaderboardEntry): LeaderboardEntry[] {
  const entries = [...loadEntries(gid), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  try { localStorage.setItem(storageKey(gid), JSON.stringify(entries)); } catch { /**/ }
  return entries;
}

export function SurvivalResultsScreen({ guildId, score, wave, onRetry, onMenu }: Props) {
  const guild = GUILDS.find(g => g.id === guildId) ?? GUILDS[0];
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const isNewRecord = useMemo(() => {
    const prev = loadEntries(guildId);
    return prev.length === 0 || score > prev[0].score;
  }, [guildId, score]);

  useEffect(() => {
    setEntries(saveEntry(guildId, { score, wave, date: new Date().toLocaleDateString() }));
  }, [guildId, score, wave]);

  const rank = entries.findIndex(e => e.score === score && e.wave === wave) + 1;
  const maxScore = entries[0]?.score ?? 1;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>GAME OVER · SURVIVAL</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 48, color: theme.bad, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>
            Wave {wave} Reached
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.accent, letterSpacing: 2 }}>
              {score.toLocaleString()} PTS
            </span>
            {isNewRecord && (
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.good, letterSpacing: 2, border: `1px solid ${theme.good}`, padding: '2px 6px' }}>
                ★ NEW RECORD
              </span>
            )}
            {rank > 0 && (
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, border: `1px solid ${theme.lineSoft}`, padding: '2px 6px' }}>
                RANK #{rank}
              </span>
            )}
          </div>
        </div>
        <GuildMonogram guildId={guildId} size={110} selected />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
        <SectionLabel kicker="LOCAL LEADERBOARD" right={guild.name.toUpperCase()}>Best runs</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
          {entries.length === 0 ? (
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2, padding: '16px 0' }}>NO ENTRIES YET</div>
          ) : entries.map((e, i) => {
            const isYou = e.score === score && e.wave === wave && i === rank - 1;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 70px', gap: 12, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, alignItems: 'center', background: isYou ? `${theme.accent}08` : 'transparent' }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: i === 0 ? theme.accent : theme.inkDim }}>{i + 1}</span>
                <div style={{ height: 6, background: theme.line, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(e.score / maxScore) * 100}%`, background: i === 0 ? theme.accent : theme.inkDim }} />
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.ink, textAlign: 'right' }}>{e.score.toLocaleString()}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 1, textAlign: 'right' }}>WV {String(e.wave).padStart(2, '0')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onRetry}>RETRY →</Btn>
      </div>
    </div>
  );
}
