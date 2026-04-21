import Phaser from 'phaser';
import type { SimState, Actor } from '../../simulation/types';
import { GUILDS } from '../../simulation/guildData';
import { getComboHints } from '../../simulation/comboBuffer';
import { VIRTUAL_WIDTH } from '../constants';
import type { GameCallbacks } from '../PhaserGame';

const COMBO_DISPLAY: Record<string, string> = {
  'down,down,attack': '↓↓J',
  'right,right,attack': '→→J',
  'down,up,attack': '↓↑J',
  'left,right,attack': '←→J',
  'down,up,down,up,attack': '↓↑↓↑J',
};

const CONTROLS_TEXT = '← → ↑ ↓ Move  |  Space Jump  |  J Attack  |  K Block  |  L Grab  |  P Pause  |  F Fullscreen';

/**
 * HUD overlay scene. Renders screen-space UI: portrait, HP bar, resource bar,
 * wave pips, boss bar, score, and a few per-guild resource indicators.
 * Combo hints, controls hint, and pause dim live here too but land in Task 11.
 *
 * Data flow: GameplayScene pushes its latest SimState into
 * this.game.registry.set('simState', state) each tick. HudScene.update pulls
 * it and redraws. This keeps HudScene independent of GameplayScene internals
 * and lets it be paused/resumed without coupling.
 */
export class HudScene extends Phaser.Scene {
  private portrait!: Phaser.GameObjects.Graphics;
  private portraitInitial!: Phaser.GameObjects.Text;
  private portraitName!: Phaser.GameObjects.Text;

  private hpBg!: Phaser.GameObjects.Graphics;
  private hpDark!: Phaser.GameObjects.Graphics;
  private hpFg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;

  private resBg!: Phaser.GameObjects.Graphics;
  private resFg!: Phaser.GameObjects.Graphics;
  private resText!: Phaser.GameObjects.Text;

  private waveBg!: Phaser.GameObjects.Graphics;
  private waveSubtitle!: Phaser.GameObjects.Text;
  private wavePips!: Phaser.GameObjects.Graphics;

  private scoreBg!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;

  private bossBar!: Phaser.GameObjects.Graphics;
  private bossBarFg!: Phaser.GameObjects.Graphics;
  private bossLabel!: Phaser.GameObjects.Text;

  private specialBg!: Phaser.GameObjects.Graphics;
  private specialTexts: Phaser.GameObjects.Text[] = [];

  private chiOrbs!: Phaser.GameObjects.Graphics;
  private bloodtally!: Phaser.GameObjects.Graphics;
  private sanityText!: Phaser.GameObjects.Text;

  private comboBg!: Phaser.GameObjects.Graphics;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboLines: Phaser.GameObjects.Text[] = [];

  private controlsText!: Phaser.GameObjects.Text;
  private pauseDim!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'Hud' });
  }

  create(): void {
    this.portrait = this.add.graphics();
    this.portraitInitial = this.add
      .text(35, 35, '', { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);
    this.portraitName = this.add
      .text(12, 67, '', { fontFamily: 'sans-serif', fontSize: '10px', color: '#e5e7eb' });

    this.hpBg = this.add.graphics();
    this.hpDark = this.add.graphics();
    this.hpFg = this.add.graphics();
    this.hpText = this.add
      .text(168, 19, '', { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '10px', color: '#f9fafb' })
      .setOrigin(0.5);
    this.hpLabel = this.add
      .text(66, 10, 'HP', { fontFamily: 'sans-serif', fontSize: '9px', color: '#9ca3af' });

    this.resBg = this.add.graphics();
    this.resFg = this.add.graphics();
    this.resText = this.add
      .text(68, 48, '', { fontFamily: 'sans-serif', fontSize: '9px', color: '#9ca3af' });

    this.waveBg = this.add.graphics();
    this.add
      .text(VIRTUAL_WIDTH - 115, 21, 'Plains of Nan', {
        fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '13px', color: '#f9fafb',
      })
      .setOrigin(0.5);
    this.waveSubtitle = this.add
      .text(VIRTUAL_WIDTH - 115, 36, '', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#d1d5db',
      })
      .setOrigin(0.5);
    this.wavePips = this.add.graphics();

    this.scoreBg = this.add.graphics();
    this.scoreText = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '12px', color: '#fbbf24' })
      .setOrigin(0.5);

    this.bossBar = this.add.graphics();
    this.bossBarFg = this.add.graphics();
    this.bossLabel = this.add
      .text(VIRTUAL_WIDTH / 2, 82, '', {
        fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '12px', color: '#fca5a5',
      })
      .setOrigin(0.5);

    this.specialBg = this.add.graphics();

    this.chiOrbs = this.add.graphics();
    this.bloodtally = this.add.graphics();
    this.sanityText = this.add
      .text(68, 58, '', { fontFamily: 'sans-serif', fontSize: '9px', color: '#9ca3af' });

    // Pause dim sits below HUD overlays but above the world (React's pause
    // overlay still lands on top of the <canvas>). Start hidden.
    this.pauseDim = this.add.graphics().setDepth(10);
    this.pauseDim.fillStyle(0x000000, 0.6);
    this.pauseDim.fillRect(0, 0, VIRTUAL_WIDTH, this.scale.height);
    this.pauseDim.setVisible(false);

    this.comboBg = this.add.graphics();
    this.comboLabel = this.add
      .text(18, 0, 'Combo hints:', { fontFamily: 'sans-serif', fontSize: '10px', color: '#9ca3af' });
    this.comboLabel.setVisible(false);

    this.controlsText = this.add
      .text(VIRTUAL_WIDTH / 2, this.scale.height - 8, CONTROLS_TEXT, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#9ca3af',
      })
      .setOrigin(0.5, 1);

    this.createHudButtons();

    // HUD scene's camera ignores world. Since HudScene is launched as a
    // sibling scene, it draws to the same canvas but runs on the same main
    // camera — our setScrollFactor(0) + depth layering gives us the overlay
    // effect without needing a separate camera.
  }

  update(): void {
    const state = this.game.registry.get('simState') as SimState | undefined;
    if (!state) return;

    const player = state.player;
    const guild = GUILDS.find(g => g.id === player.guildId);
    if (!guild) return;

    this.drawPortrait(guild);
    this.drawHpBar(player);
    this.drawResourceBar(player, guild);
    this.drawWaveInfo(state);
    this.drawScore(state.score);
    this.drawBossBar(state);
    this.drawSpecialInfo(player);
    this.drawGuildResources(player);
    this.drawComboHints(state, player, guild);
    this.drawControlsHint(state);
    this.drawPauseDim(state);
  }

  private drawComboHints(state: SimState, player: Actor, guild: typeof GUILDS[0]): void {
    const controller = state.controllers.player;
    const buffer = controller?.comboBuffer;
    const bg = this.comboBg;
    bg.clear();
    for (const t of this.comboLines) t.destroy();
    this.comboLines = [];
    this.comboLabel.setVisible(false);
    if (!buffer) return;

    const hints = getComboHints(buffer, state.timeMs);
    if (hints.length === 0) return;

    const baseX = 10;
    const baseY = this.scale.height - 80;
    const h = hints.length * 22 + 16;

    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(baseX, baseY, 240, h, 6);

    this.comboLabel.setPosition(baseX + 8, baseY + 6);
    this.comboLabel.setVisible(true);

    hints.slice(0, 5).forEach((hint, i) => {
      const ability = guild.abilities.find(a => a.combo === hint);
      if (!ability) return;
      const cdRemaining = Math.max(0, (player.abilityCooldowns[ability.id] || 0) - state.timeMs);
      const onCd = cdRemaining > 0;
      const comboColor = onCd ? '#6b7280' : '#e5e7eb';
      const nameColor = onCd ? '#6b7280' : guild.color;
      const comboTxt = this.add.text(baseX + 8, baseY + 20 + i * 22,
        COMBO_DISPLAY[hint] || hint,
        { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '11px', color: comboColor });
      const nameTxt = this.add.text(baseX + 60, baseY + 20 + i * 22,
        `${ability.name}${onCd ? ` (${Math.ceil(cdRemaining / 1000)}s)` : ''}`,
        { fontFamily: 'sans-serif', fontSize: '11px', color: nameColor });
      this.comboLines.push(comboTxt, nameTxt);
    });
  }

  private drawControlsHint(state: SimState): void {
    const isFullscreen = this.game.registry.get('isFullscreen') as boolean | undefined;
    const isPaused = state.phase === 'paused';
    const fadeStart = 4000;
    const fadeEnd = 5000;
    let alpha: number;
    if (isFullscreen) {
      this.controlsText.setVisible(false);
      return;
    }
    if (isPaused) alpha = 0.9;
    else if (state.timeMs < fadeStart) alpha = 0.7;
    else if (state.timeMs < fadeEnd) alpha = 0.7 * (1 - (state.timeMs - fadeStart) / (fadeEnd - fadeStart));
    else {
      this.controlsText.setVisible(false);
      return;
    }
    this.controlsText.setAlpha(alpha);
    this.controlsText.setVisible(true);
  }

  private drawPauseDim(state: SimState): void {
    this.pauseDim.setVisible(state.phase === 'paused');
  }

  private createHudButtons(): void {
    const y = 14;
    const spacing = 34;
    const rightEdge = VIRTUAL_WIDTH - 12;

    const quit = this.makeButton(rightEdge - spacing * 2, y, 'Q', '#fca5a5');
    quit.container.on('pointerdown', () => {
      const callbacks = this.game.registry.get('callbacks') as GameCallbacks | undefined;
      callbacks?.onQuit();
    });

    const fs = this.makeButton(rightEdge - spacing, y, 'F', '#d1d5db');
    fs.container.on('pointerdown', () => {
      const callbacks = this.game.registry.get('callbacks') as GameCallbacks | undefined;
      callbacks?.toggleFullscreen();
    });

    const pause = this.makeButton(rightEdge, y, 'P', '#fde68a');
    pause.container.on('pointerdown', () => {
      const gameplay = this.scene.get('Gameplay');
      gameplay.events.emit('pause-requested');
    });
  }

  private makeButton(x: number, y: number, letter: string, tint: string): {
    container: Phaser.GameObjects.Container;
  } {
    const size = 26;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.lineStyle(1, 0x4b5563, 1);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
    const label = this.add
      .text(0, 0, letter, {
        fontFamily: 'monospace', fontStyle: 'bold', fontSize: '14px', color: tint,
      })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [bg, label]);
    container.setSize(size, size);
    container.setInteractive({ useHandCursor: true });
    container.setDepth(50);
    return { container };
  }

  private drawPortrait(guild: typeof GUILDS[0]): void {
    const g = this.portrait;
    g.clear();
    g.fillStyle(hexToInt(guild.color), 1);
    g.lineStyle(2, 0x1f2937, 1);
    g.fillRoundedRect(10, 10, 50, 50, 6);
    g.strokeRoundedRect(10, 10, 50, 50, 6);
    this.portraitInitial.setText(guild.initial);
    this.portraitName.setText(guild.name);
  }

  private drawHpBar(player: Actor): void {
    const barX = 68, barY = 12, barW = 200, barH = 14;
    const bg = this.hpBg;
    bg.clear();
    bg.fillStyle(0x111827, 1);
    bg.fillRect(barX, barY, barW, barH);
    bg.lineStyle(1, 0x374151, 1);
    bg.strokeRect(barX, barY, barW, barH);

    const dark = this.hpDark;
    dark.clear();
    const darkFrac = Math.min(1, player.hpDark / player.hpMax);
    dark.fillStyle(0x7f1d1d, 1);
    dark.fillRect(barX, barY, barW * darkFrac, barH);

    const fg = this.hpFg;
    fg.clear();
    const hpFrac = Math.min(1, player.hp / player.hpMax);
    fg.fillStyle(0xef4444, 1);
    fg.fillRect(barX, barY, barW * hpFrac, barH);

    this.hpText.setText(`${Math.ceil(player.hp)} / ${player.hpMax}`);
    this.hpText.setPosition(barX + barW / 2, barY + barH / 2);
    this.hpLabel.setPosition(barX - 2, barY - 12);
  }

  private drawResourceBar(player: Actor, guild: typeof GUILDS[0]): void {
    const barX = 68, barY = 30, barW = 200, barH = 10;
    const bg = this.resBg;
    bg.clear();
    bg.fillStyle(0x111827, 1);
    bg.fillRect(barX, barY, barW, barH);
    bg.lineStyle(1, 0x374151, 1);
    bg.strokeRect(barX, barY, barW, barH);

    const fg = this.resFg;
    fg.clear();
    const resFrac = Math.min(1, player.mp / player.mpMax);
    fg.fillStyle(hexToInt(guild.resource.color), 1);
    fg.fillRect(barX, barY, barW * resFrac, barH);

    this.resText.setText(`${guild.resource.name}: ${Math.ceil(player.mp)}/${player.mpMax}`);
    this.resText.setPosition(barX, barY + barH + 4);
  }

  private drawWaveInfo(state: SimState): void {
    const bg = this.waveBg;
    bg.clear();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(VIRTUAL_WIDTH - 220, 10, 210, 36, 6);

    const totalWaves = state.waves.length;
    const currentWave = state.currentWave + 1;
    const waveText = state.bossSpawned ? 'BOSS BATTLE!' : `Wave ${currentWave} / ${totalWaves}`;
    this.waveSubtitle.setText(waveText);

    const pips = this.wavePips;
    pips.clear();
    for (let i = 0; i < totalWaves; i++) {
      const wave = state.waves[i];
      const color = wave.cleared ? 0x4ade80 : wave.triggered ? 0xfbbf24 : 0x374151;
      const wx = VIRTUAL_WIDTH - 205 + i * 28;
      pips.fillStyle(color, 1);
      pips.fillCircle(wx, 52, 8);
      pips.lineStyle(1, 0x1f2937, 1);
      pips.strokeCircle(wx, 52, 8);
    }
  }

  private drawScore(score: number): void {
    const bg = this.scoreBg;
    bg.clear();
    const h = this.scale.height;
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(VIRTUAL_WIDTH - 130, h - 36, 120, 28, 6);
    this.scoreText.setText(`Score: ${score}`);
    this.scoreText.setPosition(VIRTUAL_WIDTH - 70, h - 22);
  }

  private drawBossBar(state: SimState): void {
    const boss = state.enemies.find(e => e.isAlive && e.aiState.behavior === 'boss');
    const bg = this.bossBar;
    const fg = this.bossBarFg;
    bg.clear();
    fg.clear();
    if (!state.bossSpawned || !boss) {
      this.bossLabel.setVisible(false);
      return;
    }
    const barW = 360, barH = 14;
    const barX = (VIRTUAL_WIDTH - barW) / 2;
    const barY = 62;
    bg.fillStyle(0x1f2937, 0.9);
    bg.fillRect(barX, barY, barW, barH);
    bg.lineStyle(1, 0x7f1d1d, 1);
    bg.strokeRect(barX, barY, barW, barH);
    const frac = Math.max(0, Math.min(1, boss.hp / boss.hpMax));
    fg.fillStyle(0xdc2626, 1);
    fg.fillRect(barX, barY, barW * frac, barH);
    this.bossLabel.setText(boss.kind.toUpperCase());
    this.bossLabel.setVisible(true);
  }

  private drawSpecialInfo(player: Actor): void {
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
    if (player.miasmaActive) infos.push('MIASMA ACTIVE');

    const bg = this.specialBg;
    bg.clear();
    for (const t of this.specialTexts) t.destroy();
    this.specialTexts = [];
    if (infos.length === 0) return;

    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(68, 62, 200, infos.length * 14 + 8, 4);

    infos.forEach((info, i) => {
      const t = this.add
        .text(74, 70 + i * 14, info, { fontFamily: 'sans-serif', fontSize: '10px', color: '#d1fae5' });
      this.specialTexts.push(t);
    });
  }

  private drawGuildResources(player: Actor): void {
    const chi = this.chiOrbs;
    chi.clear();
    if (player.guildId === 'monk' && player.chiOrbs !== undefined) {
      for (let i = 0; i < 5; i++) {
        const filled = i < player.chiOrbs;
        chi.fillStyle(filled ? 0xfcd34d : 0x374151, 1);
        chi.lineStyle(1, 0x1f2937, 1);
        chi.fillCircle(68 + 10 + i * 18, 58, 6);
        chi.strokeCircle(68 + 10 + i * 18, 58, 6);
      }
    }

    const bt = this.bloodtally;
    bt.clear();
    if (player.guildId === 'champion' && player.bloodtally !== undefined) {
      for (let i = 0; i < 10; i++) {
        const filled = i < player.bloodtally;
        bt.fillStyle(filled ? 0xdc2626 : 0x374151, 1);
        bt.lineStyle(1, 0x1f2937, 1);
        bt.fillCircle(68 + 7 + i * 14, 58, 5);
        bt.strokeCircle(68 + 7 + i * 14, 58, 5);
      }
    }

    if (player.guildId === 'cultist' && player.sanity !== undefined) {
      const s = player.sanity;
      let color = '#4ade80';
      if (s >= 80) color = '#ef4444';
      else if (s >= 60) color = '#f97316';
      else if (s >= 40) color = '#fbbf24';
      this.sanityText.setColor(color);
      this.sanityText.setText(`Sanity Risk: ${Math.round(s)}%`);
      this.sanityText.setVisible(true);
    } else {
      this.sanityText.setVisible(false);
    }
  }
}

function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}
