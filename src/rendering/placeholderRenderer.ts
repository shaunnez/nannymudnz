import type { ActorRendererImpl } from './actorRenderer';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}

function darken(hex: string, amount = 40): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

export const PlaceholderRenderer: ActorRendererImpl = {
  renderActor(ctx, handle, color, initial, sx, sy, width, height, isAlive, hp, hpMax) {
    if (!isAlive) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fillRect(sx - width / 2, sy - height * 0.2, width, height * 0.2);
      ctx.restore();
      return;
    }

    const shadow_y = sy;
    const body_y = sy - height;
    const anim = handle.animationId;
    const dir = handle.direction;
    const t = handle.frameIndex;

    let offsetX = 0;
    let offsetY = 0;
    let squishX = 1;
    let squishY = 1;
    let legOffset = 0;

    if (anim === 'walk' || anim === 'run') {
      const speed = anim === 'run' ? 1.5 : 1;
      legOffset = Math.sin(t * 0.15 * speed) * 6;
      offsetY = Math.abs(Math.sin(t * 0.15 * speed)) * -2;
    } else if (anim === 'attack_1' || anim === 'attack_2' || anim === 'attack_3') {
      const phase = (t % 20) / 20;
      offsetX = dir * Math.sin(phase * Math.PI) * 8;
      squishX = 1 + Math.sin(phase * Math.PI) * 0.15;
      squishY = 1 - Math.sin(phase * Math.PI) * 0.1;
    } else if (anim === 'jump' || anim === 'fall') {
      squishX = 0.85;
      squishY = 1.15;
    } else if (anim === 'land') {
      squishX = 1.3;
      squishY = 0.75;
    } else if (anim === 'hurt') {
      offsetX = dir * -4;
    } else if (anim === 'block') {
      squishX = 0.85;
      offsetX = dir * -3;
    } else if (anim === 'channel') {
      const glow = Math.sin(t * 0.1) * 0.3 + 0.7;
      ctx.save();
      ctx.globalAlpha = glow * 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(sx + offsetX, body_y + height / 2 + offsetY, width * 0.8, height * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (handle.z === 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(sx, shadow_y - 2, width * 0.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const bx = sx + offsetX;
    const by = body_y + offsetY;

    ctx.save();
    ctx.translate(bx, by + height / 2);
    ctx.scale(squishX, squishY);

    const outline = darken(color, 50);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 4);
    ctx.fill();
    ctx.stroke();

    if (anim === 'block') {
      ctx.fillStyle = darken(color, 20);
      ctx.fillRect(-width / 2 - 4, -height / 2 + 5, 8, height * 0.6);
      ctx.strokeRect(-width / 2 - 4, -height / 2 + 5, 8, height * 0.6);
    }

    const noseDir = dir;
    ctx.fillStyle = color === '#ffffff' ? '#888888' : '#ffffff';
    ctx.beginPath();
    const noseX = noseDir * (width / 2);
    const noseY = -height / 4;
    ctx.moveTo(noseX, noseY - 5);
    ctx.lineTo(noseX + noseDir * 8, noseY);
    ctx.lineTo(noseX, noseY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(16, width * 0.4)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, 0, 0);

    ctx.restore();

    if (anim === 'walk' || anim === 'run') {
      const speed = anim === 'run' ? 2 : 1.2;
      ctx.save();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by + height - 4);
      ctx.lineTo(bx - 6, by + height + legOffset * speed);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 6, by + height - 4);
      ctx.lineTo(bx + 6, by + height - legOffset * speed);
      ctx.stroke();
      ctx.restore();
    }

    if ((anim === 'attack_1' || anim === 'attack_2' || anim === 'attack_3') && handle.direction === 1) {
      const phase = (t % 20) / 20;
      const armLen = 20 + Math.sin(phase * Math.PI) * 15;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bx + dir * width / 2, by + height * 0.35);
      ctx.lineTo(bx + dir * (width / 2 + armLen), by + height * 0.35 + Math.sin(phase * Math.PI * 2) * 8);
      ctx.stroke();
      ctx.restore();
    }

    if (hp < hpMax) {
      const barW = width;
      const barH = 4;
      const barX = bx - barW / 2;
      const barY = body_y - 10;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * (hp / hpMax), barH);
    }
  },
};
