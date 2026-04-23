# Bot Optimization & Balance Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-guild strategy configs to make the VS CPU AI contextually smart, and ship a headless balance runner that produces a 15×15 win-rate matrix across all guilds.

**Architecture:** `GuildStrategy` / `AbilityStrategy` types live in `types.ts` alongside `GuildDef`. Each guild in `guildData.ts` gets a `strategy` block. `vsAI.ts` is rewritten to score ability slots against live game state and guild strategy, with difficulty controlling how often the config is consulted. A standalone script `scripts/balance-runner.ts` drives both sides at max difficulty and outputs a CSV win-rate matrix.

**Tech Stack:** TypeScript, Vitest, `tsx` (to run scripts), Vite + shared simulation package only (no Phaser, no Colyseus, no DOM).

**Models:**
- **Sonnet 4.6** — Tasks 1, 2, 4, 5, 6 (complex reasoning, architecture, new logic)
- **Haiku 4.5** — Task 3 (mechanical repetitive guild data entry, 15 guilds)

**Parallelism:**
- Task 1 must complete first (defines types everything else depends on).
- Tasks 2, 3, and 5 are fully independent of each other — run in parallel after Task 1.
- Task 4 requires Task 2 (write tests before implementation).
- Task 6 requires Tasks 3 + 4 + 5 (integration needs all pieces).

```
Task 1 (types)
  ├─► Task 2 (vsAI tests)    ─► Task 4 (vsAI rewrite)   ─┐
  ├─► Task 3 (guild data)                                  ├─► Task 6 (integration)
  └─► Task 5 (balance runner)                             ─┘
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/simulation/types.ts` | Modify | Add `AbilityStrategy`, `GuildStrategy` interfaces; add `strategy?` to `GuildDef` |
| `packages/shared/src/simulation/guildData.ts` | Modify | Add `strategy` block to all 15 guilds |
| `packages/shared/src/simulation/vsAI.ts` | Modify | Add `configFidelityPct` to Tuning; add `buildSituationContext`, `scoreAbilitySlot` helpers; rewrite decision logic; add `target?` param to `synthesizeVsCpuInput` |
| `packages/shared/src/simulation/__tests__/vsAI.test.ts` | Create | Unit tests for helpers and integrated difficulty behaviour |
| `scripts/balance-runner.ts` | Create | Headless 15×15 match runner; outputs table + CSV |

---

## Task 1 — Add Strategy Types (Sonnet 4.6)

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`

- [ ] **Step 1: Add `AbilityStrategy` and `GuildStrategy` interfaces to types.ts**

Insert after the `ResourceDef` interface (around line 87, before `GuildDef`):

```ts
export interface AbilityStrategy {
  priority?: number;
  minHpPct?: number;
  maxHpPct?: number;
  minResourcePct?: number;
  hoardResource?: boolean;
  useWhenOpponentAirborne?: boolean;
  useWhenOpponentKnockedDown?: boolean;
  useAtCloseRange?: boolean;
  useAtLongRange?: boolean;
  retreatToUse?: boolean;
}

export interface GuildStrategy {
  abilities: Partial<Record<1 | 2 | 3 | 4 | 5 | 'rmb', AbilityStrategy>>;
  preferRange: 'close' | 'mid' | 'long';
  aggressionPct: number;
  blockOnReaction: boolean;
  resourceStrategy: 'spend' | 'hoard';
  retreatBelowHpPct?: number;
}
```

- [ ] **Step 2: Add `strategy?` to `GuildDef`**

In the `GuildDef` interface, add after the `description` field:

```ts
export interface GuildDef {
  id: GuildId;
  name: string;
  color: string;
  initial: string;
  stats: Stats;
  hpMax: number;
  armor: number;
  magicResist: number;
  moveSpeed: number;
  jumpPower: number;
  resource: ResourceDef;
  abilities: AbilityDef[];
  rmb: AbilityDef;
  damageType: DamageType;
  description: string;
  strategy?: GuildStrategy;
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/simulation/types.ts
git commit -m "feat(ai): add AbilityStrategy and GuildStrategy types to GuildDef"
```

---

## Task 2 — Write Failing vsAI Tests (Sonnet 4.6) — parallel with Tasks 3 & 5

**Files:**
- Create: `packages/shared/src/simulation/__tests__/vsAI.test.ts`

These tests should fail until Task 4 is complete.

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from 'vitest';
import { createVsState } from '../vsSimulation';
import { tickSimulation } from '../simulation';
import {
  buildSituationContext,
  scoreAbilitySlot,
  synthesizeVsCpuInput,
  createEmptyCpuInput,
} from '../vsAI';
import type { GuildStrategy } from '../types';

// ── helpers ────────────────────────────────────────────────────────────────────

function idleInput() {
  return createEmptyCpuInput();
}

function advanceToFighting(state: ReturnType<typeof createVsState>, ticks = 120) {
  let s = state;
  for (let i = 0; i < ticks; i++) s = tickSimulation(s, idleInput(), 16);
  return s;
}

// ── buildSituationContext ──────────────────────────────────────────────────────

describe('buildSituationContext', () => {
  it('reports correct ownHpPct and opponentHpPct', () => {
    let s = createVsState('knight', 'mage', 'assembly', 1);
    s = advanceToFighting(s);
    s.player.hp = s.player.hpMax * 0.5;
    s.opponent!.hp = s.opponent!.hpMax * 0.25;

    const ctx = buildSituationContext(s.player, s.opponent!);
    expect(ctx.ownHpPct).toBeCloseTo(0.5, 1);
    expect(ctx.opponentHpPct).toBeCloseTo(0.25, 1);
  });

  it('reports opponentIsAirborne when opponent z > 0', () => {
    let s = createVsState('knight', 'mage', 'assembly', 1);
    s = advanceToFighting(s);
    s.opponent!.z = 10;
    const ctx = buildSituationContext(s.player, s.opponent!);
    expect(ctx.opponentIsAirborne).toBe(true);
  });

  it('reports opponentIsKnockedDown when opponent state is knockdown', () => {
    let s = createVsState('knight', 'mage', 'assembly', 1);
    s = advanceToFighting(s);
    s.opponent!.state = 'knockdown';
    const ctx = buildSituationContext(s.player, s.opponent!);
    expect(ctx.opponentIsKnockedDown).toBe(true);
  });
});

// ── scoreAbilitySlot ───────────────────────────────────────────────────────────

describe('scoreAbilitySlot', () => {
  it('returns priority when no conditions set', () => {
    const slot = { priority: 7 };
    const ctx = {
      ownHpPct: 0.8, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 40, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(7);
  });

  it('returns 0 when ownHpPct is below minHpPct', () => {
    const slot = { priority: 7, minHpPct: 0.5 };
    const ctx = {
      ownHpPct: 0.3, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 40, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(0);
  });

  it('returns 0 when ownHpPct is above maxHpPct (heal-only abilities)', () => {
    const slot = { priority: 9, maxHpPct: 0.6 };
    const ctx = {
      ownHpPct: 0.85, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 40, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(0);
  });

  it('returns 0 when resourcePct is below minResourcePct', () => {
    const slot = { priority: 8, minResourcePct: 0.6 };
    const ctx = {
      ownHpPct: 0.8, opponentHpPct: 0.6, resourcePct: 0.2,
      distanceToOpponent: 40, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(0);
  });

  it('returns 0 for useAtCloseRange ability when target is distant', () => {
    const slot = { priority: 7, useAtCloseRange: true };
    const ctx = {
      ownHpPct: 0.8, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 200, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(0);
  });

  it('returns 0 for useAtLongRange ability when target is close', () => {
    const slot = { priority: 6, useAtLongRange: true };
    const ctx = {
      ownHpPct: 0.8, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 30, opponentIsAirborne: false,
      opponentIsKnockedDown: false, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(0);
  });

  it('returns priority for useWhenOpponentKnockedDown when opponent is down', () => {
    const slot = { priority: 9, useWhenOpponentKnockedDown: true };
    const ctx = {
      ownHpPct: 0.8, opponentHpPct: 0.6, resourcePct: 0.9,
      distanceToOpponent: 40, opponentIsAirborne: false,
      opponentIsKnockedDown: true, opponentIsAttacking: false,
    };
    expect(scoreAbilitySlot(slot, ctx)).toBe(9);
  });
});

// ── synthesizeVsCpuInput — difficulty fidelity ────────────────────────────────

describe('synthesizeVsCpuInput: difficulty fidelity', () => {
  it('at difficulty 0, never fires abilities (abilityChance=0)', () => {
    let s = createVsState('monk', 'mage', 'assembly', 42);
    s = advanceToFighting(s);
    s.opponent!.mp = s.opponent!.mpMax;

    const input = createEmptyCpuInput();
    let abilityFired = false;
    for (let i = 0; i < 200; i++) {
      const out = synthesizeVsCpuInput(s, s.opponent!, input, 16, 0);
      if (out.testAbilitySlot != null) { abilityFired = true; break; }
    }
    expect(abilityFired).toBe(false);
  });

  it('at difficulty 5 with strategy, prefers high-priority ability over random', () => {
    // Run 50 matches, count how many times slot 4 (five_point_palm, priority 9)
    // fires vs slot 3 (jab, priority 5) when both are affordable.
    // With strategy, slot 4 should win significantly more often.
    let slot4Fires = 0;
    let slot3Fires = 0;
    for (let seed = 0; seed < 50; seed++) {
      let s = createVsState('monk', 'mage', 'assembly', seed);
      s = advanceToFighting(s);
      s.opponent!.mp = s.opponent!.mpMax; // full chi
      // get opponent close enough to be in range
      s.opponent!.x = s.player.x + 40;

      const input = createEmptyCpuInput();
      // tick until an ability fires or 500 ticks
      for (let i = 0; i < 500; i++) {
        const out = synthesizeVsCpuInput(s, s.opponent!, input, 16, 5);
        s = tickSimulation(s, idleInput(), 16);
        if (out.testAbilitySlot === 4) { slot4Fires++; break; }
        if (out.testAbilitySlot === 3) { slot3Fires++; break; }
      }
    }
    // strategy-aware AI should fire slot 4 more than slot 3
    expect(slot4Fires).toBeGreaterThan(slot3Fires);
  });
});

// ── retreatBelowHpPct ─────────────────────────────────────────────────────────

describe('synthesizeVsCpuInput: retreat below HP threshold', () => {
  it('backs off when HP is below retreatBelowHpPct at difficulty 4+', () => {
    // Druid has retreatBelowHpPct: 0.5 — at 30% HP it should be moving away
    let s = createVsState('druid', 'mage', 'assembly', 7);
    s = advanceToFighting(s);
    // Put Druid (opponent) at 25% HP, player directly to the right
    s.opponent!.hp = s.opponent!.hpMax * 0.25;
    s.opponent!.x = 500;
    s.player.x = 600; // player is to the right — druid should move left (away)

    const input = createEmptyCpuInput();
    let movedLeft = false;
    for (let i = 0; i < 50; i++) {
      const out = synthesizeVsCpuInput(s, s.opponent!, input, 16, 4);
      if (out.left) { movedLeft = true; break; }
    }
    expect(movedLeft).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- vsAI
```

Expected: `Cannot find module '../vsAI'` or `buildSituationContext is not exported` — confirms tests are targeting the new API before it exists.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/shared/src/simulation/__tests__/vsAI.test.ts
git commit -m "test(ai): add failing vsAI strategy tests"
```

---

## Task 3 — Add Strategy Blocks to All 15 Guilds (Haiku 4.5) — parallel with Tasks 2 & 5

**Files:**
- Modify: `packages/shared/src/simulation/guildData.ts`

Add a `strategy` field to each guild entry in `GUILDS`. Insert it after the `description` field. All slots are 1-indexed (slot 1 = abilities[0], etc.).

Range thresholds: `useAtCloseRange` = within ~70u; `useAtLongRange` = beyond ~150u.

- [ ] **Step 1: Add strategy to adventurer**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.65,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.35,
  abilities: {
    1: { priority: 5, useAtCloseRange: true },                          // rallying_cry — buff AoE
    2: { priority: 7, useAtCloseRange: true },                          // slash
    3: { priority: 9, maxHpPct: 0.6, retreatToUse: true },             // bandage — self-heal
    4: { priority: 4, useAtLongRange: true },                           // quickshot — ranged
    5: { priority: 8, minHpPct: 0.3 },                                  // adrenaline_rush — ult
    rmb: { priority: 6, maxHpPct: 0.7 },                               // second_wind — stamina restore
  },
},
```

- [ ] **Step 2: Add strategy to knight**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.6,
  blockOnReaction: true,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.15,
  abilities: {
    1: { priority: 8, minResourcePct: 0.35, useAtCloseRange: true },   // holy_rebuke — AoE stun
    2: { priority: 7, useAtCloseRange: true },                          // valorous_strike
    3: { priority: 5, useAtCloseRange: true },                          // taunt
    4: { priority: 6, maxHpPct: 0.7 },                                  // shield_wall — def buff
    5: { priority: 9, maxHpPct: 0.4 },                                  // last_stand — ult
    rmb: { priority: 8, maxHpPct: 0.5 },                               // shield_block
  },
},
```

- [ ] **Step 3: Add strategy to mage**

```ts
strategy: {
  preferRange: 'long',
  aggressionPct: 0.35,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.4,
  abilities: {
    1: { priority: 8, useAtCloseRange: true },                          // ice_nova — escape/AoE
    2: { priority: 6, useAtLongRange: true },                           // frostbolt
    3: { priority: 9, maxHpPct: 0.5, retreatToUse: true },             // blink — escape
    4: { priority: 7, useAtLongRange: true },                           // arcane_shard
    5: { priority: 8, minResourcePct: 0.5 },                            // meteor — ult
    rmb: { priority: 9, maxHpPct: 0.6, retreatToUse: true },           // short_teleport — escape
  },
},
```

- [ ] **Step 4: Add strategy to druid**

```ts
strategy: {
  preferRange: 'mid',
  aggressionPct: 0.4,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.5,
  abilities: {
    1: { priority: 9, maxHpPct: 0.6, retreatToUse: true },             // wild_growth — AoE heal
    2: { priority: 6, useAtLongRange: true },                           // entangle — root
    3: { priority: 9, maxHpPct: 0.7, retreatToUse: true },             // rejuvenate — heal+HoT
    4: { priority: 7, maxHpPct: 0.6 },                                  // cleanse — heal+debuff clear
    5: { priority: 8, maxHpPct: 0.4, retreatToUse: true },             // tranquility — channel heal
    rmb: { priority: 4 },                                               // shapeshift — toggle form
  },
},
```

- [ ] **Step 5: Add strategy to hunter**

```ts
strategy: {
  preferRange: 'long',
  aggressionPct: 0.4,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.35,
  abilities: {
    1: { priority: 9, maxHpPct: 0.5, retreatToUse: true },             // disengage — escape+blind
    2: { priority: 6, useAtLongRange: true },                           // piercing_volley
    3: { priority: 8, useAtLongRange: true },                           // aimed_shot
    4: { priority: 5, useAtLongRange: true },                           // bear_trap — zone control
    5: { priority: 7, minResourcePct: 0.5 },                            // rain_of_arrows — ult
    rmb: { priority: 3 },                                               // pet_command — utility
  },
},
```

- [ ] **Step 6: Add strategy to monk**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.8,
  blockOnReaction: true,
  resourceStrategy: 'hoard',
  retreatBelowHpPct: 0.2,
  abilities: {
    1: { priority: 8, retreatToUse: true },                             // serenity — escape/cleanse
    2: { priority: 7, useAtCloseRange: true },                          // flying_kick — dash+knockup
    3: { priority: 5, useAtCloseRange: true },                          // jab — chi generator
    4: { priority: 9, minResourcePct: 0.6, useAtCloseRange: true },    // five_point_palm — chi dump
    5: { priority: 8, minResourcePct: 1.0 },                            // dragons_fury — ult (needs full chi)
    rmb: { priority: 7 },                                               // parry
  },
},
```

- [ ] **Step 7: Add strategy to viking**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.9,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  abilities: {
    1: { priority: 7, minResourcePct: 0.25, useAtCloseRange: true },   // whirlwind — lifesteal AoE
    2: { priority: 6 },                                                  // harpoon — pull
    3: { priority: 8, minResourcePct: 0.3 },                            // bloodlust — lifesteal buff
    4: { priority: 5, useAtCloseRange: true },                          // axe_swing
    5: { priority: 9, maxHpPct: 0.3, minResourcePct: 0.6 },            // undying_rage — ult when low
    rmb: { priority: 6, useAtCloseRange: true },                        // shield_bash
  },
},
```

- [ ] **Step 8: Add strategy to prophet**

```ts
strategy: {
  preferRange: 'mid',
  aggressionPct: 0.35,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.5,
  abilities: {
    1: { priority: 8, maxHpPct: 0.7 },                                  // prophetic_shield — absorb
    2: { priority: 5, useAtLongRange: true },                           // smite — ranged
    3: { priority: 6 },                                                  // bless — buff
    4: { priority: 7, useAtLongRange: true },                           // curse — debuff
    5: { priority: 9, maxHpPct: 0.3, retreatToUse: true },             // divine_intervention — ult
    rmb: { priority: 3 },                                               // divine_insight — reveal
  },
},
```

- [ ] **Step 9: Add strategy to vampire**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.75,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.3,
  abilities: {
    1: { priority: 6, useAtLongRange: true },                           // hemorrhage — DoT projectile
    2: { priority: 7, useAtLongRange: true },                           // shadow_step — teleport behind
    3: { priority: 9, maxHpPct: 0.5, retreatToUse: true },             // blood_drain — channel heal
    4: { priority: 6, useAtCloseRange: true },                          // fang_strike — lifesteal
    5: { priority: 8, minResourcePct: 0.6 },                            // nocturne — stealth ult
    rmb: { priority: 7, retreatToUse: true },                          // mist_step — reposition
  },
},
```

- [ ] **Step 10: Add strategy to cultist**

Note: Cultist has negative ability costs (abilities GAIN sanity). `minResourcePct` is not useful here — rely on priority only.

```ts
strategy: {
  preferRange: 'mid',
  aggressionPct: 0.55,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  abilities: {
    1: { priority: 6 },                                                  // summon_spawn
    2: { priority: 5, useAtLongRange: true },                           // whispers — silence projectile
    3: { priority: 8, useAtCloseRange: true },                          // madness — AoE stun
    4: { priority: 6, useAtLongRange: true },                           // tendril_grasp — root DoT
    5: { priority: 9 },                                                  // open_the_gate — ult pull
    rmb: { priority: 7 },                                               // gaze_abyss — ability enhancer
  },
},
```

- [ ] **Step 11: Add strategy to champion**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.9,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  abilities: {
    1: { priority: 7, minResourcePct: 0.3 },                            // tithe_of_blood — consume stacks+heal
    2: { priority: 8 },                                                  // berserker_charge — dash+knockup
    3: { priority: 9, useAtCloseRange: true },                          // execute — ×2 below 30% opp HP
    4: { priority: 6, useAtCloseRange: true },                          // cleaver — melee arc
    5: { priority: 8, useAtCloseRange: true },                          // skullsplitter — heavy melee
    rmb: { priority: 7 },                                               // challenge — taunt+dmg amp
  },
},
```

- [ ] **Step 12: Add strategy to darkmage**

```ts
strategy: {
  preferRange: 'long',
  aggressionPct: 0.3,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.4,
  abilities: {
    1: { priority: 5, useAtLongRange: true },                           // darkness — blind zone
    2: { priority: 7, useAtLongRange: true },                           // grasping_shadow — root
    3: { priority: 6, useAtCloseRange: true },                          // soul_leech — lifesteal+mana
    4: { priority: 6, useAtLongRange: true },                           // shadow_bolt — chilling
    5: { priority: 8, minResourcePct: 0.45 },                           // eternal_night — ult silence zone
    rmb: { priority: 9, maxHpPct: 0.5, retreatToUse: true },           // shadow_cloak — escape
  },
},
```

- [ ] **Step 13: Add strategy to chef**

```ts
strategy: {
  preferRange: 'mid',
  aggressionPct: 0.5,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.4,
  abilities: {
    1: { priority: 6, useAtCloseRange: true },                          // feast — buff AoE
    2: { priority: 5, useAtCloseRange: true },                          // ladle_bash — melee daze
    3: { priority: 8, maxHpPct: 0.6, retreatToUse: true },             // hot_soup — heal+regen
    4: { priority: 6, useAtLongRange: true },                           // spice_toss — blind+DoT
    5: { priority: 7, minResourcePct: 0.6 },                            // signature_dish — channel buff
    rmb: { priority: 4 },                                               // pocket_dish — self buff
  },
},
```

- [ ] **Step 14: Add strategy to leper**

```ts
strategy: {
  preferRange: 'close',
  aggressionPct: 0.7,
  blockOnReaction: false,
  resourceStrategy: 'spend',
  retreatBelowHpPct: 0.2,
  abilities: {
    1: { priority: 7, minResourcePct: 0.15, useAtCloseRange: true },   // plague_vomit — cone DoT
    2: { priority: 6, useAtCloseRange: true },                          // diseased_claw
    3: { priority: 9, maxHpPct: 0.5, useAtCloseRange: true },          // necrotic_embrace — lifesteal
    4: { priority: 5, useAtLongRange: true },                           // contagion — DoT spread
    5: { priority: 8, minResourcePct: 0.5 },                            // rotting_tide — ult
    rmb: { priority: 7 },                                               // miasma — aura
  },
},
```

- [ ] **Step 15: Add strategy to master**

```ts
strategy: {
  preferRange: 'mid',
  aggressionPct: 0.6,
  blockOnReaction: true,
  resourceStrategy: 'spend',
  abilities: {
    1: { priority: 7, useAtCloseRange: true },                          // chosen_strike
    2: { priority: 5 },                                                  // chosen_utility
    3: { priority: 8, minResourcePct: 0.2 },                            // chosen_nuke — burst
    4: { priority: 4 },                                                  // eclipse — cycle forms
    5: { priority: 9, minResourcePct: 0.5 },                            // apotheosis — ult
    rmb: { priority: 3 },                                               // class_swap
  },
},
```

- [ ] **Step 16: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 17: Commit**

```bash
git add packages/shared/src/simulation/guildData.ts
git commit -m "feat(ai): add strategy blocks to all 15 guilds"
```

---

## Task 4 — Rewrite vsAI.ts (Sonnet 4.6) — after Task 2

**Files:**
- Modify: `packages/shared/src/simulation/vsAI.ts`

- [ ] **Step 1: Add `configFidelityPct` to the Tuning interface and table**

Replace the `Tuning` interface and `TUNING_BY_DIFFICULTY` constant:

```ts
interface Tuning {
  decisionIntervalMs: number;
  attackCadenceMs: number;
  blockChance: number;
  abilityChance: number;
  abilityCooldownMs: number;
  configFidelityPct: number;  // 0–1: probability the AI consults strategy config each decision
}

const TUNING_BY_DIFFICULTY: Tuning[] = [
  // 0 Training — idle; ignores strategy entirely.
  { decisionIntervalMs: 1200, attackCadenceMs: 99999, blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999, configFidelityPct: 0    },
  // 1 Easy
  { decisionIntervalMs: 600,  attackCadenceMs: 1400,  blockChance: 0,    abilityChance: 0,    abilityCooldownMs: 99999, configFidelityPct: 0.30 },
  // 2 Knight (default)
  { decisionIntervalMs: 350,  attackCadenceMs: 900,   blockChance: 0.15, abilityChance: 0.10, abilityCooldownMs: 4500,  configFidelityPct: 0.55 },
  // 3 Veteran
  { decisionIntervalMs: 220,  attackCadenceMs: 700,   blockChance: 0.35, abilityChance: 0.18, abilityCooldownMs: 3000,  configFidelityPct: 0.75 },
  // 4 Master
  { decisionIntervalMs: 140,  attackCadenceMs: 550,   blockChance: 0.55, abilityChance: 0.30, abilityCooldownMs: 2000,  configFidelityPct: 0.90 },
  // 5 Mats — full strategy, fastest reactions.
  { decisionIntervalMs: 80,   attackCadenceMs: 400,   blockChance: 0.75, abilityChance: 0.45, abilityCooldownMs: 1200,  configFidelityPct: 1.0  },
];
```

- [ ] **Step 2: Add the `CLOSE_RANGE_THRESHOLD` and `LONG_RANGE_THRESHOLD` constants**

After the existing range constants at the top:

```ts
const CLOSE_RANGE_THRESHOLD = 70;
const LONG_RANGE_THRESHOLD = 150;
```

- [ ] **Step 3: Export `SituationContext` type and `buildSituationContext` helper**

Add after the constants block:

```ts
export interface SituationContext {
  ownHpPct: number;
  opponentHpPct: number;
  resourcePct: number;
  distanceToOpponent: number;
  opponentIsAirborne: boolean;
  opponentIsKnockedDown: boolean;
  opponentIsAttacking: boolean;
}

export function buildSituationContext(self: Actor, target: Actor): SituationContext {
  return {
    ownHpPct: self.hpMax > 0 ? self.hp / self.hpMax : 1,
    opponentHpPct: target.hpMax > 0 ? target.hp / target.hpMax : 1,
    resourcePct: self.mpMax > 0 ? self.mp / self.mpMax : 1,
    distanceToOpponent: Math.abs(target.x - self.x),
    opponentIsAirborne: target.z > 0,
    opponentIsKnockedDown: target.state === 'knockdown',
    opponentIsAttacking: target.state === 'attacking',
  };
}
```

- [ ] **Step 4: Export `scoreAbilitySlot` helper**

Add after `buildSituationContext` (`AbilityStrategy` will be in the import updated in Step 7):

```ts
export function scoreAbilitySlot(slot: AbilityStrategy, ctx: SituationContext): number {
  const p = slot.priority ?? 5;
  if (slot.minHpPct != null && ctx.ownHpPct < slot.minHpPct) return 0;
  if (slot.maxHpPct != null && ctx.ownHpPct > slot.maxHpPct) return 0;
  if (slot.minResourcePct != null && ctx.resourcePct < slot.minResourcePct) return 0;
  if (slot.useAtCloseRange && ctx.distanceToOpponent > CLOSE_RANGE_THRESHOLD) return 0;
  if (slot.useAtLongRange && ctx.distanceToOpponent < LONG_RANGE_THRESHOLD) return 0;
  if (slot.useWhenOpponentAirborne && !ctx.opponentIsAirborne) return 0;
  if (slot.useWhenOpponentKnockedDown && !ctx.opponentIsKnockedDown) return 0;
  return p;
}
```

- [ ] **Step 5: Replace `pickAbilitySlot` with `pickAbilitySlotByStrategy`**

Remove the existing `pickAbilitySlot` function and replace with:

```ts
function pickAbilitySlotByStrategy(
  opp: Actor,
  state: SimState,
  useStrategy: boolean,
): number | null {
  const guild = getGuild(opp.guildId!);
  const strategy = guild.strategy;
  const ctx = useStrategy && strategy
    ? buildSituationContext(opp, state.player)
    : null;

  // Score each slot — falls back to cost-weight when not using strategy.
  const candidates: { slot: number; weight: number }[] = [];

  for (let i = 0; i < guild.abilities.length && i < 5; i++) {
    const a = guild.abilities[i];
    if (opp.mp < a.cost) continue;
    const cd = opp.abilityCooldowns.get(a.id) ?? 0;
    if (cd > state.timeMs) continue;

    let weight: number;
    if (ctx && strategy?.abilities[(i + 1) as 1|2|3|4|5]) {
      weight = scoreAbilitySlot(strategy.abilities[(i + 1) as 1|2|3|4|5]!, ctx);
    } else {
      weight = Math.max(1, 6 - a.cost); // legacy cost-weight fallback
    }
    if (weight > 0) candidates.push({ slot: i + 1, weight });
  }

  // RMB
  if (guild.rmb && opp.mp >= guild.rmb.cost) {
    const cd = opp.abilityCooldowns.get(guild.rmb.id) ?? 0;
    if (cd <= state.timeMs) {
      let weight: number;
      if (ctx && strategy?.abilities.rmb) {
        weight = scoreAbilitySlot(strategy.abilities.rmb, ctx);
      } else {
        weight = 1;
      }
      if (weight > 0) candidates.push({ slot: 6, weight });
    }
  }

  if (candidates.length === 0) return null;

  // Pick highest-weight slot; random-break ties using state.rng().
  const maxWeight = Math.max(...candidates.map(c => c.weight));
  const top = candidates.filter(c => c.weight === maxWeight);
  const pick = top[Math.floor(state.rng() * top.length)];
  return pick.slot;
}
```

- [ ] **Step 6: Update `synthesizeVsCpuInput` — add `target?` param and strategy-aware decision logic**

Replace the full function:

```ts
export function synthesizeVsCpuInput(
  state: SimState,
  opp: Actor,
  prevInput: InputState,
  dtMs: number,
  difficulty: number,
  target?: Actor,
): InputState {
  const player = target ?? state.player;
  const tuning = getTuning(difficulty);

  const prev = {
    left: prevInput.left,
    right: prevInput.right,
    attack: prevInput.attack,
    block: prevInput.block,
    jump: prevInput.jump,
  };

  const ai = opp.aiState;
  ai.lastActionMs += dtMs;
  ai.abilityCooldownMs = Math.max(0, (ai.abilityCooldownMs ?? 0) - dtMs);

  const dx = player.x - opp.x;
  const dy = player.y - opp.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // ── Movement — preferRange ─────────────────────────────────────────────────
  const guild = opp.guildId ? getGuild(opp.guildId) : null;
  const strategy = guild?.strategy;
  const useStrategy = strategy != null && state.rng() < tuning.configFidelityPct;

  // Determine target range based on strategy preference
  let approachUntil: number;
  let retreatBeyond: number;
  if (useStrategy) {
    switch (strategy!.preferRange) {
      case 'mid':
        approachUntil = 100;
        retreatBeyond = 140;
        break;
      case 'long':
        approachUntil = 200;
        retreatBeyond = 260;
        break;
      default: // 'close'
        approachUntil = BASIC_ATTACK_RANGE - APPROACH_MARGIN;
        retreatBeyond = BASIC_ATTACK_RANGE + RETREAT_MARGIN;
    }
  } else {
    approachUntil = BASIC_ATTACK_RANGE - APPROACH_MARGIN;
    retreatBeyond = BASIC_ATTACK_RANGE + RETREAT_MARGIN;
  }

  // Retreat-to-heal override — when below HP threshold, back off regardless
  const ctx = buildSituationContext(opp, player);
  const shouldRetreat =
    useStrategy &&
    strategy!.retreatBelowHpPct != null &&
    ctx.ownHpPct < strategy!.retreatBelowHpPct &&
    difficulty >= 3;

  let pursuitDir: -1 | 0 | 1 = ai.pursuitDir ?? 0;
  if (shouldRetreat) {
    // Move away from player
    pursuitDir = dx > 0 ? -1 : 1;
  } else {
    if (pursuitDir === 0) {
      if (absDx > retreatBeyond) pursuitDir = dx > 0 ? 1 : -1;
    } else {
      if (absDx < approachUntil) pursuitDir = 0;
      else pursuitDir = dx > 0 ? 1 : -1;
    }
  }
  ai.pursuitDir = pursuitDir;

  let desiredLeft = pursuitDir === -1;
  let desiredRight = pursuitDir === 1;

  // Depth adjustment
  let desiredUp = absDy > DEPTH_TARGET_WINDOW && dy < 0;
  let desiredDown = absDy > DEPTH_TARGET_WINDOW && dy > 0;

  let desiredAttack = false;
  let desiredBlock = false;
  let desiredAbility: number | null = null;

  const inMeleeRange = absDx <= BASIC_ATTACK_RANGE - 2 && absDy <= ATTACK_Y_TOLERANCE;
  const makingDecision = ai.lastActionMs >= tuning.decisionIntervalMs;

  if (makingDecision) {
    ai.lastActionMs = 0;

    const canAttack = state.timeMs - opp.lastAttackTimeMs >= tuning.attackCadenceMs;
    if (inMeleeRange && canAttack) {
      desiredAttack = true;
      opp.lastAttackTimeMs = state.timeMs;

      if (
        ai.abilityCooldownMs === 0 &&
        state.rng() < tuning.abilityChance &&
        opp.guildId
      ) {
        const slot = pickAbilitySlotByStrategy(opp, state, useStrategy);
        if (slot != null) {
          desiredAbility = slot;
          desiredAttack = false;
          ai.abilityCooldownMs = tuning.abilityCooldownMs;
        }
      }
    }

    // Block reaction — only at difficulty 3+ when blockOnReaction is set
    const blockOnReaction = !useStrategy || (strategy?.blockOnReaction ?? false);
    const playerAttacking = player.state === 'attacking';
    if (
      playerAttacking &&
      absDx <= BASIC_ATTACK_RANGE + 20 &&
      absDy <= ATTACK_Y_TOLERANCE + 15 &&
      difficulty >= 3 &&
      state.rng() < tuning.blockChance &&
      blockOnReaction
    ) {
      desiredBlock = true;
      desiredAttack = false;
      desiredAbility = null;
      desiredLeft = false;
      desiredRight = false;
    }
  }

  // Write output
  prevInput.left = desiredLeft;
  prevInput.right = desiredRight;
  prevInput.up = desiredUp;
  prevInput.down = desiredDown;
  prevInput.jump = false;
  prevInput.attack = desiredAttack;
  prevInput.block = desiredBlock;
  prevInput.grab = false;
  prevInput.pause = false;
  prevInput.leftJustPressed = desiredLeft && !prev.left;
  prevInput.rightJustPressed = desiredRight && !prev.right;
  prevInput.jumpJustPressed = false;
  prevInput.attackJustPressed = desiredAttack && !prev.attack;
  prevInput.blockJustPressed = desiredBlock && !prev.block;
  prevInput.grabJustPressed = false;
  prevInput.pauseJustPressed = false;
  prevInput.fullscreenToggleJustPressed = false;
  if (prevInput.leftJustPressed) prevInput.lastLeftPressMs = state.timeMs;
  if (prevInput.rightJustPressed) prevInput.lastRightPressMs = state.timeMs;
  prevInput.runningLeft = false;
  prevInput.runningRight = false;
  prevInput.testAbilitySlot = desiredAbility;

  return prevInput;
}
```

- [ ] **Step 7: Update the import line at the top of vsAI.ts**

The file already imports from `./types`. Ensure `AbilityStrategy` and `GuildStrategy` are included:

```ts
import type { Actor, InputState, SimState, AbilityStrategy, GuildStrategy } from './types';
```

Apply this before Steps 3–6 take effect (the helpers reference these types).

- [ ] **Step 8: Run tests**

```bash
npm test -- vsAI
```

Expected: all vsAI tests pass.

- [ ] **Step 9: Run golden + full test suite**

```bash
npm test
```

Expected: all tests pass including the golden determinism gate.

- [ ] **Step 10: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/simulation/vsAI.ts packages/shared/src/simulation/__tests__/vsAI.test.ts
git commit -m "feat(ai): rewrite vsAI with strategy-config decision logic and difficulty fidelity"
```

---

## Task 5 — Write Balance Runner Script (Sonnet 4.6) — parallel with Tasks 2 & 3

**Files:**
- Create: `scripts/balance-runner.ts`

- [ ] **Step 1: Verify tsx is available**

```bash
npx tsx --version
```

If not installed: `npm install -D tsx` (dev dependency only).

- [ ] **Step 2: Create the script**

```ts
/**
 * Headless balance runner.
 * Run: npx tsx scripts/balance-runner.ts
 *
 * Both sides use max-difficulty CPU AI (difficulty 5).
 * Runs MATCHES_PER_PAIR matches per guild pairing, alternating sides to cancel spawn bias.
 * Outputs: win-rate matrix to stdout + balance-output.csv alongside this file.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createVsState } from '../packages/shared/src/simulation/vsSimulation.js';
import { tickSimulation } from '../packages/shared/src/simulation/simulation.js';
import { synthesizeVsCpuInput, createEmptyCpuInput } from '../packages/shared/src/simulation/vsAI.js';
import type { GuildId } from '../packages/shared/src/simulation/types.js';
import type { SimState } from '../packages/shared/src/simulation/types.js';

const GUILDS: GuildId[] = [
  'adventurer', 'knight', 'mage', 'druid', 'hunter', 'monk',
  'viking', 'prophet', 'vampire', 'cultist', 'champion', 'darkmage',
  'chef', 'leper', 'master',
];

const MATCHES_PER_PAIR = 20;
const MAX_DIFFICULTY = 5;
const TICK_DT = 16; // ms per tick — ~60fps
const MATCH_TIMEOUT_MS = 120_000; // 2 minutes of sim time

interface MatchResult {
  winner: 'p1' | 'p2' | 'draw';
  durationMs: number;
}

function runMatch(guildA: GuildId, guildB: GuildId, seed: number, swapped: boolean): MatchResult {
  const p1 = swapped ? guildB : guildA;
  const p2 = swapped ? guildA : guildB;

  let state: SimState = createVsState(p1, p2, 'assembly', seed);

  // P1 AI state (opponent AI runs automatically inside tickSimulation)
  const p1Input = createEmptyCpuInput();

  let timeMs = 0;

  while (timeMs < MATCH_TIMEOUT_MS) {
    // Synthesize P1 input — target is state.opponent
    synthesizeVsCpuInput(state, state.player, p1Input, TICK_DT, MAX_DIFFICULTY, state.opponent!);

    state = tickSimulation(state, p1Input, TICK_DT);
    timeMs += TICK_DT;

    if (state.phase === 'victory' || state.phase === 'defeat') {
      // Determine winner in terms of guildA/guildB
      const p1Wins = state.phase === 'victory';
      const winner = p1Wins ? (swapped ? 'p2' : 'p1') : (swapped ? 'p1' : 'p2');
      return { winner: winner as 'p1' | 'p2', durationMs: timeMs };
    }
  }
  // Timeout — draw
  return { winner: 'draw', durationMs: timeMs };
}

function runPair(guildA: GuildId, guildB: GuildId): { p1Wins: number; p2Wins: number; draws: number } {
  let p1Wins = 0, p2Wins = 0, draws = 0;
  for (let seed = 0; seed < MATCHES_PER_PAIR; seed++) {
    const swapped = seed % 2 === 1; // alternate sides each match
    const result = runMatch(guildA, guildB, seed, swapped);
    if (result.winner === 'p1') p1Wins++;
    else if (result.winner === 'p2') p2Wins++;
    else draws++;
  }
  return { p1Wins, p2Wins, draws };
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log(`Running ${GUILDS.length}×${GUILDS.length} balance matrix (${MATCHES_PER_PAIR} matches/pair)…\n`);

// winRates[i][j] = guildA (index i) win rate vs guildB (index j)
const winRates: number[][] = GUILDS.map(() => new Array(GUILDS.length).fill(0));
const totalWins: number[] = new Array(GUILDS.length).fill(0);
const totalMatches: number[] = new Array(GUILDS.length).fill(0);

for (let i = 0; i < GUILDS.length; i++) {
  for (let j = 0; j < GUILDS.length; j++) {
    if (i === j) {
      winRates[i][j] = 0.5; // mirror match — 50% by definition
      continue;
    }
    const { p1Wins, p2Wins, draws } = runPair(GUILDS[i], GUILDS[j]);
    const total = p1Wins + p2Wins + draws;
    winRates[i][j] = total > 0 ? (p1Wins + draws * 0.5) / total : 0.5;
    totalWins[i] += p1Wins + draws * 0.5;
    totalMatches[i] += total;
    process.stdout.write('.');
  }
  process.stdout.write('\n');
}

// ── Print matrix ───────────────────────────────────────────────────────────────

const COL_W = 13;
const pad = (s: string, w = COL_W) => s.substring(0, w).padEnd(w);
const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);

console.log('\n' + pad('') + GUILDS.map(g => pad(g)).join(''));
for (let i = 0; i < GUILDS.length; i++) {
  const row = GUILDS.map((_, j) => pad(pct(winRates[i][j]))).join('');
  console.log(pad(GUILDS[i]) + row);
}

// ── Overall ranking ────────────────────────────────────────────────────────────

const overallWinRate = GUILDS.map((g, i) => ({
  guild: g,
  winRate: totalMatches[i] > 0 ? totalWins[i] / totalMatches[i] : 0.5,
})).sort((a, b) => b.winRate - a.winRate);

console.log('\n── Overall ranking ──');
overallWinRate.forEach(({ guild, winRate }, rank) => {
  console.log(`${String(rank + 1).padStart(2)}. ${guild.padEnd(12)} ${Math.round(winRate * 100)}%`);
});

// ── CSV export ─────────────────────────────────────────────────────────────────

const csvRows = [
  ['', ...GUILDS].join(','),
  ...GUILDS.map((g, i) => [g, ...winRates[i].map(v => Math.round(v * 100))].join(',')),
];
const csvPath = join(dirname(fileURLToPath(import.meta.url)), 'balance-output.csv');
writeFileSync(csvPath, csvRows.join('\n'));
console.log(`\nCSV written to ${csvPath}`);
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors (script imports shared package types).

- [ ] **Step 4: Commit**

```bash
git add scripts/balance-runner.ts
git commit -m "feat(ai): add headless balance runner script"
```

---

## Task 6 — Integration: Run the Balance Matrix (Sonnet 4.6) — after Tasks 3 + 4 + 5

**Files:**
- No source changes — integration and verification only.

- [ ] **Step 1: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass including golden determinism gate.

- [ ] **Step 2: Run the balance runner**

```bash
npx tsx scripts/balance-runner.ts
```

Expected output: a 15×15 win-rate matrix printed to stdout and `scripts/balance-output.csv` written. Runtime should be under 30 seconds.

- [ ] **Step 3: Read the results and log findings**

Flag any guild with:
- Overall win rate > 65% → overtuned candidate
- Overall win rate < 35% → undertuned candidate
- Any single matchup win rate < 20% or > 80% → hard counter worth examining

Post findings as a GitHub comment or note them in the commit message.

- [ ] **Step 4: Commit CSV output**

```bash
git add scripts/balance-output.csv
git commit -m "chore(ai): add initial balance matrix output — baseline before tuning"
```

- [ ] **Step 5: Typecheck and build one final time**

```bash
npm run typecheck && npm run build
```

Expected: no errors.

---

## Execution Summary

| Task | Model | Depends on | Can parallel with |
|---|---|---|---|
| 1 — Types | Sonnet 4.6 | — | — |
| 2 — vsAI tests | Sonnet 4.6 | Task 1 | Tasks 3, 5 |
| 3 — Guild strategy data | Haiku 4.5 | Task 1 | Tasks 2, 5 |
| 4 — vsAI rewrite | Sonnet 4.6 | Task 2 | — |
| 5 — Balance runner | Sonnet 4.6 | Task 1 | Tasks 2, 3 |
| 6 — Integration | Sonnet 4.6 | Tasks 3, 4, 5 | — |
