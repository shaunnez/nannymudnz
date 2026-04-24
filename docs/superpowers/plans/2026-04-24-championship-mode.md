# Championship Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Championship mode — an 8-guild single-elimination bracket where the player fights three rounds (QF, SF, Final) using the existing VS sim, while other matchups are instantly auto-simulated by stat comparison.

**Architecture:** A new `src/state/championship.ts` module owns all bracket types and pure helper functions (`initChampionship`, `advanceBracket`, `simulateCpuMatch`). Championship state lives in `AppState` and drives three new screens: `ChampBracketScreen` (tree visualisation), `ChampTransitionScreen` (post-round reveal), and `ChampResultsScreen` (victory/elimination). Player fights reuse the existing VS (`SimMode='vs'`, BO1) flow with no sim changes.

**Tech Stack:** TypeScript, React, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/state/championship.ts` | Create | All championship types + pure helpers |
| `src/state/useAppState.ts` | Modify | `ChampionshipState` field; `'champbracket'`, `'champtransition'`, `'champresults'` screens |
| `src/screens/ChampBracketScreen.tsx` | Create | Tournament bracket tree + FIGHT CTA |
| `src/screens/ChampTransitionScreen.tsx` | Create | Post-round result reveal + bracket advance |
| `src/screens/ChampResultsScreen.tsx` | Create | Victory banner or elimination screen |
| `src/App.tsx` | Modify | Route new screens; BO1 VS fight setup; advance bracket on fight end |
| `src/screens/MainMenu.tsx` | Modify | Enable `champ` item |

---

## Task 1: championship.ts — types and pure helpers

**Files:**
- Create: `src/state/championship.ts`
- Create: `src/state/__tests__/championship.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/state/__tests__/championship.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  initChampionship, advanceBracket, simulateCpuMatch,
  getPlayerMatch, getOpponent,
} from '../championship';
import type { ChampionshipState } from '../championship';

describe('initChampionship', () => {
  it('creates 8 participants including the player guild', () => {
    const s = initChampionship('adventurer', 42);
    expect(s.participants.length).toBe(8);
    expect(s.participants).toContain('adventurer');
  });

  it('creates QF round with 4 matches', () => {
    const s = initChampionship('adventurer', 42);
    expect(s.rounds.length).toBe(3);
    expect(s.rounds[0].matches.length).toBe(4);
  });

  it('player guild appears in exactly one QF match', () => {
    const s = initChampionship('adventurer', 42);
    const playerMatches = s.rounds[0].matches.filter(
      m => m.p1 === 'adventurer' || m.p2 === 'adventurer',
    );
    expect(playerMatches.length).toBe(1);
  });

  it('non-player QF matches have a winner set immediately', () => {
    const s = initChampionship('adventurer', 42);
    const nonPlayer = s.rounds[0].matches.filter(
      m => m.p1 !== 'adventurer' && m.p2 !== 'adventurer',
    );
    nonPlayer.forEach(m => expect(m.winner).not.toBeNull());
  });

  it('player match starts with winner null', () => {
    const s = initChampionship('adventurer', 42);
    const pm = getPlayerMatch(s);
    expect(pm.winner).toBeNull();
  });

  it('getOpponent returns the non-player guild in the player match', () => {
    const s = initChampionship('knight', 42);
    const opp = getOpponent(s);
    expect(opp).not.toBe('knight');
    expect(typeof opp).toBe('string');
  });
});

describe('simulateCpuMatch', () => {
  it('returns one of the two guild ids', () => {
    const rng = () => 0.3;
    const result = simulateCpuMatch('adventurer', 'knight', rng);
    expect(['adventurer', 'knight']).toContain(result);
  });

  it('is deterministic for the same rng output', () => {
    const rng = () => 0.5;
    const r1 = simulateCpuMatch('adventurer', 'knight', rng);
    const r2 = simulateCpuMatch('adventurer', 'knight', rng);
    expect(r1).toBe(r2);
  });
});

describe('advanceBracket', () => {
  it('sets player match winner on win', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    const pm = getPlayerMatch(s);
    expect(pm.winner).toBe('adventurer');
  });

  it('increments currentRound after player win', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    expect(s.currentRound).toBe(1);
  });

  it('sets playerEliminated on loss', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, false);
    expect(s.playerEliminated).toBe(true);
  });

  it('builds SF round from QF winners', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    expect(s.rounds[1].matches.length).toBe(2);
    s.rounds[1].matches.forEach(m => {
      expect(m.p1).toBeDefined();
      expect(m.p2).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- championship
```

Expected: FAIL — `Cannot find module '../championship'`

- [ ] **Step 3: Implement championship.ts**

Create `src/state/championship.ts`:

```typescript
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BracketMatch {
  p1: GuildId;
  p2: GuildId;
  winner: GuildId | null; // null = not yet played
}

export interface BracketRound {
  matches: BracketMatch[];
}

export interface ChampMatchResult {
  round: 0 | 1 | 2;
  opponentGuildId: GuildId;
  playerWon: boolean;
}

export interface ChampionshipState {
  playerGuildId: GuildId;
  participants: GuildId[];         // 8 guilds, index order defines bracket position
  rounds: BracketRound[];          // length 3: [QF(4m), SF(2m), Final(1m)]
  currentRound: 0 | 1 | 2;
  playerEliminated: boolean;
  matchHistory: ChampMatchResult[];
  seed: number;                    // used by mulberry32 for reproducibility
}

// ── Seeded PRNG ────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Auto-simulation ────────────────────────────────────────────────────────

function statScore(guildId: GuildId): number {
  const g = GUILDS.find(x => x.id === guildId);
  if (!g) return 0;
  const abilityDmg = g.abilities.reduce((sum: number, a) => sum + (a.baseDamage ?? 0), 0);
  return g.hpMax + g.armor + g.magicResist + g.moveSpeed * 10 + abilityDmg;
}

export function simulateCpuMatch(
  p1: GuildId,
  p2: GuildId,
  rng: () => number,
): GuildId {
  const s1 = statScore(p1);
  const s2 = statScore(p2);
  const p1WinChance = s1 / (s1 + s2);
  return rng() < p1WinChance ? p1 : p2;
}

// ── Bracket helpers ────────────────────────────────────────────────────────

/** Pairs up 8 guilds into 4 QF matches: (0v1), (2v3), (4v5), (6v7). */
function buildQfMatches(participants: GuildId[]): BracketMatch[] {
  return [
    { p1: participants[0], p2: participants[1], winner: null },
    { p1: participants[2], p2: participants[3], winner: null },
    { p1: participants[4], p2: participants[5], winner: null },
    { p1: participants[6], p2: participants[7], winner: null },
  ];
}

/** Builds next round's matches from winners of the previous round. */
function buildNextRoundMatches(prevRound: BracketRound): BracketMatch[] {
  const winners = prevRound.matches.map(m => m.winner!);
  const matches: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({ p1: winners[i], p2: winners[i + 1], winner: null });
  }
  return matches;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Creates a new championship starting with the given player guild.
 * Seed should be Date.now() at call time (AppState level — not inside sim).
 */
export function initChampionship(playerGuildId: GuildId, seed: number): ChampionshipState {
  const rng = mulberry32(seed);

  // Pick 7 CPU guilds from the remaining 14, shuffle
  const pool = GUILDS.map(g => g.id).filter(id => id !== playerGuildId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cpuGuilds = pool.slice(0, 7);

  // Seed player into a random bracket position
  const playerPos = Math.floor(rng() * 8);
  const allGuilds: GuildId[] = [];
  let cpuIdx = 0;
  for (let i = 0; i < 8; i++) {
    allGuilds.push(i === playerPos ? playerGuildId : cpuGuilds[cpuIdx++]);
  }

  // Build QF round and auto-sim non-player matches
  const qfMatches = buildQfMatches(allGuilds);
  qfMatches.forEach(m => {
    const hasPlayer = m.p1 === playerGuildId || m.p2 === playerGuildId;
    if (!hasPlayer) {
      m.winner = simulateCpuMatch(m.p1, m.p2, rng);
    }
  });

  return {
    playerGuildId,
    participants: allGuilds,
    rounds: [
      { matches: qfMatches },
      { matches: [] }, // built after QF
      { matches: [] }, // built after SF
    ],
    currentRound: 0,
    playerEliminated: false,
    matchHistory: [],
    seed,
  };
}

export function getPlayerMatch(state: ChampionshipState): BracketMatch {
  const round = state.rounds[state.currentRound];
  return round.matches.find(
    m => m.p1 === state.playerGuildId || m.p2 === state.playerGuildId,
  )!;
}

export function getOpponent(state: ChampionshipState): GuildId {
  const match = getPlayerMatch(state);
  return match.p1 === state.playerGuildId ? match.p2 : match.p1;
}

/**
 * Called after the player's fight ends.
 * Sets the player match winner, auto-sims remaining round matches,
 * builds the next round, advances currentRound.
 */
export function advanceBracket(
  state: ChampionshipState,
  playerWon: boolean,
): ChampionshipState {
  const rng = mulberry32(state.seed + state.currentRound * 1000);
  const next: ChampionshipState = {
    ...state,
    rounds: state.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })),
    matchHistory: [...state.matchHistory],
  };

  // Resolve player match
  const pm = getPlayerMatch(next);
  pm.winner = playerWon ? next.playerGuildId : getOpponent(next);

  // Record history
  next.matchHistory.push({
    round: next.currentRound as 0 | 1 | 2,
    opponentGuildId: getOpponent({ ...state, rounds: next.rounds }),
    playerWon,
  });

  if (!playerWon) {
    next.playerEliminated = true;
    // Auto-sim remaining rounds so the bracket is fully resolved
    for (let r = next.currentRound; r < 3; r++) {
      const round = next.rounds[r];
      round.matches.forEach(m => {
        if (m.winner === null) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
      });
      if (r < 2) {
        next.rounds[r + 1].matches = buildNextRoundMatches(round);
        next.rounds[r + 1].matches.forEach(m => {
          m.winner = simulateCpuMatch(m.p1, m.p2, rng);
        });
      }
    }
    return next;
  }

  // Auto-sim remaining matches in this round
  const currentRound = next.rounds[next.currentRound];
  currentRound.matches.forEach(m => {
    if (m.winner === null) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
  });

  // Build next round
  const nextRoundIndex = next.currentRound + 1;
  if (nextRoundIndex < 3) {
    next.rounds[nextRoundIndex].matches = buildNextRoundMatches(currentRound);
    // Auto-sim non-player matches in the next round immediately
    const playerInNext = next.rounds[nextRoundIndex].matches.some(
      m => m.p1 === next.playerGuildId || m.p2 === next.playerGuildId,
    );
    if (playerInNext) {
      next.rounds[nextRoundIndex].matches.forEach(m => {
        const hasPlayer = m.p1 === next.playerGuildId || m.p2 === next.playerGuildId;
        if (!hasPlayer) m.winner = simulateCpuMatch(m.p1, m.p2, rng);
      });
    }
  }

  next.currentRound = (next.currentRound + 1) as 0 | 1 | 2;
  return next;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- championship
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/championship.ts src/state/__tests__/championship.test.ts
git commit -m "feat(champ): championship.ts — types + initChampionship + advanceBracket + simulateCpuMatch"
```

---

## Task 2: AppState — new screens + championshipState field

**Files:**
- Modify: `src/state/useAppState.ts`

- [ ] **Step 1: Update AppState**

In `src/state/useAppState.ts`:

```typescript
import type { ChampionshipState } from './championship';

export type AppScreen =
  | 'title' | 'menu' | 'charselect' | 'team' | 'stage' | 'game'
  | 'pause' | 'results' | 'moves' | 'guild_dossier' | 'settings'
  | 'mp_hub' | 'mp_lobby' | 'mp_cs' | 'mp_stage' | 'mp_load' | 'mp_battle' | 'mp_results'
  | 'survresults' | 'battleconfig' | 'battresults'
  | 'champbracket' | 'champtransition' | 'champresults';

export interface AppState {
  // ... existing fields ...
  championshipState: ChampionshipState | null;
}

const DEFAULT_STATE: AppState = {
  // ... existing ...
  championshipState: null,
};
```

Do NOT add `championshipState` to `PERSISTED_KEYS` — it is session-only state that clears on refresh.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/useAppState.ts
git commit -m "feat(state): add championshipState + champbracket/champtransition/champresults screens"
```

---

## Task 3: ChampBracketScreen

**Files:**
- Create: `src/screens/ChampBracketScreen.tsx`

- [ ] **Step 1: Create ChampBracketScreen**

Create `src/screens/ChampBracketScreen.tsx`:

```typescript
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState, BracketMatch } from '../state/championship';
import { getPlayerMatch, getOpponent } from '../state/championship';
import { theme, GuildMonogram, Btn } from '../ui';
import { GUILD_META } from '../data/guildMeta';

const ROUND_LABELS = ['QUARTER-FINALS', 'SEMI-FINALS', 'FINAL'];

interface Props {
  champ: ChampionshipState;
  onFight: () => void;
  onQuit: () => void;
}

interface MatchCardProps {
  match: BracketMatch;
  playerGuildId: GuildId;
  isCurrentPlayerMatch: boolean;
}

function GuildSlot({ guildId, lost }: { guildId: GuildId; lost?: boolean }) {
  const guild = GUILDS.find(g => g.id === guildId) ?? GUILDS[0];
  const meta = GUILD_META[guildId];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: lost ? 0.4 : 1, padding: '6px 10px', borderBottom: `1px solid ${theme.lineSoft}` }}>
      <GuildMonogram guild={guild} meta={meta} size={32} selected={!lost} />
      <div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: lost ? theme.inkMuted : theme.ink, textDecoration: lost ? 'line-through' : 'none' }}>
          {guild.name}
        </div>
      </div>
      {lost && <span style={{ marginLeft: 'auto', fontFamily: theme.fontMono, fontSize: 9, color: theme.bad, letterSpacing: 2 }}>×</span>}
    </div>
  );
}

function MatchCard({ match, playerGuildId, isCurrentPlayerMatch }: MatchCardProps) {
  const p1Lost = match.winner !== null && match.winner !== match.p1;
  const p2Lost = match.winner !== null && match.winner !== match.p2;
  const isUnrevealed = match.winner === null && !isCurrentPlayerMatch;

  return (
    <div style={{ border: `1px solid ${isCurrentPlayerMatch ? theme.accent : theme.lineSoft}`, background: theme.panel, minWidth: 180 }}>
      {isUnrevealed ? (
        <div style={{ padding: '20px 10px', textAlign: 'center', fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2 }}>???</div>
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
  const playerMatch = getPlayerMatch(champ);
  const opponent = getOpponent(champ);
  const oppGuild = GUILDS.find(g => g.id === opponent) ?? GUILDS[0];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>CHAMPIONSHIP · {roundLabel}</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>The bracket</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onQuit}>← QUIT</Btn>
          <Btn primary onClick={onFight}>FIGHT →</Btn>
        </div>
      </div>

      {/* Bracket tree */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, overflow: 'auto', padding: '32px 36px' }}>
        {[0, 1, 2].map(roundIdx => {
          const round = champ.rounds[roundIdx];
          const label = ROUND_LABELS[roundIdx];
          const isCurrentRound = roundIdx === champ.currentRound;
          return (
            <div key={roundIdx} style={{ borderRight: roundIdx < 2 ? `1px solid ${theme.lineSoft}` : 'none', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: isCurrentRound ? theme.accent : theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>
                {label}
              </div>
              {round.matches.length === 0 ? (
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, padding: '20px 0' }}>TBD</div>
              ) : round.matches.map((m, mi) => {
                const isPlayerMatch = m.p1 === champ.playerGuildId || m.p2 === champ.playerGuildId;
                const isCurrent = isCurrentRound && isPlayerMatch;
                return (
                  <div key={mi} style={{ marginBottom: 20 }}>
                    <MatchCard match={m} playerGuildId={champ.playerGuildId} isCurrentPlayerMatch={isCurrent} />
                    {isCurrent && (
                      <div style={{ marginTop: 8, fontFamily: theme.fontMono, fontSize: 9, color: theme.accent, letterSpacing: 2 }}>
                        ▸ YOUR MATCH · vs {oppGuild.name.toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* CHAMPION column */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>CHAMPION</div>
          {(() => {
            const final = champ.rounds[2];
            const champion = final.matches[0]?.winner;
            if (!champion) {
              return <div style={{ border: `1px dashed ${theme.lineSoft}`, padding: '24px 10px', textAlign: 'center', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>???</div>;
            }
            const cg = GUILDS.find(g => g.id === champion) ?? GUILDS[0];
            const cm = GUILD_META[champion];
            return (
              <div style={{ border: `1px solid ${theme.accent}`, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <GuildMonogram guild={cg} meta={cm} size={56} selected />
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.accent }}>{cg.name}</div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/ChampBracketScreen.tsx
git commit -m "feat(ui): ChampBracketScreen tournament tree"
```

---

## Task 4: ChampTransitionScreen

**Files:**
- Create: `src/screens/ChampTransitionScreen.tsx`

- [ ] **Step 1: Create ChampTransitionScreen**

Create `src/screens/ChampTransitionScreen.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState } from '../state/championship';
import { theme, GuildMonogram, Btn } from '../ui';
import { GUILD_META } from '../data/guildMeta';

const ROUND_NAMES = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
const NEXT_ROUND_NAMES = ['SEMI-FINALS', 'FINAL', '—'];

interface Props {
  champ: ChampionshipState;
  /** The champ state BEFORE advanceBracket was called (for showing the result). */
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

  // Find the final champion if eliminated or won
  const finalMatch = champ.rounds[2].matches[0];
  const champion = finalMatch?.winner;
  const championGuild = champion ? GUILDS.find(g => g.id === champion) : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 48, position: 'relative' }}>
      {/* Result banner */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>{roundName} RESULT</div>
        <div style={{
          fontFamily: theme.fontDisplay, fontSize: 80, lineHeight: 1, letterSpacing: '-0.03em',
          color: playerWon ? theme.accent : theme.bad,
          marginTop: 8,
        }}>
          {playerWon ? 'WIN' : 'ELIMINATED'}
        </div>
      </div>

      {/* Other match results (revealed with delay) */}
      {revealed && prevRoundData.matches.length > 0 && (
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3, marginBottom: 12 }}>{roundName} · ALL RESULTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prevRoundData.matches.map((m, i) => {
              const winner = m.winner;
              const loser = winner === m.p1 ? m.p2 : m.p1;
              const wg = GUILDS.find(g => g.id === winner);
              const lg = GUILDS.find(g => g.id === loser);
              const wm = winner ? GUILD_META[winner] : undefined;
              const isPlayerMatch = m.p1 === champ.playerGuildId || m.p2 === champ.playerGuildId;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, padding: '10px 16px', border: `1px solid ${isPlayerMatch ? theme.accent : theme.lineSoft}`, background: theme.panel }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {wg && wm && <GuildMonogram guild={wg} meta={wm} size={32} selected />}
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.accent }}>{wg?.name}</span>
                  </div>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>WINS</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.inkMuted, textDecoration: 'line-through' }}>{lg?.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary line */}
      {revealed && !isEliminated && !isFinalWin && (
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 3 }}>
          {roundName} COMPLETE · ADVANCING TO {nextRoundName}
        </div>
      )}
      {revealed && isEliminated && championGuild && (
        <div style={{ textAlign: 'center', fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2 }}>
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/ChampTransitionScreen.tsx
git commit -m "feat(ui): ChampTransitionScreen post-round reveal"
```

---

## Task 5: ChampResultsScreen

**Files:**
- Create: `src/screens/ChampResultsScreen.tsx`

- [ ] **Step 1: Create ChampResultsScreen**

Create `src/screens/ChampResultsScreen.tsx`:

```typescript
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { ChampionshipState } from '../state/championship';
import { theme, GuildMonogram, Btn, SectionLabel } from '../ui';
import { GUILD_META } from '../data/guildMeta';

const ROUND_NAMES = ['Quarter-Final', 'Semi-Final', 'Final'];

interface Props {
  champ: ChampionshipState;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export function ChampResultsScreen({ champ, onPlayAgain, onMenu }: Props) {
  const playerWon = !champ.playerEliminated;
  const playerGuild = GUILDS.find(g => g.id === champ.playerGuildId) ?? GUILDS[0];
  const playerMeta = GUILD_META[champ.playerGuildId];

  const finalMatch = champ.rounds[2].matches[0];
  const champion = finalMatch?.winner;
  const championGuild = champion ? (GUILDS.find(g => g.id === champion) ?? GUILDS[0]) : null;
  const championMeta = champion ? GUILD_META[champion] : undefined;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Banner */}
      <div style={{ padding: '32px 36px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 30, alignItems: 'center' }}>
        <div>
          {playerWon ? (
            <>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 4 }}>CHAMPIONSHIP · VICTORY</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 80, color: theme.accent, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6 }}>CHAMPION</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, marginTop: 8 }}>
                {playerGuild.name} has conquered all challengers.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.bad, letterSpacing: 4 }}>CHAMPIONSHIP · ELIMINATED</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 52, color: theme.bad, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 6 }}>
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

        {playerWon ? (
          <GuildMonogram guild={playerGuild} meta={playerMeta} size={120} selected />
        ) : (
          championGuild && championMeta && (
            <GuildMonogram guild={championGuild} meta={championMeta} size={90} selected />
          )
        )}
      </div>

      {/* Match history */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
        <SectionLabel kicker="MATCH HISTORY">Your fights</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {champ.matchHistory.map((h, i) => {
            const oppGuild = GUILDS.find(g => g.id === h.opponentGuildId) ?? GUILDS[0];
            const oppMeta = GUILD_META[h.opponentGuildId];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 16, alignItems: 'center', padding: '14px 16px', border: `1px solid ${theme.lineSoft}`, background: theme.panel }}>
                <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>{ROUND_NAMES[h.round]?.toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <GuildMonogram guild={oppGuild} meta={oppMeta} size={40} selected={false} />
                  <div>
                    <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink }}>vs {oppGuild.name}</div>
                  </div>
                </div>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 20, color: h.playerWon ? theme.accent : theme.bad, letterSpacing: '0.02em' }}>
                  {h.playerWon ? 'WIN' : 'LOSS'}
                </span>
              </div>
            );
          })}
          {champ.matchHistory.length === 0 && (
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2, padding: '16px 0' }}>NO FIGHTS RECORDED</div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onPlayAgain}>{playerWon ? 'PLAY AGAIN' : 'TRY AGAIN'} →</Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/ChampResultsScreen.tsx
git commit -m "feat(ui): ChampResultsScreen victory/elimination"
```

---

## Task 6: App.tsx routing — full championship flow

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { initChampionship, advanceBracket, getOpponent } from './state/championship';
import type { ChampionshipState } from './state/championship';
import { ChampBracketScreen } from './screens/ChampBracketScreen';
import { ChampTransitionScreen } from './screens/ChampTransitionScreen';
import { ChampResultsScreen } from './screens/ChampResultsScreen';
```

- [ ] **Step 2: Add local state for championship transition**

Inside `App()`, near the existing `useState` calls:

```typescript
const [champPrevRound, setChampPrevRound] = useState<0 | 1 | 2>(0);
const [champPlayerWon, setChampPlayerWon] = useState(false);
```

- [ ] **Step 3: Wire charselect for championship**

Update the `charselect` screen block's `onReady`:

```typescript
            onReady={(p1, p2) => {
              set({ p1, p2 });
              if (state.mode === 'batt') {
                go('battleconfig');
              } else if (state.mode === 'champ') {
                const champState = initChampionship(p1, Date.now());
                set({ championshipState: champState });
                go('champbracket');
              } else {
                go('stage');
              }
            }}
```

- [ ] **Step 4: Add champbracket screen**

```typescript
        {state.screen === 'champbracket' && state.championshipState && (
          <ChampBracketScreen
            champ={state.championshipState}
            onFight={() => go('stage')}
            onQuit={() => {
              set({ championshipState: null });
              go('menu');
            }}
          />
        )}
```

- [ ] **Step 5: Wire stage select for championship to proceed to game with BO1**

The existing `stage` screen calls `go('game')` with no changes. For championship, the fight uses the opponent from the bracket. Update the stage block:

```typescript
        {state.screen === 'stage' && (
          <StageSelect
            initialStage={state.stageId}
            onBack={() => {
              if (state.mode === 'champ') go('champbracket');
              else go('charselect');
            }}
            onReady={(stageId) => {
              if (state.mode === 'champ' && state.championshipState) {
                const opp = getOpponent(state.championshipState);
                set({ stageId, p2: opp });
              } else {
                set({ stageId });
              }
              go('game');
            }}
          />
        )}
```

- [ ] **Step 6: Handle championship game end in the game screen block**

Update the `game` screen's `onVictory` and `onDefeat` to handle championship:

```typescript
            onVictory={(score, matchStats) => {
              if (state.mode === 'champ' && state.championshipState) {
                const prevRound = state.championshipState.currentRound as 0 | 1 | 2;
                const advanced = advanceBracket(state.championshipState, true);
                setChampPrevRound(prevRound);
                setChampPlayerWon(true);
                set({ championshipState: advanced });
                go('champtransition');
              } else {
                setFinalScore(score);
                setFinalMatchStats(matchStats);
                set({ winner: 'P1' });
                go('results');
              }
            }}
            onDefeat={(matchStats) => {
              if (state.mode === 'champ' && state.championshipState) {
                const prevRound = state.championshipState.currentRound as 0 | 1 | 2;
                const advanced = advanceBracket(state.championshipState, false);
                setChampPrevRound(prevRound);
                setChampPlayerWon(false);
                set({ championshipState: advanced });
                go('champtransition');
              } else {
                setFinalScore(0);
                setFinalMatchStats(matchStats);
                set({ winner: 'P2' });
                go('results');
              }
            }}
```

Also pass `p2={state.mode === 'champ' && state.championshipState ? getOpponent(state.championshipState) : state.p2}` to GameScreen — but since we already set `state.p2` in the stage select onReady above, just rely on `state.p2`.

- [ ] **Step 7: Add champtransition screen**

```typescript
        {state.screen === 'champtransition' && state.championshipState && (
          <ChampTransitionScreen
            champ={state.championshipState}
            prevRound={champPrevRound}
            playerWon={champPlayerWon}
            onAdvance={() => go('champbracket')}
            onResults={() => go('champresults')}
          />
        )}
```

- [ ] **Step 8: Add champresults screen**

```typescript
        {state.screen === 'champresults' && state.championshipState && (
          <ChampResultsScreen
            champ={state.championshipState}
            onPlayAgain={() => {
              set({ championshipState: null });
              go('charselect');
            }}
            onMenu={() => {
              set({ championshipState: null });
              go('menu');
            }}
          />
        )}
```

- [ ] **Step 9: Enable championship in MainMenu**

In `src/screens/MainMenu.tsx`:

```typescript
  { id: 'champ', label: 'CHAMPIONSHIP', sub: 'Bracketed tournament', target: 'charselect', mode: 'champ', enabled: true },
```

- [ ] **Step 10: Run all tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 11: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx src/screens/MainMenu.tsx
git commit -m "feat: wire championship mode end-to-end — bracket, fight, transition, results"
```

---

## Manual Test Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Menu → CHAMPIONSHIP → CharSelect (P2 panel hidden) → pick guild → ChampBracketScreen opens
- [ ] Bracket shows 4 QF matches; 3 non-player matches already have winners; player match shows "??? vs YOU" — actually shows player match with opponent name
- [ ] Click FIGHT → stage select → pick stage → VS game starts against the QF opponent
- [ ] Win the fight → ChampTransitionScreen shows WIN, reveals all QF results → ADVANCE TO SEMI-FINALS
- [ ] ChampBracketScreen updates: QF matches all resolved, SF match highlighted
- [ ] Win SF → transition → ADVANCE TO FINAL
- [ ] Win Final → transition → VIEW RESULTS → ChampResultsScreen shows CHAMPION banner + 3-fight history
- [ ] PLAY AGAIN → restarts from CharSelect with no championship state
- [ ] Lose any fight → ELIMINATED banner → VIEW RESULTS → shows who won the tournament → TRY AGAIN → CharSelect
