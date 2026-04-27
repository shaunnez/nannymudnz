import Phaser from 'phaser';
import type { VFXEvent, VFXEventType } from '@nannymud/shared/simulation/types';
import { DEPTH_SCALE, worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';
import { spawnGuildVfx } from './VfxRegistry';
import { spawnEffectVfx, type SpawnEffectOptions } from './EffectsRegistry';
import { readUseNewVfx, readUseProceduralVfx } from '../../state/useDevSettings';

// ── Hex colour helpers ────────────────────────────────────────────────────────
function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

// ── Effect definition types ───────────────────────────────────────────────────
interface EffectDef {
  key: string;
  tint?: boolean;       // apply event.color as tint
  scaleMul?: number;    // multiplier on asset base scale
  yOffset?: number;     // screen px, positive = up
  angle?: number;       // rotation degrees
}

// Combo state: cycle through a list of effects per actor+ability hit sequence.
// Resets if the same combo isn't hit within COMBO_RESET_MS.
const COMBO_RESET_MS = 2000;
const comboState = new Map<string, { idx: number; ts: number }>();

function nextComboIndex(actorId: string, abilityId: string, len: number): number {
  const key = `${actorId}:${abilityId}`;
  const now = Date.now();
  const cur = comboState.get(key);
  let idx = 0;
  if (cur && now - cur.ts < COMBO_RESET_MS) {
    idx = (cur.idx + 1) % len;
  }
  comboState.set(key, { idx, ts: now });
  return idx;
}

// Per-ability, per-event-type override. Each entry is either a single effect
// or an array of effects (all play simultaneously).
type EventOverride = EffectDef | EffectDef[];
type ComboOverride = { combo: true; defs: EffectDef[] };

interface AbilityVFX {
  hit_spark?:       EventOverride | ComboOverride;
  aoe_pop?:         EventOverride;
  channel_pulse?:   EventOverride;
  aura_pulse?:      EventOverride;
  zone_pulse?:      EventOverride;
  heal_glow?:       EventOverride;
  [key: string]:    EventOverride | ComboOverride | undefined;
}

function isCombo(v: EventOverride | ComboOverride): v is ComboOverride {
  return (v as ComboOverride).combo === true;
}

// ── Full ability → VFX mapping ────────────────────────────────────────────────
// Only active when useNewVfx setting is on.
const ABILITY_VFX: Partial<Record<string, AbilityVFX>> = {

  // ── ADVENTURER ─────────────────────────────────────────────────────────────
  rallying_cry:    { aoe_pop:      { key: 'explosion_2', tint: true } },
  slash:           { hit_spark:    { combo: true, defs: [
                       { key: 'slash_5', tint: true },
                       { key: 'slash_8', tint: true },
                       { key: 'slash_6', tint: true },
                     ] } },
  quickshot:       { hit_spark:    { key: 'fire_arrow', scaleMul: 0.5 } },
  adrenaline_rush: { aoe_pop:      { key: 'explosion_3', tint: true } },

  // ── KNIGHT ─────────────────────────────────────────────────────────────────
  holy_rebuke:     { aoe_pop:      { key: 'explosion_8', tint: true } },
  valorous_strike: { hit_spark:    { key: 'slash_6', tint: true } },
  taunt:           { aoe_pop:      { key: 'explosion_10', tint: true } },
  shield_wall:     { aura_pulse:   { key: 'flame6', tint: true } },
  last_stand:      { aoe_pop:      { key: 'explosion_3', tint: true } },
  shield_block:    { aura_pulse:   { key: 'flame6', tint: true, scaleMul: 0.6 } },

  // ── MAGE ───────────────────────────────────────────────────────────────────
  ice_nova:        { aoe_pop:      { key: 'water4', tint: true } },
  frostbolt:       { hit_spark:    { key: 'flame10', tint: true } },
  arcane_shard:    { hit_spark:    { key: 'water_arrow', tint: true } },
  meteor:          { aoe_pop:      [{ key: 'fire_spell' }, { key: 'explosion_1' }] },
  short_teleport:  { aoe_pop:      { key: 'explosion_6', tint: true } },

  // ── DRUID (human form) ─────────────────────────────────────────────────────
  wild_growth:     { aoe_pop:      { key: 'explosion_8', tint: true } },
  entangle:        { hit_spark:    { key: 'flame4', tint: true } },
  rejuvenate:      { heal_glow:    { key: 'water9', tint: true, yOffset: 60, scaleMul: 0.6 } },
  cleanse:         { heal_glow:    { key: 'flame6', tint: true } },
  tranquility:     { channel_pulse: { key: 'water10', tint: true },
                     hit_spark:    { key: 'flame2', tint: true, yOffset: 50 } },
  shapeshift:      { aura_pulse:   { key: 'water6', tint: true } },

  // ── DRUID (wolf form) ──────────────────────────────────────────────────────
  wolf_maul:       { hit_spark:    { key: 'slash_6', tint: true } },
  wolf_charge:     { hit_spark:    { key: 'water5', tint: true } },
  wolf_roar:       { aoe_pop:      { key: 'water_spell', tint: true } },
  wolf_rend:       { hit_spark:    { key: 'slash_8', tint: true } },
  wolf_primal_fury:{ aoe_pop:      { key: 'water4', tint: true } },
  wolf_revert:     { aura_pulse:   { key: 'water6', tint: true } },

  // ── HUNTER ─────────────────────────────────────────────────────────────────
  piercing_volley: { hit_spark:    { key: 'water_arrow', tint: true } },
  aimed_shot:      { hit_spark:    { key: 'water_arrow', tint: true },
                     aoe_pop:      { key: 'explosion_2', tint: true } },
  bear_trap:       { aoe_pop:      { key: 'explosion_2', tint: true } },
  rain_of_arrows:  { hit_spark:    { key: 'water3', tint: true } },

  // ── MONK ───────────────────────────────────────────────────────────────────
  serenity:        { aura_pulse:   { key: 'water6', tint: true } },
  flying_kick:     { hit_spark:    { key: 'water5', tint: true } },
  jab:             { hit_spark:    { key: 'slash_7', tint: true } },
  five_point_palm: { hit_spark:    [{ key: 'slash_4', tint: true },
                                    { key: 'explosion_5', tint: true }] },
  dragons_fury:    { channel_pulse: { key: 'flame9', tint: true },
                     hit_spark:    [{ key: 'slash_4', tint: true },
                                    { key: 'explosion_5', tint: true }] },
  monk_parry:      { hit_spark:    { key: 'slash_7', tint: true } },

  // ── VIKING ─────────────────────────────────────────────────────────────────
  whirlwind:       { channel_pulse: { key: 'flame3', tint: true } },
  harpoon:         { hit_spark:    { key: 'fire_arrow' } },
  bloodlust:       { aoe_pop:      { key: 'explosion_3', tint: true } },
  axe_swing:       { hit_spark:    { key: 'slash_6', tint: true } },
  undying_rage:    { aoe_pop:      { key: 'explosion_10', tint: true } },
  shield_bash:     { hit_spark:    [{ key: 'slash_8', tint: true },
                                    { key: 'explosion_5', tint: true }] },

  // ── PROPHET ────────────────────────────────────────────────────────────────
  prophetic_shield:{ aura_pulse:   { key: 'water6', tint: true } },
  smite:           { hit_spark:    { key: 'explosion_6', tint: true } },
  bless:           { heal_glow:    { key: 'flame6', tint: true, yOffset: 50 } },
  divine_intervention: { aura_pulse: [{ key: 'flame6', tint: true },
                                       { key: 'water10', tint: true }] },
  divine_insight:  { aoe_pop:      { key: 'water4', tint: true } },

  // ── VAMPIRE ────────────────────────────────────────────────────────────────
  hemorrhage:      { hit_spark:    { key: 'water3', tint: true } },
  blood_drain:     { channel_pulse: { key: 'water7', tint: true } },
  fang_strike:     { hit_spark:    { key: 'slash_6', tint: true } },
  nocturne:        { aura_pulse:   { key: 'flame2', tint: true } },
  mist_step:       { aoe_pop:      { key: 'explosion_2', tint: true, scaleMul: 0.6 } },

  // ── CULTIST ────────────────────────────────────────────────────────────────
  summon_spawn:    { aoe_pop:      { key: 'explosion_5', tint: true } },
  whispers:        { hit_spark:    { key: 'water_arrow', tint: true } },
  madness:         { aoe_pop:      { key: 'explosion_8', tint: true } },
  tendril_grasp:   { zone_pulse:   { key: 'flame4', tint: true } },
  open_the_gate:   { channel_pulse: { key: 'flame9', tint: true },
                     aoe_pop:      { key: 'explosion_10', tint: true } },
  gaze_abyss:      { aura_pulse:   { key: 'flame6', tint: true } },

  // ── CHAMPION ───────────────────────────────────────────────────────────────
  tithe_of_blood:  { aoe_pop:      { key: 'explosion_3', tint: true } },
  berserker_charge:{ hit_spark:    [{ key: 'slash_8', tint: true },
                                    { key: 'explosion_2', tint: true }] },
  execute:         { hit_spark:    [{ key: 'slash_6', tint: true },
                                    { key: 'explosion_5', tint: true }] },
  cleaver:         { hit_spark:    { key: 'flame8', tint: true, angle: 90 } },
  skullsplitter:   { hit_spark:    [{ key: 'slash_10', tint: true },
                                    { key: 'explosion_6', tint: true }] },

  // ── DARKMAGE ───────────────────────────────────────────────────────────────
  soul_leech:      { hit_spark:    { key: 'flame8', tint: true } },
  shadow_bolt:     { hit_spark:    { key: 'water_arrow', tint: true } },
  eternal_night:   { zone_pulse:   { key: 'flame2', tint: true } },
  shadow_cloak:    { aura_pulse:   { key: 'flame6', tint: true } },

  // ── CHEF ───────────────────────────────────────────────────────────────────
  feast:           { aoe_pop:      { key: 'explosion_5', tint: true } },
  ladle_bash:      { hit_spark:    { key: 'slash_8', tint: true } },
  hot_soup:        { heal_glow:    { key: 'water5', tint: true, yOffset: 50 } },
  spice_toss:      { hit_spark:    { key: 'fire_arrow', scaleMul: 0.6 } },
  signature_dish:  { channel_pulse: { key: 'flame5', tint: true },
                     aoe_pop:      { key: 'explosion_10', tint: true } },
  pocket_dish:     { aoe_pop:      { key: 'explosion_2', tint: true } },

  // ── LEPER ──────────────────────────────────────────────────────────────────
  plague_vomit:    { aoe_pop:      { key: 'flame3', tint: true } },
  diseased_claw:   { hit_spark:    { key: 'slash_6', tint: true } },
  necrotic_embrace:{ hit_spark:    { key: 'flame8', tint: true } },
  rotting_tide:    { channel_pulse: { key: 'flame10', tint: true },
                     aoe_pop:      { key: 'explosion_8', tint: true } },
  miasma:          { aura_pulse:   { key: 'flame2', tint: true } },

  // ── MASTER ─────────────────────────────────────────────────────────────────
  chosen_strike:   { hit_spark:    { combo: true, defs: [
                       { key: 'slash_5', tint: true },
                       { key: 'slash_8', tint: true },
                       { key: 'slash_6', tint: true },
                     ] } },
  chosen_nuke:     { aoe_pop:      { key: 'explosion_8', tint: true } },
  eclipse:         { aura_pulse:   { key: 'water6', tint: true } },
  apotheosis:      { channel_pulse: { key: 'explosion_10', tint: true } },
};

// ── Spawn helpers ─────────────────────────────────────────────────────────────
function resolveOpts(def: EffectDef, eventColor: string): SpawnEffectOptions {
  return {
    tint:     def.tint ? hexToInt(eventColor) : undefined,
    scaleMul: def.scaleMul,
    yOffset:  def.yOffset,
    angle:    def.angle,
  };
}

function spawnDef(
  scene: Phaser.Scene,
  def: EffectDef,
  x: number,
  y: number,
  facing: 1 | -1,
  color: string,
): void {
  spawnEffectVfx(scene, def.key, x, y, { facing, ...resolveOpts(def, color) });
}

function spawnOverride(
  scene: Phaser.Scene,
  override: EventOverride | ComboOverride,
  x: number,
  y: number,
  facing: 1 | -1,
  color: string,
  abilityId: string,
  ownerId: string,
): void {
  if (isCombo(override)) {
    const idx = nextComboIndex(ownerId, abilityId, override.defs.length);
    spawnDef(scene, override.defs[idx], x, y, facing, color);
  } else if (Array.isArray(override)) {
    for (const def of override) spawnDef(scene, def, x, y, facing, color);
  } else {
    spawnDef(scene, override, x, y, facing, color);
  }
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
function worldCoords(event: VFXEvent, band: ScreenYBand): { x: number; y: number } {
  return {
    x: event.x,
    y: worldYToScreenY(event.y, band.min, band.max) - (event.z ?? 0) * DEPTH_SCALE,
  };
}

// ── Procedural helpers ────────────────────────────────────────────────────────
function spawnText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
  durationMs: number,
  riseDy: number,
  stroke = true,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    fontSize: `${fontSize}px`,
    color,
    stroke: stroke ? '#000000' : undefined,
    strokeThickness: stroke ? 3 : 0,
  }).setOrigin(0.5);
  t.setDepth(y + 1000);
  scene.tweens.add({
    targets: t,
    y: y + riseDy,
    alpha: 0,
    duration: durationMs,
    ease: 'Sine.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}

function spawnBurstSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  speed: number,
  radius: number,
  color: number,
  alpha: number,
  lifetimeMs: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, radius);
  g.setPosition(x, y);
  g.setDepth(y + 1000);
  g.setAlpha(alpha);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  scene.tweens.add({
    targets: g,
    x: x + vx * (lifetimeMs / 1000),
    y: y + vy * (lifetimeMs / 1000) + 80 * (lifetimeMs / 1000) ** 2 * 0.5,
    alpha: 0,
    duration: lifetimeMs,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

function spawnExpandingRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  baseRadius: number,
  growMul: number,
  color: number,
  startAlpha: number,
  fillAlphaMul: number,
  lineWidth: number,
  dashed: boolean,
  lifetimeMs: number,
): void {
  const g = scene.add.graphics();
  const draw = (): void => {
    g.clear();
    if (dashed) {
      const segs = 20;
      const arcLen = (Math.PI * 2) / segs;
      for (let i = 0; i < segs; i += 2) {
        g.lineStyle(lineWidth, color, 1);
        g.beginPath();
        g.arc(0, 0, baseRadius, i * arcLen, (i + 1) * arcLen, false);
        g.strokePath();
      }
    } else {
      g.lineStyle(lineWidth, color, 1);
      g.strokeCircle(0, 0, baseRadius);
    }
    g.fillStyle(color, fillAlphaMul);
    g.fillCircle(0, 0, baseRadius);
  };
  draw();
  g.setPosition(x, y);
  g.setDepth(y + 1000);
  g.setAlpha(startAlpha);
  scene.tweens.add({
    targets: g,
    scaleX: growMul,
    scaleY: growMul,
    alpha: 0,
    duration: lifetimeMs,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

function spawnCrosshairMark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  lifetimeMs: number,
): void {
  const g = scene.add.graphics();
  g.lineStyle(2, color, 1);
  g.strokeCircle(0, 0, radius);
  g.lineBetween(-radius * 0.45, 0, radius * 0.45, 0);
  g.lineBetween(0, -radius * 0.45, 0, radius * 0.45);
  g.setPosition(x, y);
  g.setDepth(y + 1000);
  scene.tweens.add({
    targets: g,
    y: y - 12,
    scaleX: 1.25,
    scaleY: 1.25,
    alpha: 0,
    duration: lifetimeMs,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

function spawnBlinkTrail(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  lifetimeMs: number,
): void {
  const g = scene.add.graphics();
  g.lineStyle(3, color, 1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const dash = 5;
  const gap = 5;
  for (let t = 0; t < len; t += dash + gap) {
    const a = Math.min(t + dash, len);
    g.lineBetween(x1 + ux * t, y1 + uy * t, x1 + ux * a, y1 + uy * a);
  }
  g.setDepth(Math.max(y1, y2) + 1000);
  g.setAlpha(0.8);
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: lifetimeMs,
    ease: 'Linear',
    onComplete: () => g.destroy(),
  });
}

// ── Main consumer ─────────────────────────────────────────────────────────────
export function consumeVfxEvents(scene: Phaser.Scene, events: VFXEvent[]): void {
  const band          = getScreenYBand(scene);
  const newVfx        = readUseNewVfx();
  const proceduralVfx = readUseProceduralVfx();

  for (const event of events) {
    const { x, y } = worldCoords(event, band);
    const colorInt  = hexToInt(event.color);
    const facing    = event.facing ?? 1;
    const abilityId = event.abilityId ?? '';
    const ownerId   = event.ownerId ?? event.actorId ?? '';

    // Guild-specific sprite VFX — gated with procedural since it's the old system.
    const guildFired = proceduralVfx && spawnGuildVfx(scene, event, x, y);

    // Ability overlay sprites — only when new VFX is enabled.
    if (newVfx && abilityId) {
      const abilityOverride = ABILITY_VFX[abilityId];
      if (abilityOverride) {
        const override = abilityOverride[event.type as VFXEventType];
        if (override) {
          spawnOverride(scene, override, x, y, facing, event.color, abilityId, ownerId);
        }
      }
    }

    if (guildFired) continue;
    if (!proceduralVfx) continue;

    // ── Procedural fallbacks ────────────────────────────────────────────────
    switch (event.type) {
      case 'projectile_spawn': {
        const throwType = event.abilityId;
        if (throwType === 'thrown_torch') {
          for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            spawnBurstSpark(scene, x, y, angle, 40 + Math.random() * 60, 3, 0xff6600, 0.9, 350);
          }
        } else if (throwType === 'thrown_bomb') {
          for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            spawnBurstSpark(scene, x, y, angle, 80 + Math.random() * 120, 4, 0xffcc00, 1.0, 400);
          }
          spawnExpandingRing(scene, x, y, 40, 1.2, 0xff8800, 0.7, 0.1, 2, false, 350);
        } else if (throwType === 'thrown_smoke_bomb') {
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            spawnBurstSpark(scene, x, y, angle, 10 + Math.random() * 30, 6, 0x9aab9a, 0.6, 1200);
          }
        } else if (throwType === 'thrown_throwing_star') {
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            spawnBurstSpark(scene, x, y, angle, 30 + Math.random() * 20, 2, 0xc0c0c0, 0.7, 150);
          }
        }
        break;
      }

      case 'hit_spark': {
        if (newVfx && !ABILITY_VFX[abilityId]?.hit_spark) {
          // Default slash for any melee hit not explicitly mapped.
          const slashKeys = ['slash_1','slash_2','slash_3','slash_4','slash_5',
                             'slash_6','slash_7','slash_8','slash_9','slash_10'];
          const key = slashKeys[Math.floor(Math.random() * slashKeys.length)];
          spawnEffectVfx(scene, key, x, y, { facing });
        } else if (!newVfx) {
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
            spawnBurstSpark(scene, x, y, angle, 80 + Math.random() * 120, 2 + Math.random() * 3, colorInt, 1, 300);
          }
        }
        break;
      }

      case 'aoe_pop': {
        const r = event.radius || 60;
        spawnExpandingRing(scene, x, y, r, 1.0, colorInt, 0.6, 0.2, 3, false, 400);
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const rx = x + Math.cos(angle) * r;
          const ry = y + Math.sin(angle) * r * 0.5;
          spawnBurstSpark(scene, rx, ry, angle, 40, 3, colorInt, 0.8, 300);
        }
        break;
      }

      case 'heal_glow': {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const sx = x + Math.cos(angle) * 15;
          const sy = y + Math.sin(angle) * 15;
          const radius = 4 + Math.random() * 4;
          const g = scene.add.graphics();
          g.fillStyle(0x4ade80, 1);
          g.fillCircle(0, 0, radius);
          g.setPosition(sx, sy);
          g.setDepth(sy + 1000);
          g.setAlpha(0.9);
          scene.tweens.add({
            targets: g,
            x: sx + Math.cos(angle) * 20 * 0.6,
            y: sy - 50,
            alpha: 0,
            duration: 600,
            ease: 'Sine.easeOut',
            onComplete: () => g.destroy(),
          });
        }
        break;
      }

      case 'blink_trail': {
        const x2   = event.x2 ?? event.x;
        const y2End = worldYToScreenY(event.y2 ?? event.y, band.min, band.max)
          - (event.z ?? 0) * DEPTH_SCALE;
        spawnBlinkTrail(scene, x, y, x2, y2End, colorInt, 400);
        break;
      }

      case 'damage_number': {
        const text    = event.value !== undefined ? String(Math.round(event.value)) : '';
        const color   = event.isHeal ? '#4ade80' : event.isCrit ? '#f97316' : '#fef08a';
        const fontSize = event.isCrit ? 18 : event.isHeal ? 14 : 15;
        const jitterX  = (Math.random() - 0.5) * 20;
        spawnText(scene, x + jitterX, y, text, color, fontSize, 800, -48);
        break;
      }

      case 'status_text': {
        spawnText(scene, x, y, event.text ?? '', event.color, 13, 1200, -60);
        break;
      }

      case 'ability_name': {
        const text = (event.text ?? '').toUpperCase();
        const t = scene.add.text(x, y, text, {
          fontFamily: '"Space Grotesk", sans-serif',
          fontStyle: 'bold',
          fontSize: '17px',
          color: event.color,
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
        t.setDepth(y + 1000);
        scene.tweens.add({
          targets: t,
          alpha: 1,
          y: y - 8,
          duration: 300,
          onComplete: () => {
            scene.tweens.add({
              targets: t,
              alpha: 0,
              y: y - 18,
              duration: 500,
              delay: 1200,
              onComplete: () => t.destroy(),
            });
          },
        });
        break;
      }

      case 'status_mark': {
        spawnCrosshairMark(scene, x, y, event.radius || 18, colorInt, 650);
        break;
      }

      case 'channel_pulse': {
        spawnExpandingRing(scene, x, y, event.radius || 100, 1.22, colorInt, 0.45, 0.14, 4, false, 320);
        break;
      }

      case 'aura_pulse': {
        spawnExpandingRing(scene, x, y, event.radius || 90, 1.27, colorInt, 0.35, 0.08, 2, true, 420);
        break;
      }

      case 'zone_pulse': {
        const r = event.radius || 60;
        if (event.style === 'ring') {
          spawnExpandingRing(scene, x, y, r, 1.0, colorInt, 0.55, 0.12, 2, false, 950);
        } else {
          spawnExpandingRing(scene, x, y, r, 1.0, colorInt, 0.7, 0.25, 3, true, 850);
        }
        break;
      }
    }
  }
}
