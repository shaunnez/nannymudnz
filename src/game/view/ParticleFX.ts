import Phaser from 'phaser';
import type { VFXEvent } from '@nannymud/shared/simulation/types';
import { DEPTH_SCALE, worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';
import { spawnGuildVfx } from './VfxRegistry';

/**
 * Consumes per-tick VFXEvents emitted by the simulation and spawns short-lived
 * Phaser objects (Graphics / Text) with tweens that self-destroy on complete.
 *
 * Mirrors ParticleSystem in src/rendering/particles.ts at the level of "what
 * flickers on screen when stuff happens." Sprite-sheet VFX (assetKey lookup
 * against GuildVfxSet) is deferred to Task 9 — the procedural fallback paths
 * from the Canvas build are the ones implemented here.
 *
 * Coordinate convention: VFX live in world-space x and projected screen-y.
 * Because the main camera scrolls by simState.cameraX, world-x objects
 * auto-track the player. No setScrollFactor(0) on these.
 */

function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

function worldCoords(event: VFXEvent, band: ScreenYBand): { x: number; y: number } {
  return {
    x: event.x,
    y: worldYToScreenY(event.y, band.min, band.max) - (event.z ?? 0) * DEPTH_SCALE,
  };
}

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
    y: y + vy * (lifetimeMs / 1000) + 80 * (lifetimeMs / 1000) * (lifetimeMs / 1000) * 0.5,
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
      // Phaser Graphics has no native dashed arc — approximate with short arc
      // segments. Cheap enough since these live ~300-400ms.
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
  // dashed line approximation — draw ~5px segments with gaps
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

export function consumeVfxEvents(scene: Phaser.Scene, events: VFXEvent[]): void {
  const band = getScreenYBand(scene);
  for (const event of events) {
    const { x, y } = worldCoords(event, band);
    const colorInt = hexToInt(event.color);
    if (spawnGuildVfx(scene, event, x, y)) continue;

    switch (event.type) {
      case 'projectile_spawn':
        // Visual lives on the ProjectileView; nothing to do here.
        break;

      case 'hit_spark': {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 80 + Math.random() * 120;
          const radius = 2 + Math.random() * 3;
          spawnBurstSpark(scene, x, y, angle, speed, radius, colorInt, 1, 300);
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
          // Upward float with slight outward drift
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
        const x2 = event.x2 ?? event.x;
        const y2End = worldYToScreenY(event.y2 ?? event.y, band.min, band.max)
          - (event.z ?? 0) * DEPTH_SCALE;
        spawnBlinkTrail(scene, x, y, x2, y2End, colorInt, 400);
        break;
      }

      case 'damage_number': {
        const text = event.value !== undefined ? String(Math.round(event.value)) : '';
        const color = event.isHeal ? '#4ade80' : event.isCrit ? '#f97316' : '#fef08a';
        const fontSize = event.isCrit ? 18 : event.isHeal ? 14 : 15;
        const jitterX = (Math.random() - 0.5) * 20;
        spawnText(scene, x + jitterX, y, text, color, fontSize, 800, -48);
        break;
      }

      case 'status_text': {
        spawnText(scene, x, y, event.text ?? '', event.color, 13, 1200, -60);
        break;
      }

      case 'ability_name': {
        // Special fade curve: quick fade-in, hold, fade-out. Phaser's tween
        // yoyo doesn't match; use two sequential tweens via a small state.
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
    }
  }
}
