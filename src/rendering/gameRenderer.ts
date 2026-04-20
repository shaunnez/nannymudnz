import type { SimState, Actor } from '../simulation/types';
import { GUILDS } from '../simulation/guildData';
import { ENEMY_DEFS } from '../simulation/enemyData';
import { PlaceholderRenderer } from './placeholderRenderer';
import type { ActorRendererImpl, ActorRenderHandle } from './actorRenderer';
import { ParticleSystem } from './particles';
import { renderHUD, renderPauseOverlay, renderControlsHint } from './hud';
import { renderHudButtons } from './hudButtons';
import type { ComboBuffer } from '../simulation/types';

const GUILD_COLORS: Record<string, { color: string; initial: string }> = {};
for (const g of GUILDS) {
  GUILD_COLORS[g.id] = { color: g.color, initial: g.initial };
}

const ENEMY_COLORS: Record<string, { color: string; initial: string }> = {};
for (const [kind, def] of Object.entries(ENEMY_DEFS)) {
  ENEMY_COLORS[kind] = { color: def.color, initial: def.initial };
}

export class GameRenderer {
  private particles: ParticleSystem;
  private frameCount: number = 0;
  private actorRenderer: ActorRendererImpl;

  constructor(actorRenderer: ActorRendererImpl = PlaceholderRenderer) {
    this.particles = new ParticleSystem();
    this.actorRenderer = actorRenderer;
  }

  setActorRenderer(impl: ActorRendererImpl): void {
    this.actorRenderer = impl;
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    comboBuffer: ComboBuffer,
    width: number,
    height: number,
    dtMs: number,
    isFullscreen: boolean,
  ): void {
    this.frameCount++;
    this.particles.tick(dtMs);
    this.particles.emit(state.vfxEvents, state.cameraX);

    this.renderBackground(ctx, state, width, height);

    this.renderPickups(ctx, state, height);

    const allActors: Actor[] = [
      ...state.enemies,
      ...state.allies,
      state.player,
    ].sort((a, b) => a.y - b.y);

    for (const actor of allActors) {
      this.renderActor(ctx, actor, state.cameraX, width, height);
    }

    this.renderProjectiles(ctx, state, height);

    this.particles.render(ctx);

    renderHUD(ctx, state, comboBuffer, width, height);

    renderControlsHint(ctx, width, height, state.timeMs, state.phase === 'paused');

    renderHudButtons(ctx, state.phase === 'paused', isFullscreen);

    if (state.phase === 'paused') {
      renderPauseOverlay(ctx, width, height);
    }

    if (state.bossSpawned) {
      this.renderBossHP(ctx, state, width);
    }

    this.renderDepthGuide(ctx, state, height);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, state: SimState, width: number, height: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
    grad.addColorStop(0, '#5b8fc4');
    grad.addColorStop(0.5, '#87b0d4');
    grad.addColorStop(1, '#c4d9e8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height * 0.55);

    const cx = -state.cameraX;

    this.renderHills(ctx, cx, height, width);

    this.renderGround(ctx, cx, height, width);
  }

  private renderHills(ctx: CanvasRenderingContext2D, cx: number, height: number, width: number): void {
    const groundTopScreen = height * 0.45;

    const hillColors = ['#6b7c4a', '#7a8f55', '#8fa366'];
    const hillDatas = [
      { parallax: 0.15, yBase: groundTopScreen - 30, amplitude: 55, period: 600, offset: 0 },
      { parallax: 0.25, yBase: groundTopScreen - 15, amplitude: 40, period: 400, offset: 200 },
      { parallax: 0.35, yBase: groundTopScreen, amplitude: 25, period: 300, offset: 100 },
    ];

    for (let hi = 0; hi < hillDatas.length; hi++) {
      const hd = hillDatas[hi];
      const scrollX = cx * hd.parallax;
      ctx.fillStyle = hillColors[hi];
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let px = -50; px <= width + 50; px += 10) {
        const wx = px - scrollX + hd.offset;
        const hy = hd.yBase - Math.abs(Math.sin(wx / hd.period * Math.PI)) * hd.amplitude;
        if (px === -50) ctx.moveTo(px, hy);
        else ctx.lineTo(px, hy);
      }
      ctx.lineTo(width + 50, height);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderGround(ctx: CanvasRenderingContext2D, cx: number, height: number, width: number): void {
    const groundTopScreen = height * 0.45;
    const groundHeight = height - groundTopScreen;

    const grad = ctx.createLinearGradient(0, groundTopScreen, 0, height);
    grad.addColorStop(0, '#8ea85e');
    grad.addColorStop(0.15, '#7d9650');
    grad.addColorStop(0.3, '#c9a96e');
    grad.addColorStop(0.7, '#b8975e');
    grad.addColorStop(1, '#a08050');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundTopScreen, width, groundHeight);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    const stripeSpacing = 40;
    const startX = ((cx * 0.8) % stripeSpacing);
    for (let px = startX; px < width + stripeSpacing; px += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(px, groundTopScreen);
      ctx.lineTo(px - 20, height);
      ctx.stroke();
    }

    ctx.strokeStyle = '#6b8042';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundTopScreen);
    ctx.lineTo(width, groundTopScreen);
    ctx.stroke();
  }

  private renderActor(ctx: CanvasRenderingContext2D, actor: Actor, cameraX: number, canvasWidth: number, canvasHeight: number): void {
    const screenX = actor.x - cameraX;
    const groundScreenY = this.worldYToScreenY(actor.y, canvasHeight);
    const screenY = groundScreenY - actor.z * 0.6;

    if (screenX < -actor.width || screenX > canvasWidth + actor.width) return;

    let color = '#888888';
    let initial = '?';

    if (actor.isPlayer && actor.guildId) {
      const gd = GUILD_COLORS[actor.guildId];
      if (gd) { color = gd.color; initial = gd.initial; }
    } else {
      const ed = ENEMY_COLORS[actor.kind];
      if (ed) { color = ed.color; initial = ed.initial; }
      if (actor.team === 'player') {
        color = '#a3e635';
        initial = 'A';
      }
    }

    if (actor.z > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(screenX, groundScreenY - 2, actor.width * 0.4 * Math.min(1, 1 - actor.z / 200), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const handle: ActorRenderHandle = {
      actorKind: actor.kind,
      animationId: actor.animationId,
      direction: actor.facing,
      frameIndex: this.frameCount,
      x: actor.x,
      y: actor.y,
      z: actor.z,
    };

    ctx.save();

    if (actor.statusEffects.some(e => e.type === 'stun')) {
      ctx.globalAlpha = 0.7;
    }
    if (actor.statusEffects.some(e => e.type === 'stealth')) {
      ctx.globalAlpha = 0.35;
    }
    if (actor.invulnerableMs > 0 && actor.state === 'getup') {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    this.actorRenderer.renderActor(
      ctx, handle, color, initial,
      screenX, screenY, actor.width, actor.height,
      actor.isAlive, actor.hp, actor.hpMax,
    );

    if (actor.statusEffects.some(e => e.type === 'stun' || e.type === 'daze')) {
      this.renderStunStars(ctx, screenX, screenY - actor.height);
    }

    ctx.restore();

    if (actor.kind === 'bandit_king' || actor.bossPhase > 0) {
      this.renderBossIndicator(ctx, actor, screenX, screenY);
    }
  }

  private renderStunStars(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const t = this.frameCount * 0.1;
    for (let i = 0; i < 3; i++) {
      const angle = t + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(angle) * 14;
      const sy = y - 10 + Math.sin(angle) * 5;
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', sx, sy);
    }
  }

  private renderBossIndicator(ctx: CanvasRenderingContext2D, actor: Actor, sx: number, sy: number): void {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', sx, sy - actor.height - 14);
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D, state: SimState, canvasHeight: number): void {
    for (const proj of state.projectiles) {
      const sx = proj.x - state.cameraX;
      const sy = this.worldYToScreenY(proj.y, canvasHeight) - proj.z * 0.5;

      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;

      if (proj.type === 'arrow' || proj.type.includes('shot') || proj.type.includes('bolt') || proj.type.includes('volley')) {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.fillRect(-8, -2, 16, 4);
      } else if (proj.type.includes('throw')) {
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, proj.radius * 2.5);
        glow.addColorStop(0, proj.color + '88');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderPickups(ctx: CanvasRenderingContext2D, state: SimState, canvasHeight: number): void {
    for (const pickup of state.pickups) {
      const sx = pickup.x - state.cameraX;
      const sy = this.worldYToScreenY(pickup.y, canvasHeight);

      ctx.save();
      ctx.fillStyle = pickup.type === 'rock' ? '#9ca3af' : '#92400e';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;

      if (pickup.type === 'rock') {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(sx - 4, sy - 14, 8, 14);
        ctx.stroke();
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(sx - 6, sy - 16, 12, 4);
      }

      ctx.fillStyle = '#fbbf24';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('L', sx, sy - 20);

      ctx.restore();
    }
  }

  private renderBossHP(ctx: CanvasRenderingContext2D, state: SimState, canvasWidth: number): void {
    const boss = state.enemies.find(e => e.kind === 'bandit_king' && e.isAlive);
    if (!boss) return;

    const barW = canvasWidth * 0.5;
    const barH = 16;
    const barX = (canvasWidth - barW) / 2;
    const barY = canvasWidth > 800 ? 68 : 60;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(barX - 10, barY - 24, barW + 20, barH + 32, 6);
    ctx.fill();

    ctx.fillStyle = '#f9fafb';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☠ Bandit King of the Plains ☠', canvasWidth / 2, barY - 8);

    ctx.fillStyle = '#111827';
    ctx.fillRect(barX, barY, barW, barH);

    const hpFrac = Math.max(0, boss.hp / boss.hpMax);
    const phase = boss.bossPhase;
    const color = phase === 2 ? '#ff4500' : phase === 1 ? '#f97316' : '#dc2626';
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * hpFrac, barH);

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    const thresholds = [0.5, 0.25];
    for (const t of thresholds) {
      const tx = barX + barW * t;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(tx, barY);
      ctx.lineTo(tx, barY + barH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const phaseLabel = phase === 2 ? 'ENRAGE' : phase === 1 ? 'Phase 2' : 'Phase 1';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phaseLabel, canvasWidth / 2, barY + barH + 12);
  }

  private renderDepthGuide(ctx: CanvasRenderingContext2D, state: SimState, canvasHeight: number): void {
    const sx = state.player.x - state.cameraX;
    const sy = this.worldYToScreenY(state.player.y, canvasHeight);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, sy + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private worldYToScreenY(worldY: number, canvasHeight: number): number {
    const WORLD_Y_MIN = 60;
    const WORLD_Y_MAX = 380;
    const SCREEN_Y_MIN = canvasHeight * 0.42;
    const SCREEN_Y_MAX = canvasHeight * 0.92;
    const t = (worldY - WORLD_Y_MIN) / (WORLD_Y_MAX - WORLD_Y_MIN);
    return SCREEN_Y_MIN + t * (SCREEN_Y_MAX - SCREEN_Y_MIN);
  }
}
