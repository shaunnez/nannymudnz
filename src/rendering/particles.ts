import type { VFXEvent } from '../simulation/types';
import { worldYToScreenY, DEPTH_SCALE } from './constants';
import type { GuildVfxSet, VfxSpriteSheet } from './vfx/types';

interface Particle {
  id: number;
  type: VFXEvent['type'];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  lifetime: number;
  age: number;
  value?: number;
  text?: string;
  isCrit?: boolean;
  isHeal?: boolean;
  x2?: number;
  y2?: number;
  assetKey?: string;
  sprite?: VfxSpriteSheet;
  spriteFrameSize?: { w: number; h: number };
}

let particleIdCounter = 0;

export class ParticleSystem {
  private particles: Particle[] = [];
  private vfxSet: GuildVfxSet | null = null;

  setVfxSet(set: GuildVfxSet | null): void {
    this.vfxSet = set;
  }

  emit(events: VFXEvent[], cameraX: number, canvasHeight: number): void {
    for (const event of events) {
      const sx = event.x - cameraX;
      const sy = worldYToScreenY(event.y, canvasHeight) - (event.z ?? 0) * DEPTH_SCALE;
      const sprite = event.assetKey ? this.vfxSet?.assets[event.assetKey] : undefined;
      const spriteFrameSize = sprite ? this.vfxSet?.frameSize : undefined;

      switch (event.type) {
        case 'damage_number':
          this.particles.push({
            id: particleIdCounter++,
            type: event.type,
            x: sx + (Math.random() - 0.5) * 20,
            y: sy,
            vx: (Math.random() - 0.5) * 30,
            vy: -80 - Math.random() * 40,
            radius: 0,
            color: event.isHeal ? '#4ade80' : event.isCrit ? '#f97316' : '#fef08a',
            alpha: 1,
            lifetime: 800,
            age: 0,
            value: event.value,
            isCrit: event.isCrit,
            isHeal: event.isHeal,
            sprite,
            spriteFrameSize,
          });
          break;

        case 'status_text':
          this.particles.push({
            id: particleIdCounter++,
            type: event.type,
            x: sx,
            y: sy,
            vx: 0,
            vy: -50,
            radius: 0,
            color: event.color,
            alpha: 1,
            lifetime: 1200,
            age: 0,
            text: event.text,
            assetKey: event.assetKey,
            sprite,
            spriteFrameSize,
          });
          break;

        case 'ability_name':
          this.particles.push({
            id: particleIdCounter++,
            type: event.type,
            x: sx,
            y: sy,
            vx: 0,
            vy: -18,
            radius: 0,
            color: event.color,
            alpha: 1,
            lifetime: 2000,
            age: 0,
            text: event.text,
          });
          break;

        case 'hit_spark':
          if (sprite) {
            this.particles.push(this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize));
            break;
          }
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 80 + Math.random() * 120;
            this.particles.push({
              id: particleIdCounter++,
              type: event.type,
              x: sx,
              y: sy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              radius: 2 + Math.random() * 3,
              color: event.color,
              alpha: 1,
              lifetime: 300,
              age: 0,
              assetKey: event.assetKey,
              sprite,
              spriteFrameSize,
            });
          }
          break;

        case 'aoe_pop':
          if (sprite) {
            this.particles.push(this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize));
            break;
          }
          this.particles.push({
            id: particleIdCounter++,
            type: event.type,
            x: sx,
            y: sy,
            vx: 0,
            vy: 0,
            radius: event.radius || 60,
            color: event.color,
            alpha: 0.6,
            lifetime: 400,
            age: 0,
            assetKey: event.assetKey,
            sprite,
            spriteFrameSize,
          });
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const r = event.radius || 60;
            this.particles.push({
              id: particleIdCounter++,
              type: 'hit_spark',
              x: sx + Math.cos(angle) * r,
              y: sy + Math.sin(angle) * r * 0.5,
              vx: Math.cos(angle) * 40,
              vy: Math.sin(angle) * 40,
              radius: 3,
              color: event.color,
              alpha: 0.8,
              lifetime: 300,
              age: 0,
              assetKey: event.assetKey,
              sprite,
              spriteFrameSize,
            });
          }
          break;

        case 'heal_glow':
          if (sprite) {
            this.particles.push(this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize));
            break;
          }
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.particles.push({
              id: particleIdCounter++,
              type: event.type,
              x: sx + Math.cos(angle) * 15,
              y: sy + Math.sin(angle) * 15,
              vx: Math.cos(angle) * 20,
              vy: -60 - Math.random() * 30,
              radius: 4 + Math.random() * 4,
              color: '#4ade80',
              alpha: 0.9,
              lifetime: 600,
              age: 0,
              assetKey: event.assetKey,
              sprite,
              spriteFrameSize,
            });
          }
          break;

        case 'blink_trail':
          this.particles.push({
            id: particleIdCounter++,
            type: event.type,
            x: sx,
            y: sy,
            vx: 0,
            vy: 0,
            radius: 3,
            color: event.color,
            alpha: 0.8,
            lifetime: 400,
            age: 0,
            x2: (event.x2 || event.x) - cameraX,
            y2: worldYToScreenY(event.y2 ?? event.y, canvasHeight) - (event.z ?? 0) * DEPTH_SCALE,
            assetKey: event.assetKey,
            sprite,
            spriteFrameSize,
          });
          break;

        case 'status_mark':
          this.particles.push(
            sprite
              ? this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize)
              : {
                  id: particleIdCounter++,
                  type: event.type,
                  x: sx,
                  y: sy,
                  vx: 0,
                  vy: -12,
                  radius: event.radius || 18,
                  color: event.color,
                  alpha: 0.9,
                  lifetime: 650,
                  age: 0,
                  assetKey: event.assetKey,
                  sprite,
                  spriteFrameSize,
                },
          );
          break;

        case 'channel_pulse':
          this.particles.push(
            sprite
              ? this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize)
              : {
                  id: particleIdCounter++,
                  type: event.type,
                  x: sx,
                  y: sy,
                  vx: 0,
                  vy: 0,
                  radius: event.radius || 100,
                  color: event.color,
                  alpha: 0.45,
                  lifetime: 320,
                  age: 0,
                  assetKey: event.assetKey,
                  sprite,
                  spriteFrameSize,
                },
          );
          break;

        case 'aura_pulse':
          this.particles.push(
            sprite
              ? this.createSpriteParticle(event, sx, sy, sprite, spriteFrameSize)
              : {
                  id: particleIdCounter++,
                  type: event.type,
                  x: sx,
                  y: sy,
                  vx: 0,
                  vy: 0,
                  radius: event.radius || 90,
                  color: event.color,
                  alpha: 0.35,
                  lifetime: 420,
                  age: 0,
                  assetKey: event.assetKey,
                  sprite,
                  spriteFrameSize,
                },
          );
          break;

        case 'projectile_spawn':
          break;
      }
    }
  }

  tick(dtMs: number): void {
    const dtSec = dtMs / 1000;
    for (const p of this.particles) {
      p.age += dtMs;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      if (p.type !== 'ability_name') {
        p.vy += 80 * dtSec;
      }
      if (p.type === 'ability_name') {
        const t = p.age / p.lifetime;
        p.alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
      } else {
        p.alpha = Math.max(0, 1 - p.age / p.lifetime);
      }
    }
    this.particles = this.particles.filter(p => p.age < p.lifetime);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;

      if (p.type === 'damage_number' || p.type === 'status_text') {
        const text = p.text || (p.value !== undefined ? String(Math.round(p.value)) : '');
        const fontSize = p.isCrit ? 18 : p.isHeal ? 14 : 15;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(text, p.x, p.y);
        ctx.fillText(text, p.x, p.y);
        continue;
      }

      if (p.type === 'ability_name') {
        const text = (p.text || '').toUpperCase();
        ctx.font = 'bold 17px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(text, p.x, p.y);
        continue;
      }

      if (p.sprite && p.spriteFrameSize) {
        const { image, meta } = p.sprite;
        const { w: fw, h: fh } = p.spriteFrameSize;
        const rawFrame = Math.floor(p.age / Math.max(1, meta.frameDurationMs));
        const frameIdx = meta.loop ? rawFrame % meta.frames : Math.min(rawFrame, meta.frames - 1);
        const scale = meta.scale ?? 1;
        const dw = fw * scale;
        const dh = fh * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          frameIdx * fw, 0, fw, fh,
          p.x - meta.anchor.x * scale,
          p.y - meta.anchor.y * scale,
          dw,
          dh,
        );
        continue;
      }

      if (p.type === 'aoe_pop') {
        const prog = p.age / p.lifetime;
        const r = p.radius * (0.3 + prog * 0.7);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - prog);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * 0.2;
        ctx.fill();
        ctx.globalAlpha = p.alpha;
        continue;
      }

      if (p.type === 'channel_pulse' || p.type === 'aura_pulse') {
        const prog = p.age / p.lifetime;
        const r = p.radius * (0.45 + prog * 0.55);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = (p.type === 'channel_pulse' ? 4 : 2.5) * (1 - prog * 0.6);
        ctx.setLineDash(p.type === 'channel_pulse' ? [] : [6, 5]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (p.type === 'channel_pulse' ? 0.14 : 0.08);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha;
        continue;
      }

      if (p.type === 'status_mark') {
        const prog = p.age / p.lifetime;
        const r = p.radius * (0.8 + prog * 0.25);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.45, p.y);
        ctx.lineTo(p.x + r * 0.45, p.y);
        ctx.moveTo(p.x, p.y - r * 0.45);
        ctx.lineTo(p.x, p.y + r * 0.45);
        ctx.stroke();
        continue;
      }

      if (p.type === 'blink_trail') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2 || p.x, p.y2 || p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      if (p.type === 'heal_glow') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 - p.age / p.lifetime * 0.5), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.radius * (1 - p.age / p.lifetime * 0.3)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private createSpriteParticle(
    event: VFXEvent,
    x: number,
    y: number,
    sprite: VfxSpriteSheet,
    spriteFrameSize: { w: number; h: number } | undefined,
  ): Particle {
    return {
      id: particleIdCounter++,
      type: event.type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: event.radius || 0,
      color: event.color,
      alpha: 1,
      lifetime: Math.max(sprite.meta.frames * sprite.meta.frameDurationMs, 250),
      age: 0,
      assetKey: event.assetKey,
      sprite,
      spriteFrameSize,
    };
  }
}
