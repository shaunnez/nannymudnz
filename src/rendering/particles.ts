import type { VFXEvent } from '../simulation/types';
import { worldYToScreenY, DEPTH_SCALE } from './constants';

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
}

let particleIdCounter = 0;

export class ParticleSystem {
  private particles: Particle[] = [];

  emit(events: VFXEvent[], cameraX: number, canvasHeight: number): void {
    for (const event of events) {
      const sx = event.x - cameraX;
      const sy = worldYToScreenY(event.y, canvasHeight) - (event.z ?? 0) * DEPTH_SCALE;

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
          });
          break;

        case 'hit_spark':
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
            });
          }
          break;

        case 'aoe_pop':
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
            });
          }
          break;

        case 'heal_glow':
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
          });
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
      p.vy += 80 * dtSec;
      p.alpha = Math.max(0, 1 - p.age / p.lifetime);
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
}
