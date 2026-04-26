import { useEffect, useMemo } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, MatchStats } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, Btn, Chip, GuildMonogram, SectionLabel } from '../ui';

interface Props {
  p1: GuildId;
  p2: GuildId;
  winner: 'P1' | 'P2';
  score: number;
  matchStats?: MatchStats;
  onRematch: () => void;
  onMenu: () => void;
}

export function ResultsScreen({ p1, p2, winner, score, matchStats, onRematch, onMenu }: Props) {
  const p1Guild = useMemo(() => GUILDS.find((g) => g.id === p1)!, [p1]);
  const p2Guild = useMemo(() => GUILDS.find((g) => g.id === p2)!, [p2]);

  const winGuild = winner === 'P1' ? p1Guild : p2Guild;
  const loseGuild = winner === 'P1' ? p2Guild : p1Guild;
  const winMeta = GUILD_META[winGuild.id];
  const loseMeta = GUILD_META[loseGuild.id];
  const accW = guildAccent(winMeta.hue);
  const accL = guildAccent(loseMeta.hue);

  const stats = useMemo(() => {
    if (matchStats) {
      // Always show p1 left, p2 right — do NOT reorder by winner.
      // The winner banner already indicates who won; swapping columns
      // just makes it look like the winner had zero stats.
      const ms1 = matchStats.p1;
      const ms2 = matchStats.p2;
      const critPct1 = ms1.totalHits > 0 ? Math.min(100, Math.round((ms1.critHits / ms1.totalHits) * 100)) : 0;
      const critPct2 = ms2.totalHits > 0 ? Math.min(100, Math.round((ms2.critHits / ms2.totalHits) * 100)) : 0;
      return [
        { k: 'DAMAGE DEALT', a: Math.round(ms1.damageDealt), b: Math.round(ms2.damageDealt) },
        { k: 'DAMAGE TAKEN', a: Math.round(ms1.damageTaken), b: Math.round(ms2.damageTaken) },
        { k: 'ABILITIES CAST', a: ms1.abilitiesCast, b: ms2.abilitiesCast },
        { k: 'MAX COMBO', a: ms1.maxCombo, b: ms2.maxCombo },
        { k: 'CRIT %', a: `${critPct1}%`, b: `${critPct2}%` },
        { k: 'HEALING', a: Math.round(ms1.healingDone), b: Math.round(ms2.healingDone) },
      ];
    }
    // Fallback for when no real stats are available
    const seed = Math.max(1, score);
    const mix = (n: number) => Math.abs(Math.sin(seed * (n + 1) * 12.9898) * 43758.5453) % 1;
    const dealt = 420 + Math.floor(mix(1) * 320);
    const taken = 320 + Math.floor(mix(2) * 280);
    const abilities = 14 + Math.floor(mix(3) * 16);
    const combo = 4 + Math.floor(mix(4) * 8);
    const critPct = 10 + Math.floor(mix(5) * 28);
    const healing = Math.floor(mix(6) * 120);
    const flip = winner === 'P1';
    return [
      { k: 'DAMAGE DEALT', a: flip ? dealt : taken, b: flip ? taken : dealt },
      { k: 'DAMAGE TAKEN', a: flip ? taken : dealt, b: flip ? dealt : taken },
      { k: 'ABILITIES CAST', a: abilities, b: Math.max(8, abilities - 5) },
      { k: 'MAX COMBO', a: combo, b: Math.max(2, combo - 3) },
      { k: 'CRIT %', a: `${critPct}%`, b: `${Math.max(5, critPct - 8)}%` },
      { k: 'HEALING', a: flip ? healing : 0, b: flip ? 0 : healing },
    ];
  }, [score, winner, matchStats]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onRematch(); }
      else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onMenu(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMenu, onRematch]);

  const kbAbilityId = winner === 'P1'
    ? matchStats?.p2.killingBlowAbilityId   // last ability that hit the loser (p2's hp = the target)
    : matchStats?.p1.killingBlowAbilityId;
  // kbAbilityId tracks the last ability to damage the *winner's* target (the loser actor).
  // Look it up in winner's ability list.
  const killingBlow = kbAbilityId
    ? ([...winGuild.abilities, winGuild.rmb].find(a => a.id === kbAbilityId) ?? null)
    : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '20px 36px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onMenu}>← MENU</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            MATCH RESULT
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, textAlign: 'center' }}>
            Final tally
          </span>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <Btn size="md" primary onClick={onRematch}>REMATCH →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div
          style={{
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 18,
            background: `linear-gradient(180deg, ${accW}18, transparent 70%)`,
            position: 'relative',
          }}
        >
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: accW,
              letterSpacing: 6,
            }}
          >
            VICTOR · {winner}
          </div>
          <GuildMonogram guildId={winGuild.id} size={160} selected />
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 60,
              color: theme.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {winGuild.name}
          </div>
          <div
            style={{
              fontFamily: theme.fontBody,
              fontSize: 13,
              color: theme.inkDim,
              fontStyle: 'italic',
              maxWidth: 440,
              lineHeight: 1.55,
            }}
          >
            {winMeta.bio}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone="good" mono>SCORE · {score.toLocaleString()}</Chip>
            <Chip tone="accent" mono>{winMeta.tag.toUpperCase()}</Chip>
            <Chip mono>VS {loseGuild.name.toUpperCase()}</Chip>
          </div>
        </div>

        <div
          style={{
            padding: 36,
            borderLeft: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <SectionLabel kicker="DETAIL" right={`${winner} WINS`}>
            Match breakdown
          </SectionLabel>

          {/* Column headers: always P1 left, P2 right */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 110px 1fr 60px', gap: 10, alignItems: 'center' }}>
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: winner === 'P1' ? accW : accL, textAlign: 'right', letterSpacing: 2 }}>
              P1{winner === 'P1' ? ' ★' : ''}
            </div>
            <div />
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, textAlign: 'center' }}>
              {p1Guild.name.slice(0, 6).toUpperCase()} VS {p2Guild.name.slice(0, 6).toUpperCase()}
            </div>
            <div />
            <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: winner === 'P2' ? accW : accL, textAlign: 'left', letterSpacing: 2 }}>
              {winner === 'P2' ? '★ ' : ''}P2
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {stats.map((s) => {
              const numA = typeof s.a === 'number' ? s.a : parseFloat(String(s.a));
              const numB = typeof s.b === 'number' ? s.b : parseFloat(String(s.b));
              const max = Math.max(numA, numB, 1);
              return (
                <div
                  key={s.k}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 110px 1fr 60px',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.fontMono,
                      fontSize: 12,
                      color: winner === 'P1' ? accW : accL,
                      textAlign: 'right',
                    }}
                  >
                    {s.a}
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: theme.bgDeep,
                      border: `1px solid ${theme.lineSoft}`,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(numA / max) * 100}%`,
                        background: winner === 'P1' ? accW : accL,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fontMono,
                      fontSize: 9,
                      color: theme.inkMuted,
                      letterSpacing: 2,
                      textAlign: 'center',
                    }}
                  >
                    {s.k}
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: theme.bgDeep,
                      border: `1px solid ${theme.lineSoft}`,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(numB / max) * 100}%`,
                        background: winner === 'P2' ? accW : accL,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fontMono,
                      fontSize: 12,
                      color: winner === 'P2' ? accW : accL,
                      textAlign: 'left',
                    }}
                  >
                    {s.b}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 16,
              border: `1px solid ${theme.lineSoft}`,
              background: theme.panel,
            }}
          >
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 3,
                marginBottom: 6,
              }}
            >
              KILLING BLOW
            </div>
            {killingBlow ? (
              <>
                <div
                  style={{
                    fontFamily: theme.fontDisplay,
                    fontSize: 22,
                    color: accW,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {killingBlow.name}
                </div>
                <div
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 12,
                    color: theme.inkDim,
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {killingBlow.description}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 22,
                  color: theme.inkMuted,
                  letterSpacing: '-0.01em',
                }}
              >
                TIME
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>↵ REMATCH</span>
        <span>ESC MENU</span>
      </div>
    </div>
  );
}
