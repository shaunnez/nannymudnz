# Bot Optimization & Balance Runner — Design Spec

**Date:** 2026-04-23
**Status:** Approved

## Overview

Two connected systems:

1. **Improved VS AI** — rewrite `vsAI.ts` to use per-guild strategy configs. The bot makes contextual decisions (ability selection, positioning, resource management, retreat-to-heal) rather than random rolls. The 6 existing difficulty levels map to config fidelity + reaction speed.

2. **Headless balance runner** — a Node script (`scripts/balance-runner.ts`) that runs all 14×14 guild matchups headlessly, outputs a win-rate matrix and CSV. Used to find balance outliers after the AI improvements land.

Phase B (two browser instances, self-improving AI, streaming) is out of scope for this spec. The strategy config schema is designed to support future evolutionary mutation.

---

## 1. Strategy Config Schema

Each guild in `packages/shared/src/simulation/guildData.ts` gets an optional `strategy` block alongside its existing stats.

```ts
export interface AbilityStrategy {
  priority?: number               // 1–10, higher = preferred when multiple slots ready
  minHpPct?: number               // don't fire if own HP% is below this
  maxHpPct?: number               // don't fire if own HP% is above this (heals only when hurt)
  minResourcePct?: number         // don't fire unless resource is at least this fraction
  hoardResource?: boolean         // save resource for this ability rather than spending freely
  useWhenOpponentAirborne?: boolean
  useWhenOpponentKnockedDown?: boolean
  useAtCloseRange?: boolean       // only fire within melee range
  useAtLongRange?: boolean        // prefer at distance (projectiles, buffs)
  retreatToUse?: boolean          // back off before firing (heals, long-range)
}

export interface GuildStrategy {
  abilities: Partial<Record<1 | 2 | 3 | 4 | 5 | 'rmb', AbilityStrategy>>
  preferRange: 'close' | 'mid' | 'long'   // default positioning preference
  aggressionPct: number                    // 0–1, how often to press forward vs reset
  blockOnReaction: boolean                 // react to telegraphed attacks with block
  resourceStrategy: 'spend' | 'hoard'     // default spend style when no ability overrides
  retreatBelowHpPct?: number               // override aggressionPct → ~0.1 when HP falls below this
}
```

All fields are optional with sensible defaults. Guilds only specify what is interesting about them. Example for Monk:

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.8,
  blockOnReaction: true,
  resourceStrategy: 'hoard',
  retreatBelowHpPct: 0.25,
  abilities: {
    3: { priority: 9, minResourcePct: 0.6, hoardResource: true, useWhenOpponentKnockedDown: true },
    1: { priority: 5, useAtCloseRange: true },
    rmb: { priority: 7, useWhenOpponentAirborne: true },
  }
}
```

### Future config externalisation

The `strategy` blocks and difficulty tuning table are candidates for extraction to JSON config files in a later pass. The schema is intentionally data-shaped (no functions) to support this. Do not hard-code guild names or slot numbers in `vsAI.ts` logic — read them from the config.

---

## 2. vsAI.ts Rewrite

### Decision tick (per `decisionIntervalMs`)

The existing tick structure is preserved. The random ability roll is replaced with config-aware selection:

**Step 1 — Build situation context**

```ts
interface SituationContext {
  ownHpPct: number
  opponentHpPct: number
  resourcePct: number
  distanceToOpponent: number
  opponentIsAirborne: boolean
  opponentIsKnockedDown: boolean
  opponentIsAttacking: boolean
}
```

Read from live `SimState` each decision tick.

**Step 2 — Score available ability slots**

For each slot in `strategy.abilities`:
- If any hard condition fails (`minHpPct`, `maxHpPct`, `minResourcePct`, range checks) → score = 0
- If conditions pass → score = `priority` (default 5)
- If slot is on cooldown or resource is insufficient → score = 0

**Step 3 — Pick highest scoring slot**

- If multiple slots tie → prefer the one with the lower remaining cooldown
- If all slots score 0 → fall back to basic attack (existing behaviour)

**Step 4 — Movement**

`preferRange` drives approach/retreat target distance:
- `'close'` → existing hysteresis (approach < 47u, retreat > 69u)
- `'mid'` → stay at ~120u
- `'long'` → stay at ~250u

`aggressionPct` adds a weighted chance to press forward even when at preferred range.

If `ownHpPct < retreatBelowHpPct` (and the field is set) → override to defensive stance regardless of `aggressionPct`. Back off to preferred range and prioritise any slot with `retreatToUse: true`.

**Step 5 — Block reaction**

`blockOnReaction` is only honoured at difficulty 3+. When active: if opponent is in an attack animation and within melee range, roll `blockChance` (from difficulty params) to block instead of attacking.

### What does not change

- `testAbilitySlot` is still how abilities fire (bypasses combo buffer — correct and intentional)
- Function signature of `synthesizeVsCpuInput` is unchanged
- Difficulty params struct shape is unchanged

---

## 3. Difficulty Mapping

The 6 existing difficulty levels stay. They now map to **config fidelity** (how often the AI consults the strategy config vs falling back to random behaviour) in addition to reaction speed.

| Level | Name | Decision interval | Config fidelity | Block reaction | Retreat-to-heal |
|---|---|---|---|---|---|
| 0 | Training | 1200ms | 0% | No | No |
| 1 | Easy | 800ms | 30% | No | No |
| 2 | Normal | 500ms | 55% | No | No |
| 3 | Hard | 300ms | 75% | Yes | Yes |
| 4 | Expert | 150ms | 90% | Yes | Yes |
| 5 | Max | 80ms | 100% | Yes | Yes |

**Config fidelity** is a roll each decision tick. If the roll fails, the AI ignores the strategy config and makes a random decision (existing behaviour). This keeps lower difficulties feeling organic rather than just slow.

> **Future:** Extract this table to a JSON config file so difficulty tuning does not require a code change.

---

## 4. Headless Balance Runner

**File:** `scripts/balance-runner.ts`
**Run:** `npx tsx scripts/balance-runner.ts`
**Imports:** Only from `packages/shared/src/simulation/` — no Vite, no Phaser, no browser APIs.

### Match loop

```
for each guild A in 14 guilds:
  for each guild B in 14 guilds (including A vs A):
    for seed 0..N-1 (default N=20):
      init SimState (VS mode, guild A = player, guild B = opponent, seed)
      tick tickSimulation() until isAlive=false on either side or timeMs > 99000 (existing ROUND_DURATION_MS constant)
      if seed is even: A=player, B=opponent
      if seed is odd:  A=opponent, B=player   ← cancel side bias
      record: winner, match duration (ms), damage dealt by each side
```

Both sides run at difficulty 5 (max). CPU input is generated via `synthesizeVsCpuInput` for both sides.

### Output

**Console — win-rate matrix** (14×14, rows = guild A, cols = guild B, value = A win %):

```
           Adventurer  Knight  Mage  Druid  ...
Adventurer     50%      48%    61%    39%
Knight         52%      50%    44%    55%
...
```

**Console — overall ranking** (avg win rate across all opponents):

```
1. Monk        68%
2. Viking      61%
3. Mage        58%
...
```

**File — `balance-output.csv`** written alongside the script for spreadsheet analysis.

### Runtime estimate

A single headless VS match completes in well under 1ms. 20 matches × 196 pairings = 3920 matches. Expected runtime: under 5 seconds.

### Interpreting results

- Win rate > 65% against the field → likely overtuned; check ability costs and damage values in `guildData.ts`
- Win rate < 35% → likely undertuned or strategy config is suboptimal
- Specific bad matchup (< 20% vs one guild) → look at range preferences and ability types

---

## Out of Scope (Phase B)

- Two browser instances playing live
- Haiku/LLM in the self-improvement loop
- Streaming setup
- Evolutionary strategy config mutation

These are valid follow-on ideas. The strategy config schema is designed to be JSON-serialisable so mutation is straightforward when Phase B is specced.

---

## Files Changed

| File | Change |
|---|---|
| `packages/shared/src/simulation/guildData.ts` | Add `GuildStrategy` + `AbilityStrategy` types; add `strategy` block to each of 14 guilds |
| `packages/shared/src/simulation/vsAI.ts` | Rewrite `synthesizeVsCpuInput` decision logic; update difficulty tuning table |
| `scripts/balance-runner.ts` | New file — headless match runner |
