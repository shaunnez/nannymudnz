# Audio FX Expansion — Design Spec
_2026-04-24_

## Goal

Richer, more differentiated combat audio. Three gains:
1. Wire 7 AudioManager methods that already exist but are never called.
2. Add per-VFX-category ability sounds (AOE, blink, channel, aura, zone, summon).
3. Upgrade hit synthesis quality with layered noise + distortion for punchier feel.
4. Differentiate hit weight: normal tap → crit crack → knockdown thud.

All audio is pure Web Audio API synthesis — no new asset files.

## Scope

**In:** SP and VS (CPU) modes. Both run `updateSp()` → `dispatchAudio()`.  
**Out:** MP mode audio (VFX consumed in `onMpStateChange`; separate task).  
**Out:** `playParry()`, `playInsufficientResource()` (no clean trigger without sim changes).

---

## Changes to `src/audio/audioManager.ts`

### New private helpers

**`private playNoise(cutoffHz, durationSec, gain, filterType = 'lowpass')`**

Creates a one-shot white noise buffer source → BiquadFilterNode (type + frequency) → GainNode (exponential decay) → sfxGain. Used by multiple sound methods to add texture.

**`private makeDistortionCurve(amount): Float32Array`**

Generates a 256-point soft-clip waveshaper curve. Used by `playCrit()` and `playAttack()` for gritty crunch. Formula: `((π + k) * x) / (π + k * |x|)`.

### New ability-category sounds

| Method | Description | Synthesis |
|---|---|---|
| `playAoeBoom()` | AOE explosion/shockwave | Sub-bass sine 80→40 Hz over 200ms + low-pass noise burst (cutoff 200 Hz, 100ms) |
| `playBlink()` | Teleport/dash whoosh | Sawtooth sweep 150→1500→150 Hz over 150ms + bandpass shimmer noise (1000 Hz, 100ms) |
| `playChannelPulse()` | Building channeled power | AM pair: 220 Hz + 330 Hz sines, gain 0→0.3→0 over 300ms each |
| `playAuraPulse()` | Eerie persistent aura | 4 detuned sines: 110, 217, 331, 443 Hz — all swell 0→gain→0 over 500ms |
| `playZonePulse()` | Ground-based zone pulse | Sub-bass sine 55→30 Hz (250ms) + low-pass noise (cutoff 80 Hz, 150ms) |
| `playSummonSpawn()` | Mystical summoning | Rising sine arpeggio E3→G3→B3→E4 (165, 196, 247, 330 Hz), 70ms stagger, 200ms each |

### Enhanced existing sounds

| Method | Added layer |
|---|---|
| `playAttack()` | +30ms low-pass noise punch (cutoff 300 Hz, gain 0.3). Meatier smack. |
| `playCrit()` | +WaveShaper distortion on oscillators + 40ms high-pass sparkle noise (cutoff 3000 Hz, gain 0.4). Metallic crack. |
| `playKnockdown()` | +200ms low-pass noise thud (cutoff 100 Hz, gain 0.5) + 400ms sub-bass sine (40 Hz, gain 0.5). Heavy floor impact. |
| `playLand()` | +60ms low-pass noise thud (cutoff 150 Hz, gain 0.4). Solid footfall. |
| `playCast()` | +80ms rising sweep sine (300→800 Hz) + 50ms high-pass sparkle noise (cutoff 4000 Hz, gain 0.3). Magical launch. |

Existing `playHeal()`, `playBlock()`, `playJump()`, `playDeath()`, `playVictory()`, `playDefeat()` are unchanged.

---

## Changes to `src/game/scenes/GameplayScene.ts`

### `updateSp()` — capture prev state before tick

Capture three values from `this.simState.player` immediately before calling `tickSimulation`, then pass to `dispatchAudio`:

```ts
const prevPlayerState = this.simState.player.state;
const prevPlayerAlive = this.simState.player.isAlive;
const prevPlayerZ = this.simState.player.z;
this.simState = tickSimulation(this.simState, inputState, dtMs);
// ...
this.dispatchAudio(prevPhase, inputState, prevPlayerState, prevPlayerAlive, prevPlayerZ);
```

### `dispatchAudio()` — expanded signature and routing

New signature:
```ts
private dispatchAudio(
  prevPhase: SimState['phase'],
  inputState: InputState,
  prevPlayerState: string,
  prevPlayerAlive: boolean,
  prevPlayerZ: number
): void
```

Full trigger table:

| Condition | Audio |
|---|---|
| `vfx` has `damage_number` with `isCrit` | `playCrit()` |
| `vfx` has `hit_spark` AND no concurrent crit | `playAttack()` |
| `vfx` has `aoe_pop` | `playAoeBoom()` |
| `vfx` has `blink_trail` | `playBlink()` |
| `vfx` has `channel_pulse` | `playChannelPulse()` |
| `vfx` has `aura_pulse` | `playAuraPulse()` |
| `vfx` has `zone_pulse` | `playZonePulse()` |
| `vfx` has `summon_spawn` | `playSummonSpawn()` |
| `vfx` has `ability_name` where `ownerId === state.player.id` | `playCast()` |
| `player.state === 'knockdown'` and `prevPlayerState !== 'knockdown'` | `playKnockdown()` |
| `!player.isAlive` and `prevPlayerAlive` | `playDeath()` |
| `player.z === 0` and `prevPlayerZ > 0` and `prevPlayerState === 'jumping'` | `playLand()` |
| `player.state === 'blocking'` and `prevPlayerState !== 'blocking'` | `playBlock()` (fixes every-frame bug) |
| `player.state === 'jumping'` and `player.z < 10` and `jumpJustPressed` | `playJump()` (unchanged) |

### Bug fix included

The existing `playBlock()` call fires on every frame while the player is blocking. The new code gates it on the transition to `'blocking'` state, so it fires exactly once per block action.

---

## What is not changed

- Simulation package (`packages/shared/`) — zero changes. No new VFX event types needed.
- Music system — untouched.
- React HUD/screens — no changes.
- MP audio path — deferred.

---

## File impact summary

| File | Change type |
|---|---|
| `src/audio/audioManager.ts` | +~150 lines (2 helpers + 6 new methods + 5 enhanced methods) |
| `src/game/scenes/GameplayScene.ts` | ~25 lines changed (`updateSp` + `dispatchAudio`) |
