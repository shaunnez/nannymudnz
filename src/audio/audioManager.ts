const STORAGE_KEY = 'nannymud_volume';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicInterval: number | null = null;
  private volume: number = 0.5;
  private isBossMusic = false;

  constructor() {
    this.volume = this.loadVolume();
  }

  private loadVolume(): number {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v !== null ? parseFloat(v) : 0.5;
    } catch {
      return 0.5;
    }
  }

  saveVolume(v: number): void {
    this.volume = v;
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* storage disabled */ }
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  getVolume(): number { return this.volume; }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.3, detune = 0): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* audio context unavailable — fail silent */ }
  }

  playAttack(): void {
    this.playTone(220, 0.08, 'sawtooth', 0.4);
    this.playTone(180, 0.08, 'square', 0.2, -50);
  }

  playCrit(): void {
    this.playTone(440, 0.06, 'square', 0.5);
    this.playTone(660, 0.1, 'square', 0.3);
  }

  playHeal(): void {
    this.playTone(523, 0.12, 'sine', 0.3);
    this.playTone(659, 0.15, 'sine', 0.25);
    this.playTone(784, 0.2, 'sine', 0.2);
  }

  playBlock(): void {
    this.playTone(150, 0.15, 'square', 0.35, -200);
  }

  playParry(): void {
    this.playTone(880, 0.05, 'square', 0.5);
    this.playTone(1100, 0.08, 'square', 0.4);
  }

  playJump(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* audio context unavailable — fail silent */ }
  }

  playLand(): void {
    this.playTone(100, 0.1, 'square', 0.4);
  }

  playKnockdown(): void {
    this.playTone(80, 0.25, 'square', 0.5, -300);
  }

  playDeath(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* audio context unavailable — fail silent */ }
  }

  playCast(): void {
    this.playTone(660, 0.1, 'sine', 0.3);
    this.playTone(880, 0.15, 'sine', 0.2);
  }

  playImpact(): void {
    this.playTone(120, 0.12, 'sawtooth', 0.45);
  }

  playInsufficientResource(): void {
    this.playTone(200, 0.1, 'square', 0.2);
    this.playTone(150, 0.12, 'square', 0.15);
  }

  playVictory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.25, 'square', 0.4), i * 120);
    });
  }

  playDefeat(): void {
    const notes = [523, 494, 440, 392, 349];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.3, 'square', 0.3), i * 200);
    });
  }

  startStageMusic(): void {
    if (this.isBossMusic) return;
    this.stopMusic();
    this.scheduleMusic(false);
  }

  startBossMusic(): void {
    if (this.isBossMusic) return;
    this.isBossMusic = true;
    this.stopMusic();
    this.scheduleMusic(true);
  }

  private scheduleMusic(isBoss: boolean): void {
    const stageNotes = [110, 130, 146, 165, 175, 196, 220, 196, 175, 165, 146, 130];
    const bossNotes = [130, 123, 110, 116, 130, 116, 110, 98, 110, 98, 87, 98];
    const notes = isBoss ? bossNotes : stageNotes;
    let idx = 0;

    const play = () => {
      try {
        const ctx = this.ensureContext();
        if (!this.musicGain) return;
        const note = notes[idx % notes.length];
        idx++;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = isBoss ? 'sawtooth' : 'square';
        osc.frequency.value = note;
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } catch { /* audio context unavailable — fail silent */ }
    };

    play();
    this.musicInterval = window.setInterval(play, 350);
  }

  stopMusic(): void {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isBossMusic = false;
    for (const osc of this.musicOscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.musicOscillators = [];
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
