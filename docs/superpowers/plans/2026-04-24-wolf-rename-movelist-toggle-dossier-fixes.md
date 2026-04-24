# Wolf Rename + MoveList Toggle + Dossier Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename bear→wolf across simulation; add druid/wolf form toggle in MoveList; normalize sprite preview sizes in dossier; add leper VFX in AbilityPreview.

**Architecture:** Four independent change groups. Tasks 1–3 are sequential (rename first, then UI that imports renamed symbols). Tasks 4 and 5 are independent of Tasks 1–3 and of each other.

**Tech Stack:** TypeScript, React, Vitest, Phaser 3

---

### Task 1: Rename bear→wolf in shared simulation + tests

**Files:**
- Modify: `packages/shared/src/simulation/guildData.ts` (lines 730–776)
- Modify: `packages/shared/src/simulation/types.ts` (lines 44–45, 209)
- Modify: `packages/shared/src/simulation/simulation.ts` (lines 5, 95–113, 875–881, 1388–1420)
- Modify: `packages/shared/src/simulation/__tests__/druidBear.test.ts`

- [ ] **Step 1.1: Update guildData.ts — rename exports and ability IDs**

In `guildData.ts`, change:
- `export const DRUID_BEAR_ABILITIES` → `export const DRUID_WOLF_ABILITIES`
- `export const DRUID_BEAR_RMB` → `export const DRUID_WOLF_RMB`
- `id: 'bear_maul'` → `id: 'wolf_maul'`
- `id: 'bear_charge'` → `id: 'wolf_charge'`
- `id: 'bear_roar'` → `id: 'wolf_roar'`
- `id: 'bear_rend'` → `id: 'wolf_rend'`
- `id: 'bear_primal_fury'` → `id: 'wolf_primal_fury'`
- `id: 'bear_revert'` → `id: 'wolf_revert'` (both in DRUID_WOLF_RMB)

Also update the `description` of `bear_revert` from 'Exit bear form, restore stats' → 'Exit wolf form, restore stats'.

- [ ] **Step 1.2: Update types.ts — remove 'bear' from unions**

Change line 209:
```typescript
shapeshiftForm?: 'none' | 'bear' | 'wolf';
```
→
```typescript
shapeshiftForm?: 'none' | 'wolf';
```

Change line 45 (ActorKind) — remove `'bear_form'` (keep `'wolf_form'`):
```typescript
| 'wolf_pet' | 'drowned_spawn' | 'rotting_husk' | 'wolf_form';
```
(Remove `'bear_form'` from the union entirely.)

- [ ] **Step 1.3: Update simulation.ts — rename functions and update all references**

1. Import line 5: `DRUID_BEAR_ABILITIES, DRUID_BEAR_RMB` → `DRUID_WOLF_ABILITIES, DRUID_WOLF_RMB`
2. `export function enterBearForm` → `export function enterWolfForm`
3. Inside `enterWolfForm`: `actor.kind = 'bear_form'` → `actor.kind = 'wolf_form'`; `actor.shapeshiftForm = 'bear'` → `actor.shapeshiftForm = 'wolf'`
4. `export function revertBearForm` → `export function revertWolfForm`
5. Inside `revertWolfForm`: `e.source === 'bear_form'` → `e.source === 'wolf_form'`
6. Line 874: `enterBearForm(player)` → `enterWolfForm(player)`
7. Line 875: `addStatusEffect(state, player, 'damage_boost', 0.3, 999999, 'bear_form')` → `'wolf_form'`
8. Line 879: `ability.id === 'bear_revert'` → `ability.id === 'wolf_revert'`
9. Line 880: `revertBearForm(player)` → `revertWolfForm(player)`
10. Line 1388: `player.shapeshiftForm === 'bear' || player.shapeshiftForm === 'wolf'` → `player.shapeshiftForm === 'wolf'`
11. Lines 1389–1391: `DRUID_BEAR_RMB` → `DRUID_WOLF_RMB`; `DRUID_BEAR_ABILITIES` → `DRUID_WOLF_ABILITIES`
12. Line 1405: `player.shapeshiftForm === 'bear'` → `player.shapeshiftForm === 'wolf'`
13. Lines 1406–1407: `DRUID_BEAR_ABILITIES` → `DRUID_WOLF_ABILITIES`; `DRUID_BEAR_RMB` → `DRUID_WOLF_RMB`
14. Line 1420: `player.shapeshiftForm === 'bear' ? DRUID_BEAR_RMB` → `player.shapeshiftForm === 'wolf' ? DRUID_WOLF_RMB`

- [ ] **Step 1.4: Update druidBear.test.ts — update imports and expectations**

Change import line 2:
```typescript
import { createPlayerActor, enterWolfForm, revertWolfForm } from '../simulation';
```

Change all `enterBearForm(druid)` → `enterWolfForm(druid)`, `revertBearForm(druid)` → `revertWolfForm(druid)`.

Change expected values:
- `expect(druid.shapeshiftForm).toBe('bear')` → `.toBe('wolf')`
- `expect(druid.kind).toBe('bear_form')` → `.toBe('wolf_form')`

- [ ] **Step 1.5: Run tests and typecheck**

```bash
npm run typecheck && npm test
```

Expected: all tests pass, no TS errors.

- [ ] **Step 1.6: Commit**

```bash
git add packages/shared/src/simulation/guildData.ts packages/shared/src/simulation/types.ts packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/druidBear.test.ts
git commit -m "refactor: rename bear form → wolf form across simulation"
```

---

### Task 2: MoveList druid/wolf toggle + updated guildMeta bio

**Files:**
- Modify: `src/screens/MoveList.tsx`
- Modify: `src/data/guildMeta.ts`

- [ ] **Step 2.1: Update MoveList.tsx imports and add druidForm state**

Change import line 2:
```typescript
import { GUILDS, DRUID_WOLF_ABILITIES, DRUID_WOLF_RMB } from '@nannymud/shared/simulation/guildData';
```

Add state variable after the existing `sel` state:
```typescript
const [druidForm, setDruidForm] = useState<'druid' | 'wolf'>('druid');
useEffect(() => { setDruidForm('druid'); }, [sel]);
```

- [ ] **Step 2.2: Replace the druid bear section with the toggle UI**

Replace the entire `{sel === 'druid' && ...}` block (lines 146–159) with:

```tsx
{sel === 'druid' && (
  <>
    <div style={{ display: 'flex', gap: 8 }}>
      {(['druid', 'wolf'] as const).map((form) => (
        <button
          key={form}
          type="button"
          onClick={() => setDruidForm(form)}
          style={{
            appearance: 'none',
            border: `1px solid ${druidForm === form ? accent : theme.lineSoft}`,
            background: druidForm === form ? `${accent}18` : theme.panel,
            color: druidForm === form ? accent : theme.inkDim,
            fontFamily: theme.fontMono,
            fontSize: 11,
            letterSpacing: 3,
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          {form === 'druid' ? 'DRUID FORM' : 'WOLF FORM'}
        </button>
      ))}
    </div>

    <SectionLabel
      kicker={druidForm === 'druid' ? 'ABILITIES' : 'WOLF FORM'}
      right={`${druidForm === 'druid' ? guild.abilities.length : DRUID_WOLF_ABILITIES.length} + 6`}
    >
      {druidForm === 'druid' ? 'Combat moves' : 'Abilities while shapeshifted'}
    </SectionLabel>

    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <MoveHeader />
      {druidForm === 'druid'
        ? guild.abilities.map((a, i) => (
            <MoveRow key={a.id} slot={SLOT_LABELS[i]} ability={a} accent={accent} guildId={sel} abilityIndex={i} />
          ))
        : DRUID_WOLF_ABILITIES.map((a, i) => (
            <MoveRow key={a.id} slot={SLOT_LABELS[i]} ability={a} accent={accent} guildId={sel} abilityIndex={i} />
          ))}
      <MoveRow
        slot="6"
        ability={druidForm === 'druid' ? guild.rmb : DRUID_WOLF_RMB}
        accent={accent}
        guildId={sel}
        abilityIndex={-1}
      />
    </div>
  </>
)}
```

Also remove the existing druid abilities table that was rendered unconditionally before the old bear section (lines 138–144), since the toggle now handles both forms. Replace those lines with the toggle block above — the toggle renders both druid AND wolf ability tables depending on selection, so the non-druid guild rendering at lines 138–144 should remain as-is (it only runs when `sel !== 'druid'`). For druid, the toggle section renders everything.

Concretely, the druid-selected path should NOT render the unconditional ability table. Wrap lines 138–144 in `{sel !== 'druid' && ...}` so only non-druid guilds use the flat table.

- [ ] **Step 2.3: Update guildMeta.ts druid bio**

Change:
```
bio: 'Keeper of the old groves. Shape becomes thought becomes shape again — bear on the press, wolf on the chase.',
```
→
```
bio: 'Keeper of the old groves. Shape becomes thought becomes shape again — wolf on the press, wolf on the hunt.',
```

- [ ] **Step 2.4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/screens/MoveList.tsx src/data/guildMeta.ts
git commit -m "feat(ui): druid/wolf form toggle in MoveList, update bio"
```

---

### Task 3: SpriteStrip targetHeight — normalize dossier SPRITES preview sizes

**Files:**
- Modify: `src/ui/SpriteStrip.tsx`
- Modify: `src/screens/GuildDossier.tsx`

- [ ] **Step 3.1: Add targetHeight prop to SpriteStrip**

Update the `Props` interface:
```typescript
interface Props {
  guildId: string;
  animationId: string;
  scale?: number;
  targetHeight?: number;
  pauseMs?: number;
}
```

Update the function signature:
```typescript
export function SpriteStrip({ guildId, animationId, scale = 3, targetHeight, pauseMs = 400 }: Props) {
```

In the render section, compute effective scale before the canvas:
```typescript
const w = meta?.frameSize.w ?? 68;
const h = meta?.frameSize.h ?? 68;
const effectiveScale = targetHeight ? targetHeight / h : scale;
```

Change the canvas width/height:
```tsx
<canvas
  ref={canvasRef}
  width={w * effectiveScale}
  height={h * effectiveScale}
  style={{ imageRendering: 'pixelated', display: 'block' }}
/>
```

In the draw effect, add `targetHeight` to the dependency array and use `effectiveScale` for the drawImage call:
```typescript
useEffect(() => {
  if (!meta) return;
  const spec = meta.animations[animationId];
  const canvas = canvasRef.current;
  if (!canvas || !spec) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const { w, h } = meta.frameSize;
  const s = targetHeight ? targetHeight / h : scale;

  const startMs = performance.now();
  let raf = 0;
  const cycleMs = spec.frames * spec.frameDurationMs + (spec.loop ? 0 : pauseMs);

  const tick = (now: number) => {
    const elapsed = (now - startMs) % cycleMs;
    const raw = Math.floor(elapsed / spec.frameDurationMs);
    const frame = spec.loop ? raw % spec.frames : Math.min(raw, spec.frames - 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = imgRef.current;
    if (img) ctx.drawImage(img, frame * w, 0, w, h, 0, 0, w * s, h * s);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [meta, animationId, scale, targetHeight, pauseMs]);
```

Also update the `missing` fallback to use effectiveScale:
```tsx
if (missing) {
  const s = targetHeight ? targetHeight / 68 : scale;
  return (
    <div style={{ width: 68 * s, height: 68 * s, ... }}>
      no sprites
    </div>
  );
}
```

- [ ] **Step 3.2: Update GuildDossier.tsx SPRITES section to use targetHeight**

Change line 129 in GuildDossier.tsx:
```tsx
<SpriteStrip guildId={guildId} animationId={anim} scale={0.85} />
```
→
```tsx
<SpriteStrip guildId={guildId} animationId={anim} targetHeight={80} />
```

- [ ] **Step 3.3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/ui/SpriteStrip.tsx src/screens/GuildDossier.tsx
git commit -m "fix(ui): normalize dossier SPRITES preview heights via SpriteStrip targetHeight"
```

---

### Task 4: Leper VFX in AbilityPreview

**Files:**
- Modify: `src/ui/AbilityPreview.tsx`

The SVG viewBox is 120×120, center at (60,60). Leper color palette: `#a3e635` (lime), `#65a30d` (green), `#4d7c0f` (mid), `#1a2e05` (dark).

- [ ] **Step 4.1: Add leper effect types to PreviewEffect union**

Add after the `'master_chosen_nuke'` line (around line 72), before the closing `; ` of the union:
```typescript
  | 'leper_plague'
  | 'leper_claw'
  | 'leper_embrace'
  | 'leper_contagion'
  | 'leper_tide'
  | 'leper_miasma'
```

- [ ] **Step 4.2: Add leper case to getAbilityPreviewSpec**

Add before the `default:` case in the switch:
```typescript
case 'leper':
  switch (abilityId) {
    case 'plague_vomit':     return { effect: 'leper_plague' };
    case 'diseased_claw':    return { effect: 'leper_claw' };
    case 'necrotic_embrace': return { effect: 'leper_embrace' };
    case 'contagion':        return { effect: 'leper_contagion' };
    case 'rotting_tide':     return { effect: 'leper_tide' };
    case 'miasma':           return { effect: 'leper_miasma' };
    default:                 return {};
  }
```

- [ ] **Step 4.3: Add leper sprite transforms to getSpriteTransform**

In `getSpriteTransform`, add leper cases (before or inside the existing switch). Leper abilities use a subtle lean for claw, and idle bob for the rest:
```typescript
case 'leper_claw':
  x = 3 + Math.sin(progress * TAU) * 3; y += 4; break;
case 'leper_plague':
  scale *= 1.0 + Math.sin(progress * TAU) * 0.02; y += 3; break;
case 'leper_tide':
  scale *= 1.0 + Math.sin(progress * TAU) * 0.025; break;
// leper_embrace, leper_contagion, leper_miasma: no transform needed (fall through to default)
```

- [ ] **Step 4.4: Add leper tint filters**

In the tint `const tint =` chain (around line 1154), add leper cases before the final `: 'none'`:
```typescript
: preview.effect === 'leper_plague'
  ? 'drop-shadow(0 0 14px rgba(101,163,13,0.55)) sepia(0.4) saturate(2) hue-rotate(55deg) brightness(0.96)'
  : preview.effect === 'leper_tide'
    ? 'drop-shadow(0 0 16px rgba(26,46,5,0.7)) sepia(0.6) saturate(3) hue-rotate(70deg) brightness(0.82)'
    : preview.effect === 'leper_contagion'
      ? 'drop-shadow(0 0 10px rgba(101,163,13,0.5)) sepia(0.3) saturate(2) hue-rotate(60deg) brightness(1.0)'
      : 'none'
```

- [ ] **Step 4.5: Add leper SVG overlays to PreviewOverlay**

In `PreviewOverlay`'s switch, add leper cases before the closing `}` of the switch. These use the `pulse`, `sweep`, `orbit` variables already in scope:

```tsx
case 'leper_plague':
  content = (
    <>
      <circle cx="60" cy="60" r={28+pulse*8} fill="#1a2e05" opacity={0.2+pulse*0.1} />
      <circle cx="60" cy="60" r={34+pulse*6} fill="none" stroke="#65a30d" strokeWidth={4} opacity={0.7+pulse*0.25} />
      {[0,1,2,3,4].map(i => {
        const a = orbit*0.8 + i*TAU/5;
        return <circle key={i} cx={60+Math.cos(a)*28} cy={60+Math.sin(a)*16} r="3.5" fill="#a3e635" opacity={0.75} />;
      })}
    </>
  );
  break;
case 'leper_claw':
  content = (
    <>
      <path d={`M40 ${50+sweep*4} Q55 60 74 ${46-sweep*4}`} fill="none" stroke="#4d7c0f" strokeWidth={5} strokeLinecap="round" opacity="0.9" />
      <path d={`M40 ${62+sweep*3} Q55 70 74 ${58-sweep*3}`} fill="none" stroke="#65a30d" strokeWidth={3} strokeLinecap="round" opacity="0.85" />
      <path d={`M40 ${74+sweep*2} Q55 80 74 ${70-sweep*2}`} fill="none" stroke="#a3e635" strokeWidth={2} strokeLinecap="round" opacity="0.75" />
    </>
  );
  break;
case 'leper_embrace':
  content = (
    <>
      <ellipse cx="60" cy="60" rx={24+pulse*6} ry={28+pulse*6} fill="#1a2e05" opacity={0.25+pulse*0.1} />
      <ellipse cx="60" cy="60" rx={30+pulse*4} ry={34+pulse*4} fill="none" stroke="#4d7c0f" strokeWidth={3.5} opacity={0.65+pulse*0.3} />
      {[0,1,2,3].map(i => {
        const t = (progress*1.2 + i*0.25) % 1;
        const a = i*TAU/4 + orbit*0.5;
        return <circle key={i} cx={60+Math.cos(a)*(38-t*16)} cy={60+Math.sin(a)*(22-t*10)} r={2.5*(1-t*0.5)} fill="#65a30d" opacity={0.8*(1-t*0.3)} />;
      })}
    </>
  );
  break;
case 'leper_contagion':
  content = (
    <>
      <circle cx="60" cy="60" r={8+pulse*4} fill="#1a2e05" opacity={0.4+pulse*0.15} />
      {[0,1,2,3,4,5].map(i => {
        const t = (progress*0.7 + i/6) % 1;
        const a = i*TAU/6;
        return <circle key={i} cx={60+Math.cos(a)*t*36} cy={60+Math.sin(a)*t*22} r={2+t*3} fill="#65a30d" opacity={0.9-t*0.6} />;
      })}
    </>
  );
  break;
case 'leper_tide':
  content = (
    <>
      <circle cx="60" cy="60" r="36" fill="none" stroke="#1a2e05" strokeWidth={10} opacity={0.22+pulse*0.08} />
      <circle cx="60" cy="60" r="36" fill="none" stroke="#4d7c0f" strokeWidth={4} strokeDasharray="18 10" strokeDashoffset={orbit*-30} opacity={0.72+pulse*0.2} />
      <circle cx="60" cy="60" r="24" fill="none" stroke="#65a30d" strokeWidth={2.5} strokeDasharray="10 8" strokeDashoffset={orbit*20} opacity={0.6+pulse*0.25} />
      {[0,1,2].map(i => {
        const a = orbit*1.2 + i*TAU/3;
        return <circle key={i} cx={60+Math.cos(a)*32} cy={60+Math.sin(a)*20} r="3" fill="#a3e635" opacity={0.8} />;
      })}
    </>
  );
  break;
case 'leper_miasma':
  content = (
    <>
      <ellipse cx="60" cy="60" rx={32+pulse*10} ry={36+pulse*10} fill="#1a2e05" opacity={0.18+pulse*0.1} />
      <ellipse cx="60" cy="60" rx={36+pulse*8} ry={40+pulse*8} fill="none" stroke="#4d7c0f" strokeWidth={5} opacity={0.6+pulse*0.32} />
      <ellipse cx="60" cy="60" rx={22+pulse*6} ry={26+pulse*6} fill="none" stroke="#65a30d" strokeWidth={2.5} opacity={0.5+pulse*0.3} />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={60+Math.cos(orbit*0.8+i*TAU/4)*28} cy={60+Math.sin(orbit*0.8+i*TAU/4)*16} r="2.5" fill="#a3e635" opacity={0.7+pulse*0.2} />
      ))}
    </>
  );
  break;
```

- [ ] **Step 4.6: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4.7: Commit**

```bash
git add src/ui/AbilityPreview.tsx
git commit -m "feat(ui): add leper VFX overlays in dossier/movelist ability preview"
```

---

## Self-Review

**Spec coverage:**
- ✅ bear→wolf rename (Task 1)
- ✅ MoveList toggle druid/wolf (Task 2)
- ✅ guildMeta bio update (Task 2)
- ✅ SpriteStrip size normalization / Viking fix (Task 3)
- ✅ Leper VFX (Task 4)

**Placeholder scan:** No TBDs or incomplete sections.

**Type consistency:**
- `DRUID_WOLF_ABILITIES` / `DRUID_WOLF_RMB` introduced in Task 1, used in Task 2 ✅
- `enterWolfForm` / `revertWolfForm` introduced and used in Task 1 ✅
- `targetHeight` prop defined in Task 3 SpriteStrip, consumed in Task 3 GuildDossier ✅
- Leper effect names defined in Task 4 Step 1, used in Steps 2–5 ✅
