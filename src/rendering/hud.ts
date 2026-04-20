import type { SimState } from '../simulation/types';
import { GUILDS } from '../simulation/guildData';
import type { ComboBuffer } from '../simulation/types';
import { getComboHints } from '../simulation/comboBuffer';

const GUILD_ABILITY_NAMES: Record<string, Record<string, string>> = {};
for (const g of GUILDS) {
  GUILD_ABILITY_NAMES[g.id] = {};
  for (const a of g.abilities) {
    GUILD_ABILITY_NAMES[g.id][a.combo] = a.name;
  }
}

const COMBO_DISPLAY: Record<string, string> = {
  'down,down,attack': '↓↓J',
  'right,right,attack': '→→J',
  'down,up,attack': '↓↑J',
  'left,right,attack': '←→J',
  'down,up,down,up,attack': '↓↑↓↑J',
};

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  comboBuffer: ComboBuffer,
  width: number,
  height: number,
): void {
  const player = state.player;
  const guild = GUILDS.find(g => g.id === player.guildId);
  if (!guild) return;

  ctx.save();

  renderPortrait(ctx, guild, player);

  renderHPBar(ctx, player);

  renderResourceBar(ctx, player, guild);

  renderWaveInfo(ctx, state, width);

  renderComboHints(ctx, player, guild, comboBuffer, state.timeMs, width, height);

  renderScore(ctx, state.score, width, height);

  renderSpecialInfo(ctx, player, width);

  ctx.restore();
}

function renderPortrait(ctx: CanvasRenderingContext2D, guild: typeof GUILDS[0], _player: any): void {
  ctx.fillStyle = guild.color;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(10, 10, 50, 50, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(guild.initial, 35, 35);

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(guild.name, 12, 67);
}

function renderHPBar(ctx: CanvasRenderingContext2D, player: any): void {
  const barX = 68;
  const barY = 12;
  const barW = 200;
  const barH = 14;

  ctx.fillStyle = '#111827';
  ctx.fillRect(barX, barY, barW, barH);

  const darkFrac = Math.min(1, player.hpDark / player.hpMax);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(barX, barY, barW * darkFrac, barH);

  const hpFrac = Math.min(1, player.hp / player.hpMax);
  const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  hpGrad.addColorStop(0, '#ef4444');
  hpGrad.addColorStop(1, '#b91c1c');
  ctx.fillStyle = hpGrad;
  ctx.fillRect(barX, barY, barW * hpFrac, barH);

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.hpMax}`, barX + barW / 2, barY + barH / 2);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP', barX - 2, barY - 2);
}

function renderResourceBar(ctx: CanvasRenderingContext2D, player: any, guild: typeof GUILDS[0]): void {
  const barX = 68;
  const barY = 30;
  const barW = 200;
  const barH = 10;

  ctx.fillStyle = '#111827';
  ctx.fillRect(barX, barY, barW, barH);

  const resFrac = Math.min(1, player.mp / player.mpMax);
  ctx.fillStyle = guild.resource.color;
  ctx.fillRect(barX, barY, barW * resFrac, barH);

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${guild.resource.name}: ${Math.ceil(player.mp)}/${player.mpMax}`, barX, barY + barH + 8);

  if (player.guildId === 'monk' && player.chiOrbs !== undefined) {
    for (let i = 0; i < 5; i++) {
      const filled = i < player.chiOrbs;
      ctx.fillStyle = filled ? '#fcd34d' : '#374151';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(barX + 10 + i * 18, barY + barH + 18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (player.guildId === 'champion' && player.bloodtally !== undefined) {
    for (let i = 0; i < 10; i++) {
      const filled = i < player.bloodtally;
      ctx.fillStyle = filled ? '#dc2626' : '#374151';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(barX + 7 + i * 14, barY + barH + 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (player.guildId === 'cultist' && player.sanity !== undefined) {
    const sanity = player.sanity;
    let color = '#4ade80';
    if (sanity >= 80) color = '#ef4444';
    else if (sanity >= 60) color = '#f97316';
    else if (sanity >= 40) color = '#fbbf24';
    ctx.fillStyle = color;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Sanity Risk: ${Math.round(sanity)}%`, barX, barY + barH + 18);
  }
}

function renderWaveInfo(ctx: CanvasRenderingContext2D, state: SimState, canvasWidth: number): void {
  const totalWaves = state.waves.length;
  const currentWave = state.currentWave + 1;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(canvasWidth - 220, 10, 210, 36, 6);
  ctx.fill();

  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Plains of Nan', canvasWidth - 115, 21);

  ctx.fillStyle = '#d1d5db';
  ctx.font = '11px sans-serif';
  const waveText = state.bossSpawned ? 'BOSS BATTLE!' : `Wave ${currentWave} / ${totalWaves}`;
  ctx.fillText(waveText, canvasWidth - 115, 36);

  for (let i = 0; i < totalWaves; i++) {
    const wx = canvasWidth - 205 + i * 28;
    const wave = state.waves[i];
    ctx.fillStyle = wave.cleared ? '#4ade80' : wave.triggered ? '#fbbf24' : '#374151';
    ctx.beginPath();
    ctx.arc(wx, 52, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function renderComboHints(
  ctx: CanvasRenderingContext2D,
  player: any,
  guild: typeof GUILDS[0],
  comboBuffer: ComboBuffer,
  nowMs: number,
  _canvasWidth: number,
  canvasHeight: number,
): void {
  const hints = getComboHints(comboBuffer, nowMs);
  if (hints.length === 0) return;

  const baseX = 10;
  const baseY = canvasHeight - 80;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(baseX, baseY, 240, hints.length * 22 + 16, 6);
  ctx.fill();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Combo hints:', baseX + 8, baseY + 12);

  hints.slice(0, 5).forEach((hint, i) => {
    const ability = guild.abilities.find(a => a.combo === hint);
    if (!ability) return;
    const cdRemaining = Math.max(0, (player.abilityCooldowns[ability.id] || 0) - nowMs);
    const onCd = cdRemaining > 0;

    ctx.fillStyle = onCd ? '#6b7280' : '#e5e7eb';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(COMBO_DISPLAY[hint] || hint, baseX + 8, baseY + 24 + i * 22);

    ctx.fillStyle = onCd ? '#6b7280' : guild.color;
    ctx.font = '11px sans-serif';
    ctx.fillText(
      `${ability.name}${onCd ? ` (${Math.ceil(cdRemaining / 1000)}s)` : ''}`,
      baseX + 60,
      baseY + 24 + i * 22,
    );
  });
}

function renderScore(ctx: CanvasRenderingContext2D, score: number, canvasWidth: number, canvasHeight: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(canvasWidth - 130, canvasHeight - 36, 120, 28, 6);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Score: ${score}`, canvasWidth - 70, canvasHeight - 22);
}

function renderSpecialInfo(ctx: CanvasRenderingContext2D, player: any, _canvasWidth: number): void {
  const infos: string[] = [];

  if (player.shapeshiftForm && player.shapeshiftForm !== 'none') {
    infos.push(`Form: ${player.shapeshiftForm.toUpperCase()}`);
  }
  if (player.primedClass && player.guildId === 'master') {
    infos.push(`Primed: ${player.primedClass}`);
  }
  if (player.heldPickup) {
    infos.push(`Holding: ${player.heldPickup.type} (${player.heldPickup.hitsLeft} hits)`);
  }
  if (player.miasmaActive) {
    infos.push('MIASMA ACTIVE');
  }

  if (infos.length === 0) return;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(68, 62, 200, infos.length * 14 + 8, 4);
  ctx.fill();

  infos.forEach((info, i) => {
    ctx.fillStyle = '#d1fae5';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(info, 74, 70 + i * 14);
  });
}

export function renderPauseOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', width / 2, height / 2 - 30);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('Press Esc to resume', width / 2, height / 2 + 10);
}
