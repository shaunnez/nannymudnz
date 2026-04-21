import type { ActorRendererImpl, ActorRenderHandle } from '../actorRenderer';
import type { GuildSpriteSet } from './types';
import { resolveAnimation } from './animationFallback';

interface AnimPlayhead {
  animationId: string;
  startMs: number;
}

export class SpriteActorRenderer implements ActorRendererImpl {
  private set: GuildSpriteSet;
  private playheads: Map<string, AnimPlayhead> = new Map();

  constructor(set: GuildSpriteSet) {
    this.set = set;
  }

  renderActor(
    ctx: CanvasRenderingContext2D,
    handle: ActorRenderHandle,
    color: string,
    _initial: string,
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    isAlive: boolean,
    hp: number,
    hpMax: number,
  ): void {
    if (!isAlive) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fillRect(screenX - width / 2, screenY - height * 0.2, width, height * 0.2);
      ctx.restore();
      return;
    }

    const resolvedId = resolveAnimation(handle.animationId, this.set.sheets);
    const sheet = this.set.sheets[resolvedId];
    if (!sheet) {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(screenX - 16, screenY - 32, 32, 32);
      return;
    }

    const { frames, loop, frameDurationMs } = sheet.meta;
    const now = performance.now();
    let playhead = this.playheads.get(handle.id);
    if (!playhead || playhead.animationId !== resolvedId) {
      playhead = { animationId: resolvedId, startMs: now };
      this.playheads.set(handle.id, playhead);
    }
    const elapsed = now - playhead.startMs;
    const rawFrame = Math.floor(elapsed / frameDurationMs);
    const frameIdx = loop ? rawFrame % frames : Math.min(rawFrame, frames - 1);

    const { w: fw, h: fh } = this.set.frameSize;
    const { x: ax, y: ay } = sheet.meta.anchor;

    ctx.save();
    if (handle.direction === -1) {
      ctx.translate(screenX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-screenX, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet.image,
      frameIdx * fw, 0, fw, fh,
      screenX - ax, screenY - ay, fw, fh,
    );
    ctx.restore();

    if (hp < hpMax) {
      const barW = width;
      const barH = 4;
      const barX = screenX - barW / 2;
      const barY = screenY - ay - 10;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * (hp / hpMax), barH);
    }
  }
}
