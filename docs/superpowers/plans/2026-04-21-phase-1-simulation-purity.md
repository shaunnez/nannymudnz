# Phase 1 — Simulation Purity Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/simulation/**` portable to a Node server by removing `setTimeout`, replacing `Date.now()` / module-level counters with state-carried IDs, replacing `Math.random()` with a seeded RNG carried on `SimState`, lifting the `controllers` Map onto `SimState`, dropping non-serializable fields like `Set<string>`, enforcing the discipline with a lint gate, and guarding regressions with a golden-state test.

**Architecture:** The simulation already owns `SimState` as a plain struct. This plan threads new fields onto `SimState` (`rngSeed`, `rng`, id counters, `controllers`, `bloodtallyDecayMs`) and `AIState` (`lungeMs`), rewrites call sites to consume them, and replaces the two `setTimeout` callbacks with countdown fields ticked each frame. No externally-visible behavior change; passing play is subjectively indistinguishable from today.

**Tech Stack:** TypeScript, Vite, Vitest (new in this phase), ESLint flat config. No new runtime dependencies other than Vitest.

**Context to load before starting:**
- Design spec: `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md` (Phase 1 section).
- `CLAUDE.md` for the one-way dep flow rule (simulation must stay pure).
- The files you will touch: `src/simulation/{types,simulation,combat,ai,physics}.ts`, `src/screens/GameScreen.tsx`, `eslint.config.js`, `package.json`, `CLAUDE.md`.

**TDD note:** Task 2 (RNG) gets a true unit test. Most subsequent tasks are mechanical refactors; their regression gate is the golden-state test written in Task 12 plus `npm run typecheck`. Task 12 is deliberately late — running it earlier would force you to freeze the seeded output byte-for-byte while other rolls are still unthreaded.

---

## Task 1: Install Vitest and wire up the test script

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/__tests__/smoke.test.ts` (deleted at end of this task — exists only to verify wiring)

- [ ] **Step 1: Install Vitest**

Run:

```bash
npm install -D vitest@^2 @vitest/ui@^2
```

Expected: `vitest` and `@vitest/ui` appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the test script to `package.json`**

Edit `package.json` — under `"scripts"`, add a `test` entry so the block becomes:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit -p tsconfig.app.json",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write a smoke test to prove the runner works**

Create `src/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: one passing test, exit code 0.

- [ ] **Step 6: Delete the smoke test**

Run: `rm src/__tests__/smoke.test.ts` (and remove the now-empty `src/__tests__/` directory if your shell leaves it behind).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add Vitest as test runner"
```

---

## Task 2: Create `src/simulation/rng.ts` with a seeded RNG

**Files:**
- Create: `src/simulation/rng.ts`
- Create: `src/simulation/__tests__/rng.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/simulation/__tests__/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng';

describe('makeRng', () => {
  it('returns values in [0, 1)', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../rng'`.

- [ ] **Step 3: Implement `rng.ts`**

Create `src/simulation/rng.ts`:

```ts
// mulberry32 — a 32-bit state, 2^32 period PRNG.
// Chosen over LCG because mulberry32 has better distribution for
// the small-sample rolls our sim makes (crit checks, variance).
// Not cryptographically secure — do not use for anything security-sensitive.
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/rng.ts src/simulation/__tests__/rng.test.ts
git commit -m "feat(sim): seeded mulberry32 RNG"
```

---

## Task 3: Extend `SimState` and `AIState` with new fields

This is a pure type-surface change. No behavior yet.

**Files:**
- Modify: `src/simulation/types.ts`

- [ ] **Step 1: Add fields to `SimState` and `AIState`, and change `Projectile.hitActorIds`**

In `src/simulation/types.ts`, find `export interface Projectile` and change the `hitActorIds` field from `Set<string>` to `string[]`:

```ts
// BEFORE:  hitActorIds: Set<string>;
// AFTER:
  hitActorIds: string[];
```

Find `export interface AIState` and add a `lungeMs` field:

```ts
export interface AIState {
  behavior: AIBehavior;
  targetId: string | null;
  lastActionMs: number;
  retreating: boolean;
  packRole: 'leader' | 'circler' | null;
  phase: number;
  patrolDir: 1 | -1;
  leapCooldown: number;
  windupActive: boolean;
  windupTimeMs: number;
  lungeMs: number;
}
```

Find `export interface SimState` and add these new fields (below `score`):

```ts
export interface SimState {
  tick: number;
  timeMs: number;
  player: Actor;
  enemies: Actor[];
  allies: Actor[];
  pickups: Pickup[];
  projectiles: Projectile[];
  vfxEvents: VFXEvent[];
  waves: Wave[];
  currentWave: number;
  cameraX: number;
  cameraLocked: boolean;
  phase: 'playing' | 'victory' | 'defeat' | 'paused';
  bossSpawned: boolean;
  score: number;
  rngSeed: number;
  rng: () => number;
  nextActorId: number;
  nextProjectileId: number;
  nextPickupId: number;
  nextEffectId: number;
  bloodtallyDecayMs: number;
  controllers: Record<string, PlayerController>;
}

export interface PlayerController {
  input: InputState;
  comboBuffer: ComboBuffer;
  lastAttackMs: number;
  blockingMs: number;
  dodgeMs: number;
  parryWindowMs: number;
  channelMs: number;
  channelingAbility: string | null;
  groundTargetX: number;
  groundTargetY: number;
  attackChain: number;
  runningDir: number;
}
```

(Note: `PlayerController` exists as a non-exported interface in `simulation.ts` today. We're promoting it to `types.ts` and exporting it so `SimState` can reference it.)

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: errors. `simulation.ts` still defines its own `PlayerController` and constructs `Set<string>` for `hitActorIds`; `createInitialState` doesn't initialize the new fields. These get fixed in later tasks. **Capture the error list** — you should see errors about:

- duplicate identifier `PlayerController` (simulation.ts)
- missing properties on the object returned from `createInitialState` (simulation.ts)
- `Set<string>` not assignable to `string[]` (simulation.ts, ai.ts)
- `.has` / `.add` on a `string[]` (simulation.ts)

These errors drive the next tasks — do not fix them here.

- [ ] **Step 3: Do NOT commit yet**

This task leaves the repo in a broken state. Continue to Task 4 to unbreak it.

---

## Task 4: Initialize the new `SimState` fields in `createInitialState`

**Files:**
- Modify: `src/simulation/simulation.ts`

- [ ] **Step 1: Remove the local `PlayerController` interface and import it from types**

In `src/simulation/simulation.ts`:

Find the import block at the top and add `PlayerController` and `ComboBuffer` to the type imports:

```ts
import type {
  SimState, Actor, InputState, GuildId, Projectile,
  AbilityDef, ActorKind, PlayerController,
} from './types';
```

Find the local `interface PlayerController { ... }` (around line 178) and **delete the entire interface**. It now lives in `types.ts`.

Also delete the `ComboBuffer` reference issue: the local `PlayerController.comboBuffer` used `ReturnType<typeof createComboBuffer>`; the exported version in `types.ts` uses the `ComboBuffer` type. These are structurally equivalent (`createComboBuffer` returns a `ComboBuffer`), so no change at call sites.

- [ ] **Step 2: Add the `makeRng` import**

Add this import near the top of `simulation.ts`:

```ts
import { makeRng } from './rng';
```

- [ ] **Step 3: Update `createInitialState` to initialize all new fields**

Replace the entire `createInitialState` function:

```ts
export function createInitialState(guildId: GuildId, seed: number = Date.now()): SimState {
  return {
    tick: 0,
    timeMs: 0,
    player: createPlayerActor(guildId),
    enemies: [],
    allies: [],
    pickups: [],
    projectiles: [],
    vfxEvents: [],
    waves: STAGE_WAVES.map(w => ({ ...w, enemies: w.enemies.map(e => ({ ...e })), triggered: false, cleared: false })),
    currentWave: -1,
    cameraX: 0,
    cameraLocked: false,
    phase: 'playing',
    bossSpawned: false,
    score: 0,
    rngSeed: seed,
    rng: makeRng(seed),
    nextActorId: 1,
    nextProjectileId: 1000,
    nextPickupId: 1,
    nextEffectId: 1,
    bloodtallyDecayMs: 0,
    controllers: {},
  };
}
```

`Date.now()` here is fine — `createInitialState` runs once on React mount in the browser, not inside the simulation loop. The *simulation's* purity is about what runs per-tick. A seed chosen once at boot is exactly the kind of input the seeded RNG wants.

- [ ] **Step 4: Also seed `AIState.lungeMs` in `createPlayerActor` and `createEnemyActor`**

In `createPlayerActor` (around line 68) inside the `aiState:` object literal, add `lungeMs: 0,` as a new field at the end:

```ts
    aiState: {
      behavior: 'chaser',
      targetId: null,
      lastActionMs: 0,
      retreating: false,
      packRole: null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
```

Do the same inside `createEnemyActor` (the local one around line 96, in `aiState:`):

```ts
    aiState: {
      behavior: def.ai,
      targetId: null,
      lastActionMs: Math.random() * 600,
      retreating: false,
      packRole: kind === 'wolf' ? (Math.random() > 0.5 ? 'leader' : 'circler') : null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
```

Also do the same inside `ai.ts`'s `spawnEnemyAt` (around line 365):

```ts
    aiState: {
      behavior: def.ai,
      targetId: null,
      lastActionMs: Math.random() * 1000,
      retreating: false,
      packRole: kind === 'wolf' ? (Math.random() > 0.5 ? 'leader' : 'circler') : null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
```

(The `Math.random()` calls in these three blocks survive this task — they get replaced in Tasks 7 and 11.)

- [ ] **Step 5: Fix remaining type errors from Task 3 that are inside this file**

Task 3 left `hitActorIds: new Set()` literals in `simulation.ts`. Find all three locations:

- `fireAbility` projectile creation (around line 318): change `hitActorIds: new Set(),` to `hitActorIds: [],`.
- `grabJustPressed` thrown-pickup projectile (around line 827): change `hitActorIds: new Set(),` to `hitActorIds: [],`.
- Inside `tickProjectiles` (around line 617): change `if (proj.hitActorIds.has(target.id)) continue;` to `if (proj.hitActorIds.includes(target.id)) continue;`.
- Also (around line 634): change `proj.hitActorIds.add(target.id);` to `proj.hitActorIds.push(target.id);`.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: `simulation.ts` errors should now be gone. `ai.ts` still has one `Set` error (`hitActorIds: new Set()` in `spawnProjectile`). Leave it — Task 11 fixes `ai.ts` wholesale.

- [ ] **Step 7: Do NOT commit yet**

`ai.ts` is still broken. Continue to Task 5.

---

## Task 5: Fix `ai.ts` `hitActorIds` to unbreak typecheck

**Files:**
- Modify: `src/simulation/ai.ts`

- [ ] **Step 1: Replace the `Set` literal**

In `src/simulation/ai.ts`, find `spawnProjectile` (around line 99). Change:

```ts
    hitActorIds: new Set(),
```

to:

```ts
    hitActorIds: [],
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. All `Set` / `PlayerController` / `SimState` field errors are now gone.

- [ ] **Step 3: Run the RNG test to confirm no regression**

Run: `npm test`
Expected: 3 passing tests (rng.test.ts).

- [ ] **Step 4: Smoke-test the game still runs**

Run: `npm run dev`, open http://localhost:5173, pick a guild, play for ~30 seconds. Confirm no console errors and gameplay feels identical.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/types.ts src/simulation/simulation.ts src/simulation/ai.ts
git commit -m "refactor(sim): extend SimState with RNG + ID counters + controllers, drop Set<string>"
```

---

## Task 6: Thread RNG into `combat.ts` and lift `effectIdCounter`

**Files:**
- Modify: `src/simulation/combat.ts`
- Modify: `src/simulation/simulation.ts` (call sites)
- Modify: `src/simulation/ai.ts` (call sites)

- [ ] **Step 1: Change signatures in `combat.ts`**

In `src/simulation/combat.ts`:

Remove the top-level `let effectIdCounter = 0;` line (line 5).

Add `SimState` to the type imports (line 1):

```ts
import type { Actor, StatusEffect, StatusEffectType, VFXEvent, DamageType, SimState } from './types';
```

Replace `calcDamage` (keep behavior identical, but route `Math.random` through a passed-in `rng`):

```ts
export function calcDamage(
  ability: { baseDamage: number; scaleStat: keyof Stats | null; scaleAmount: number; damageType: DamageType },
  actorStats: Stats,
  target: Actor,
  isCrit: boolean,
  rng: () => number,
): number {
  const statVal = ability.scaleStat ? actorStats[ability.scaleStat] : 0;
  let dmg = ability.baseDamage + ability.scaleAmount * statVal;

  const isPhysical = ability.damageType === 'physical';
  const isMagical = !isPhysical;

  if (isPhysical) {
    dmg *= 1 - target.armor / (target.armor + 100);
  } else if (isMagical || ability.damageType === 'magical' || ability.damageType === 'shadow' || ability.damageType === 'holy' || ability.damageType === 'psychic' || ability.damageType === 'necrotic' || ability.damageType === 'nature') {
    dmg *= 1 - target.magicResist / (target.magicResist + 100);
  }

  if (isCrit) dmg *= 1.5;
  dmg *= 0.95 + rng() * 0.1;

  return Math.max(1, Math.round(dmg));
}
```

Replace `checkCrit`:

```ts
export function checkCrit(actor: Actor, rng: () => number): boolean {
  let critChance = 0.05;
  actor.statusEffects.forEach(e => {
    if (e.type === 'bless') critChance += 0.15;
  });
  return rng() < critChance;
}
```

Replace `addStatusEffect` to take `state` and use `state.nextEffectId`:

```ts
export function addStatusEffect(
  state: SimState,
  target: Actor,
  type: StatusEffectType,
  magnitude: number,
  durationMs: number,
  source: string,
): void {
  const existing = target.statusEffects.find(e => e.type === type && e.source === source);
  if (existing) {
    existing.remainingMs = Math.max(existing.remainingMs, durationMs);
    existing.magnitude = Math.max(existing.magnitude, magnitude);
    return;
  }
  const effect: StatusEffect = {
    id: `fx_${state.nextEffectId++}`,
    type,
    magnitude,
    durationMs,
    remainingMs: durationMs,
    source,
  };
  target.statusEffects.push(effect);
}
```

- [ ] **Step 2: Update every `checkCrit` / `calcDamage` / `addStatusEffect` call site in `simulation.ts`**

Search `simulation.ts` for each function name and update arguments.

For `calcDamage`, add `state.rng` as the final arg at all call sites:
- `fireAbility` projectile damage (around line 307): `calcDamage(ability, player.stats, state.enemies[0] || player, false, state.rng)`
- `fireAbility` AoE block (around line 332): `calcDamage(ability, player.stats, target, isCrit, state.rng)`
- `fireAbility` single-target block (around line 348): `calcDamage(ability, player.stats, target, isCrit, state.rng)`

For `checkCrit`, add `state.rng`:
- `fireAbility` AoE (around line 331): `checkCrit(player, state.rng)`
- `fireAbility` single-target (around line 347): `checkCrit(player, state.rng)`
- `performBasicAttack` (around line 469): `checkCrit(player, state.rng)` — note: this function doesn't currently take `state`, but it's called from `handlePlayerInput(state, ...)`. Add `state` as the second parameter of `performBasicAttack` and thread it in. Update its call (around line 794) to pass `state`:

```ts
// Change signature:
function performBasicAttack(player: Actor, state: SimState, ctrl: PlayerController, isRunAttack: boolean, isJumpAttack: boolean): void {
```

(It already takes `state` — confirm by re-reading. If it does, just update the `checkCrit` call inside it.)

For `addStatusEffect`, insert `state` as the first arg at all call sites:
- `fireAbility` teleport stealth (around line 278): `addStatusEffect(state, player, 'stealth', 1, ability.effects.stealth.durationMs, player.id)`
- `fireAbility` effects loop (around line 361): `addStatusEffect(state, player, etype as any, edata.magnitude, edata.durationMs, player.id)`
- `applyEffects` (around line 411): this function receives `_state` as a parameter today — rename to `state` (drop the underscore) and pass it to `addStatusEffect`:

```ts
function applyEffects(ability: AbilityDef, target: Actor, source: Actor, state: SimState): void {
  for (const [etype, edata] of Object.entries(ability.effects)) {
    if (!edata) continue;
    const effectType = etype as any;
    if (effectType === 'speed_boost' || effectType === 'damage_boost' || effectType === 'shield' || effectType === 'lifesteal' || effectType === 'damage_reduction') continue;
    addStatusEffect(state, target, effectType, edata.magnitude, edata.durationMs, source.id);
  }
}
```

Update `applyEffects` call sites in `simulation.ts` to pass `state` (it already does — search for `applyEffects(`; they were passing `state` already despite the parameter being named `_state`).

- Parry stun (around line 736): `addStatusEffect(state, e, 'stun', 1, 500, player.id)`
- `tickProjectiles` effects loop (around line 626): `addStatusEffect(state, target, etype as any, edata.magnitude, edata.durationMs, proj.ownerId)`

- [ ] **Step 3: Update `addStatusEffect` call sites in `ai.ts`**

`tickStatusEffects` in combat.ts does not call `addStatusEffect`, so combat.ts internal calls are unchanged.

In `ai.ts`:
- `tickBossAI` phase-2 stun (around line 298): `addStatusEffect(state, t, 'stun', 1, 800, actor.id)`

`tickAI` already takes `state` as its second parameter. If any helper called from it doesn't, thread `state` through. Check `tickBossAI`'s signature — it takes `state` at position 3, fine.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. If not, fix the missing `state` / `rng` arguments until it does.

- [ ] **Step 5: Run existing tests**

Run: `npm test`
Expected: 3 passing (rng).

- [ ] **Step 6: Smoke-test**

Run `npm run dev`, play for a few seconds, confirm combat and status effects still work, stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/combat.ts src/simulation/simulation.ts src/simulation/ai.ts
git commit -m "refactor(sim): thread state.rng + state.nextEffectId through combat helpers"
```

---

## Task 7: Replace remaining `Math.random()` in `simulation.ts`

After Task 6, `combat.ts` calls no longer roll internally — but `simulation.ts` still has direct `Math.random()` calls that need to move to `state.rng()`.

**Files:**
- Modify: `src/simulation/simulation.ts`

- [ ] **Step 1: Enumerate and replace**

Open `src/simulation/simulation.ts`. Every `Math.random()` call inside this file becomes `state.rng()`. Sites (use your editor's search to find the current line numbers):

- `createEnemyActor` `aiState.lastActionMs: Math.random() * 600` — this is tricky because `createEnemyActor` doesn't see `state`. Solution: add a `rng: () => number` parameter:

```ts
function createEnemyActor(kind: string, x: number, y: number, rng: () => number): Actor {
```

Replace the two `Math.random()` calls inside:

```ts
      lastActionMs: rng() * 600,
      retreating: false,
      packRole: kind === 'wolf' ? (rng() > 0.5 ? 'leader' : 'circler') : null,
```

Update its call site in `tickWaves` (around line 589): `const enemy = createEnemyActor(spawn.kind as string, spawnX, spawnY, state.rng);`

- `tickWaves` spawn Y scatter (around line 583):

```ts
const spawnY = ENEMY_SPAWN_Y_RANGE[0] + state.rng() * (ENEMY_SPAWN_Y_RANGE[1] - ENEMY_SPAWN_Y_RANGE[0]);
```

`tickWaves` already takes `state` — no signature change needed.

- `performBasicAttack` damage variance (around line 454):

```ts
const baseDmg = Math.round((10 + baseStr * 0.5) * dmgMult * (0.95 + state.rng() * 0.1));
```

`performBasicAttack` receives `state` after Task 6 — confirm.

- `tickProjectiles` crit roll (around line 621):

```ts
const isCrit = state.rng() < 0.05;
```

`tickProjectiles` already takes `state` — no change.

- `handlePlayerInput` leper miasma gate (around line 908):

```ts
applyDamage(t, Math.max(1, Math.round(dotDmg * (state.rng() > 0.9 ? 1 : 0))), state.vfxEvents, false);
```

- `spawnPickup` drop roll AND id random (around line 931-933). The drop roll becomes `state.rng()`; the id becomes a counter (see Task 8):

```ts
// The drop roll:
if (def.dropWeapon && state.rng() < def.dropWeaponChance) {
```

The id string `` `pickup_${Date.now()}_${Math.random()}` `` is addressed in Task 8 — leave it as-is for now so this task stays focused on `Math.random`.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify no `Math.random` remains for behavior rolls**

Run:

```bash
grep -n "Math\.random" src/simulation/simulation.ts
```

Expected: the only remaining hit is inside `spawnPickup` at the pickup-id line (`${Math.random()}`). That one is addressed in Task 8. All rolls influencing gameplay behavior should be gone.

- [ ] **Step 4: Smoke-test**

Run `npm run dev`, play for a few seconds. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/simulation.ts
git commit -m "refactor(sim): route Math.random through state.rng in simulation.ts"
```

---

## Task 8: Replace `Date.now()` IDs and lift `actorIdCounter` / `state_timeTracker`

**Files:**
- Modify: `src/simulation/simulation.ts`

- [ ] **Step 1: Delete module-level `actorIdCounter` and the `nextId` helper**

In `src/simulation/simulation.ts`, delete:

```ts
let actorIdCounter = 1;

function nextId(): string {
  return `actor_${actorIdCounter++}`;
}
```

- [ ] **Step 2: Thread actor id generation through state**

`createEnemyActor` (still the local one) is the sole consumer of `nextId()`. Add `state` as a parameter and use `state.nextActorId++`:

```ts
function createEnemyActor(kind: string, x: number, y: number, state: SimState): Actor {
  const def = ENEMY_DEFS[kind];
  if (!def) throw new Error(`Unknown enemy: ${kind}`);

  return {
    id: `actor_${state.nextActorId++}`,
    // ...rest unchanged, except the aiState uses state.rng per Task 7
```

Replace the `rng` parameter you added in Task 7 with `state` (which exposes `state.rng`). Update the two `aiState` lines inside to use `state.rng()` directly:

```ts
      lastActionMs: state.rng() * 600,
      retreating: false,
      packRole: kind === 'wolf' ? (state.rng() > 0.5 ? 'leader' : 'circler') : null,
```

Update the call site in `tickWaves`: `const enemy = createEnemyActor(spawn.kind as string, spawnX, spawnY, state);`

- [ ] **Step 3: Replace the three `Date.now()` id strings**

In `fireAbility` projectile (around line 298):

```ts
const proj: Projectile = {
  id: `proj_${state.nextProjectileId++}`,
  // i-index suffix no longer needed — each iteration bumps the counter
```

Remove the inner `for` loop's dependence on the literal `i` in the id; the counter bump differentiates them.

In `handlePlayerInput` thrown-pickup projectile (around line 807):

```ts
const proj: Projectile = {
  id: `proj_${state.nextProjectileId++}`,
```

In `spawnPickup` (around line 933):

```ts
state.pickups.push({
  id: `pickup_${state.nextPickupId++}`,
  // ...
});
```

- [ ] **Step 4: Lift `state_timeTracker` to `state.bloodtallyDecayMs`**

In `src/simulation/simulation.ts`:

Delete the `let state_timeTracker = 0;` declaration (around line 543).

In `tickPlayerResourceRegen` (the `champion` branch around line 530), replace `state_timeTracker` with `state.bloodtallyDecayMs`:

```ts
if (player.guildId === 'champion') {
  if (!inCombat && (player.bloodtally || 0) > 0) {
    if (state.bloodtallyDecayMs >= 15000) {
      player.bloodtally = Math.max(0, (player.bloodtally || 0) - 1);
      player.mp = player.bloodtally;
      state.bloodtallyDecayMs = 0;
    }
  }
  return;
}
```

`tickPlayerResourceRegen` does not currently take `state` — change its signature:

```ts
function tickPlayerResourceRegen(player: Actor, dtMs: number, inCombat: boolean, state: SimState): void {
```

Update the call site in `tickSimulation` (around line 970): `tickPlayerResourceRegen(state.player, dtMs, inCombat, state);`

In `tickSimulation`, replace the `state_timeTracker += dtMs;` line (around line 956) with:

```ts
state.bloodtallyDecayMs += dtMs;
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Smoke-test with champion guild**

Run `npm run dev`, pick Champion, land a killing blow to trigger a bloodtally gain, walk away from combat and confirm the tally decays as before. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/simulation.ts
git commit -m "refactor(sim): lift actorIdCounter + state_timeTracker + pickup/projectile IDs onto SimState"
```

---

## Task 9: Kill `setTimeout` dodge recovery

**Files:**
- Modify: `src/simulation/simulation.ts`

The current code at around line 759 calls `setTimeout` to end a dodge. Replace it with a `ctrl.dodgeMs` countdown ticked in `handlePlayerInput`.

- [ ] **Step 1: Replace the `setTimeout` block in the dodge branch**

In `handlePlayerInput`, find:

```ts
if (input.rightJustPressed || input.leftJustPressed) {
  player.state = 'dodging';
  player.invulnerableMs = DODGE_INVULN_MS;
  const dodgeDir = input.rightJustPressed ? 1 : -1;
  player.vx = dodgeDir * (DODGE_DISTANCE / (DODGE_DURATION_MS / 1000));
  player.animationId = 'dodge';
  setTimeout(() => {
    if (player.state === 'dodging') {
      player.state = 'idle';
      player.vx = 0;
    }
  }, DODGE_DURATION_MS);
  return;
}
```

Replace with:

```ts
if (input.rightJustPressed || input.leftJustPressed) {
  player.state = 'dodging';
  player.invulnerableMs = DODGE_INVULN_MS;
  const dodgeDir = input.rightJustPressed ? 1 : -1;
  player.vx = dodgeDir * (DODGE_DISTANCE / (DODGE_DURATION_MS / 1000));
  player.animationId = 'dodge';
  ctrl.dodgeMs = DODGE_DURATION_MS;
  return;
}
```

- [ ] **Step 2: Add dodge-recovery tick at the top of `handlePlayerInput`**

At the very top of `handlePlayerInput`, after `if (!player.isAlive) return;`, insert:

```ts
if (player.state === 'dodging') {
  ctrl.dodgeMs -= dtMs;
  if (ctrl.dodgeMs <= 0) {
    ctrl.dodgeMs = 0;
    player.state = 'idle';
    player.vx = 0;
  }
  return;
}
```

This matches the original callback's check (`if (player.state === 'dodging')`) with a tick-driven equivalent. Returning early during the dodge matches the `setTimeout` version's implicit "input doesn't do anything while dodging" — the original code never re-entered `handlePlayerInput`'s logic during the `DODGE_DURATION_MS` window either, because the dodge branch returned and the next frame's dodge-branch would just re-set values (most of them no-ops).

- [ ] **Step 3: Run typecheck + smoke test**

Run: `npm run typecheck` — expect PASS.

Run: `npm run dev`, in-game dodge using block+direction, confirm the dodge ends after the same duration and the player returns to idle. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/simulation/simulation.ts
git commit -m "refactor(sim): replace setTimeout dodge recovery with dodgeMs countdown"
```

---

## Task 10: Lift `controllers` Map onto `SimState` and update `GameScreen.tsx`

**Files:**
- Modify: `src/simulation/simulation.ts`
- Modify: `src/screens/GameScreen.tsx`

- [ ] **Step 1: Delete the module-level `controllers` Map**

In `src/simulation/simulation.ts`, delete:

```ts
const controllers = new Map<string, PlayerController>();
```

- [ ] **Step 2: Update `getOrCreateController` and `resetController` signatures**

Replace both functions:

```ts
export function getOrCreateController(state: SimState, playerId: string, input: InputState): PlayerController {
  let ctrl = state.controllers[playerId];
  if (!ctrl) {
    ctrl = {
      input,
      comboBuffer: createComboBuffer(),
      lastAttackMs: 0,
      blockingMs: 0,
      dodgeMs: 0,
      parryWindowMs: 0,
      channelMs: 0,
      channelingAbility: null,
      groundTargetX: 500,
      groundTargetY: 220,
      attackChain: 0,
      runningDir: 0,
    };
    state.controllers[playerId] = ctrl;
  }
  ctrl.input = input;
  return ctrl;
}

export function resetController(state: SimState, playerId: string): void {
  delete state.controllers[playerId];
}
```

- [ ] **Step 3: Update the `tickSimulation` call site**

Inside `tickSimulation`, replace `const ctrl = getOrCreateController('player', input);` with:

```ts
const ctrl = getOrCreateController(state, 'player', input);
```

- [ ] **Step 4: Update `GameScreen.tsx`**

In `src/screens/GameScreen.tsx`:

Find the mount-effect body (`resetController('player');` at line 84). Replace with:

```ts
stateRef.current = createInitialState(guildId);
comboBufferRef.current = createComboBuffer();
resetController(stateRef.current, 'player');
bossWasMusicStarted.current = false;
```

Find the cleanup's `resetController('player');` (line 169). Replace with:

```ts
resetController(stateRef.current, 'player');
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Smoke-test — retry after defeat**

Run `npm run dev`. Play until defeat, click retry, confirm combat feels fresh (no stale input state bleeding through). Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/simulation.ts src/screens/GameScreen.tsx
git commit -m "refactor(sim): lift controllers Map onto SimState, update GameScreen mount/cleanup"
```

---

## Task 11: Purify `ai.ts` — `Math.random`, `Date.now`, `projIdCounter`, `setTimeout`

**Files:**
- Modify: `src/simulation/ai.ts`

- [ ] **Step 1: Delete the module-level `projIdCounter`**

In `src/simulation/ai.ts`, delete:

```ts
let projIdCounter = 1000;
```

- [ ] **Step 2: Thread `state.rng` and `state.nextProjectileId` through `spawnProjectile`**

Replace `spawnProjectile`:

```ts
function spawnProjectile(state: SimState, actor: Actor, target: Actor, damage: number, speed: number, range: number): void {
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const dist = Math.hypot(dx, dy) || 1;
  const proj: Projectile = {
    id: `proj_${state.nextProjectileId++}`,
    ownerId: actor.id,
    team: actor.team,
    x: actor.x,
    y: actor.y,
    z: actor.z + 20,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    vz: 0,
    damage,
    damageType: 'physical',
    range,
    traveled: 0,
    radius: 8,
    knockdown: false,
    knockbackForce: 0,
    effects: {},
    piercing: false,
    color: '#d97706',
    type: 'arrow',
    hitActorIds: [],
  };
  state.projectiles.push(proj);
}
```

Update its call site inside `tickArcherAI` (around line 174). The first arg `_state` must become `state` (drop the underscore so the variable name is in scope and matches, or just pass `_state` — but the convention in this file is `_state` for "state threaded through but unused"; for the spawnProjectile call it is used). The simplest fix is to rename the parameter of `tickArcherAI` from `_state` to `state`:

```ts
function tickArcherAI(actor: Actor, target: Actor, state: SimState, _dtSec: number, _vfxEvents: VFXEvent[], speed: number, dist: number, dx: number, dy: number): void {
  // ...
  if (actor.aiState.lastActionMs >= def.attackCooldownMs && Math.abs(dy) <= 30) {
    actor.aiState.lastActionMs = 0;
    actor.animationId = 'attack_1';
    spawnProjectile(state, actor, target, def.damage, def.projectileSpeed || 400, def.projectileRange || 350);
  }
}
```

The call site in `tickAI` already passes `state` as the third argument (`tickArcherAI(actor, target, state, dtSec, vfxEvents, speed, dist, dx, dy)` — verify by reading line 58).

- [ ] **Step 3: Kill the boss-lunge `setTimeout` with `AIState.lungeMs`**

In `tickBossAI` (around line 284), replace:

```ts
if (currentPhase >= 1 && Math.random() < 0.3) {
  actor.vx = actor.facing * speed * 3;
  setTimeout(() => { actor.vx = 0; }, 300);
}
```

with:

```ts
if (currentPhase >= 1 && state.rng() < 0.3) {
  actor.vx = actor.facing * speed * 3;
  ai.lungeMs = 300;
}
```

And at the top of `tickBossAI`, after the `currentPhase` calculation block, add a lunge tick:

```ts
if (ai.lungeMs > 0) {
  ai.lungeMs = Math.max(0, ai.lungeMs - dtSec * 1000);
  if (ai.lungeMs === 0) {
    actor.vx = 0;
  }
}
```

Place this block just after the `if (currentPhase !== actor.bossPhase)` transition block but before the `if (dist > 90)` movement decision, so the boss's `vx` gets cleared before movement code sees it.

- [ ] **Step 4: Replace the remaining `Math.random` and `Date.now` in `ai.ts`**

Go through `ai.ts` and replace each remaining `Math.random()` with `state.rng()`. Helpers that currently take `_state` need their underscore removed so the variable is usable:

- `tryMeleeAttack` (around line 94): `applyDamage(target, damage + Math.round(state.rng() * 4), vfxEvents);` — this requires adding `state: SimState` to its parameter list. Update the four call sites:
  - `tickChaserAI` (line 148): `tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs, vfxEvents);`
  - `tickPackerAI` leader (line 200): `tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs, vfxEvents);`
  - `tickPackerAI` circler (line 212): `tryMeleeAttack(state, actor, target, def.damage, def.attackCooldownMs + 500, vfxEvents);`

And rename `_state` → `state` on these helpers: `tickChaserAI`, `tickPackerAI`, `tickBruteAI`. Their call sites in the switch in `tickAI` already pass `state`.

- `tickBossAI` AoE crit (around line 293): `if (currentPhase >= 2 && state.rng() < 0.3) {`

- `spawnBanditMinion` (around line 320): uses two `Math.random()` calls. Signature change — add `state`:

```ts
function spawnBanditMinion(state: SimState, boss: Actor): void {
  spawnEnemyAt(state, 'plains_bandit', boss.x + (state.rng() > 0.5 ? 150 : -150), boss.y + (state.rng() - 0.5) * 100);
}
```

Update its call in `tickBossAI` (around line 305): `spawnBanditMinion(state, actor);`

- `spawnEnemyAt` (around line 328) — replace the `Date.now()` id and the two `Math.random` calls:

```ts
function spawnEnemyAt(state: SimState, kind: string, x: number, y: number): void {
  const def = ENEMY_DEFS[kind];
  if (!def) return;

  const newEnemy: Actor = {
    id: `actor_${state.nextActorId++}`,
    // ... unchanged through `invulnerableMs: 0,` ...
    heldPickup: null,
    aiState: {
      behavior: def.ai,
      targetId: null,
      lastActionMs: state.rng() * 1000,
      retreating: false,
      packRole: kind === 'wolf' ? (state.rng() > 0.5 ? 'leader' : 'circler') : null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
    // ... rest unchanged
  };

  state.enemies.push(newEnemy);
}
```

- [ ] **Step 5: Verify no forbidden calls remain in `ai.ts`**

Run:

```bash
grep -nE "Math\.random|Date\.now|setTimeout|setInterval" src/simulation/ai.ts
```

Expected: zero matches.

Also verify `simulation.ts`:

```bash
grep -nE "Math\.random|Date\.now|setTimeout|setInterval" src/simulation/simulation.ts
```

Expected: one match — the `seed: number = Date.now()` default in `createInitialState`. That call is *outside* the simulation tick and is the designated seed source; it's expected. Everything else should be gone.

Also check `combat.ts`:

```bash
grep -nE "Math\.random|Date\.now|setTimeout|setInterval" src/simulation/combat.ts
```

Expected: zero matches.

- [ ] **Step 6: Typecheck + smoke test (boss fight)**

Run: `npm run typecheck` — expect PASS.

Run `npm run dev`, play through to the boss, trigger lunge + AoE stun + phase transitions. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/ai.ts
git commit -m "refactor(sim): purify ai.ts — state.rng, state.next*Id, lungeMs countdown"
```

---

## Task 12: Golden-state test

**Files:**
- Create: `src/simulation/__tests__/golden.test.ts`

- [ ] **Step 1: Write the test**

Create `src/simulation/__tests__/golden.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, SimState } from '../types';

function emptyInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false, jumpJustPressed: false,
    attackJustPressed: false, blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
  };
}

function stripFunctions(state: SimState): Omit<SimState, 'rng'> {
  const { rng: _rng, ...rest } = state;
  return rest;
}

function scriptedRun(frames: number, seed: number): Omit<SimState, 'rng'> {
  let state = createInitialState('knight', seed);
  for (let i = 0; i < frames; i++) {
    const input = emptyInput();
    // Every 30 frames, press right; every 60, attack.
    if (i % 30 === 0) { input.right = true; input.rightJustPressed = true; }
    if (i % 60 === 0) { input.attack = true; input.attackJustPressed = true; }
    state = tickSimulation(state, input, 16);
  }
  return stripFunctions(state);
}

describe('golden-state reproducibility', () => {
  it('produces identical SimState for the same seed + same inputs', () => {
    const a = scriptedRun(600, 987654321);
    const b = scriptedRun(600, 987654321);
    expect(a).toEqual(b);
  });

  it('produces different SimState for different seeds', () => {
    const a = scriptedRun(600, 1);
    const b = scriptedRun(600, 2);
    expect(a).not.toEqual(b);
  });
});
```

`rng` is stripped because `(a: () => number) === (b: () => number)` is false for two separately-constructed functions even if they produce identical output. The rest of `SimState` is serializable by this point, and deep equality over it is what the purity guarantee boils down to.

- [ ] **Step 2: Run the test**

Run: `npm test`
Expected: 5 passing tests total (3 rng + 2 golden).

If the reproducibility test fails, the most likely cause is a remaining `Math.random` or `Date.now` in a tick code path. Re-run the greps from Task 11 Step 5 and fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/simulation/__tests__/golden.test.ts
git commit -m "test(sim): golden-state reproducibility test"
```

---

## Task 13: ESLint gate

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add the simulation override**

Replace `eslint.config.js` entirely:

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/simulation/**/*.ts'],
    ignores: ['src/simulation/**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'simulation must stay portable to Node — do not reference window.' },
        { name: 'document', message: 'simulation must stay portable to Node — do not reference document.' },
        { name: 'localStorage', message: 'simulation must stay portable to Node — do not reference localStorage.' },
        { name: 'setTimeout', message: 'simulation must be tick-driven — replace with a countdown field on state or a controller.' },
        { name: 'setInterval', message: 'simulation must be tick-driven — replace with a countdown field on state or a controller.' },
        { name: 'Date', message: 'simulation must be deterministic — read time from state.timeMs, not Date.' },
        { name: 'performance', message: 'simulation must be deterministic — read time from state.timeMs, not performance.now().' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'simulation must be deterministic — use state.rng() instead of Math.random().',
        },
      ],
    },
  }
);
```

The `createInitialState` function uses `Date.now()` as the default seed — but that is outside the tick loop, and the lint target is `src/simulation/**`. The `seed: number = Date.now()` default parameter is a global-name reference (`Date`) and will trip `no-restricted-globals`. Handle this one place with an inline disable:

In `src/simulation/simulation.ts`, find:

```ts
export function createInitialState(guildId: GuildId, seed: number = Date.now()): SimState {
```

Change to:

```ts
// eslint-disable-next-line no-restricted-globals -- seed is chosen once at boot, outside the tick loop
export function createInitialState(guildId: GuildId, seed: number = Date.now()): SimState {
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS, exit 0. If there are unexpected violations, they are real bugs — fix them (do not add more disables).

- [ ] **Step 3: Verify the lint rules actually fire**

Temporarily add to `src/simulation/simulation.ts`:

```ts
const _sink = Math.random();
```

Run: `npm run lint`
Expected: FAIL with `simulation must be deterministic — use state.rng() instead of Math.random().`

Remove the line. Run `npm run lint` again — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js src/simulation/simulation.ts
git commit -m "chore(lint): ban Math.random/Date/setTimeout/DOM globals in src/simulation/**"
```

---

## Task 14: Update `CLAUDE.md` and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Commands section**

In `CLAUDE.md`, find the Commands block:

```
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build to dist/
npm run preview    # Serve the built dist/
npm run lint       # ESLint (flat config, eslint.config.js)
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
```

Replace with:

```
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build to dist/
npm run preview    # Serve the built dist/
npm run lint       # ESLint (flat config, eslint.config.js)
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
npm test           # Vitest run (src/**/*.test.ts)
npm run test:watch # Vitest watch mode
```

Also replace the line:

> There is no test runner configured; do not fabricate a `test` script.

with:

> Tests run via Vitest. `src/simulation/__tests__/golden.test.ts` is the reproducibility gate — if it fails after a change in `src/simulation/**`, you have introduced non-determinism and the Colyseus rewrite (see `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md`) will be harder. Keep it green.

- [ ] **Step 2: Update the simulation architecture bullet**

Find the `**src/simulation/**` bullet in the Architecture section. It currently says:

> pure TypeScript. Combat, AI, physics, wave progression, status effects, HP/MP, combo detection. **No DOM, no canvas, no `window`, no browser APIs.** It must remain portable to a Node server. Anything non-deterministic other than `Math.random()` is a bug here.

Change the last sentence to:

> Nothing non-deterministic is permitted — no `Math.random()`, no `Date.now()`, no `setTimeout`, no module-level mutable counters. Use `state.rng()` for rolls, tick-based countdown fields for timers, and `state.next*Id` counters for IDs. The ESLint override on `src/simulation/**` enforces this.

- [ ] **Step 3: Update the game loop section's `resetController` reference**

Find:

> `resetController('player')` is called on mount and cleanup

Change to:

> `resetController(stateRef.current, 'player')` is called on mount and cleanup

- [ ] **Step 4: Run the full verification stack**

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Each should exit 0.

- [ ] **Step 5: End-to-end manual smoke test**

Run `npm run dev`. Play a full round:
1. Pick each of a melee guild, a caster guild, and champion — confirm resource mechanics (chi orbs, sanity, bloodtally decay) still work.
2. Trigger a dodge (block + direction) and confirm it completes cleanly.
3. Reach the boss and survive one phase transition; observe a lunge.
4. Die or win; retry; confirm no stale input/controller state carries over.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 1 (Vitest, simulation purity rules)"
```

- [ ] **Step 7: Final log review**

```bash
git log --oneline -15
```

Expected: ~14 new commits on the current branch, each scoped to one step of the plan. If any commits are broken (typecheck fails at that SHA), note them — but do NOT rewrite history without checking with the user.

---

## Spec coverage check

Cross-referencing against `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md` Phase 1:

| Spec section | Task(s) |
|---|---|
| 1. Kill setTimeout (simulation.ts:759 dodge) | Task 9 |
| 1. Kill setTimeout (ai.ts:286 boss lunge) | Task 11 |
| 2. Deterministic IDs — Date.now in simulation.ts (:298, :807, :933) | Task 8 |
| 2. Deterministic IDs — Date.now in ai.ts:328 | Task 11 |
| 2. Module-level counters — actorIdCounter | Task 8 |
| 2. Module-level counters — effectIdCounter | Task 6 |
| 2. Module-level counters — projIdCounter | Task 11 |
| 2. Module-level counters — state_timeTracker | Task 8 |
| 3. Lift `controllers` Map | Task 10 |
| 4. Seeded RNG + ~15 Math.random sites | Tasks 2 (RNG module), 6 (combat), 7 (simulation), 11 (ai) |
| 5. Non-serializable fields (Projectile.hitActorIds) | Tasks 3, 4, 5, 11 |
| 6. Lint gate (both no-restricted-globals and no-restricted-syntax) | Task 13 |
| 7. Golden-state reproducibility test | Task 12 |
| Done-when: CLAUDE.md update | Task 14 |
| Done-when: typecheck + lint + golden test pass | Task 14 Step 4 |
| Done-when: subjectively indistinguishable play | Task 14 Step 5 |
