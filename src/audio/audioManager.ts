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

  private makeDistortionCurve(amount: number): Float32Array {
    const n = 256;
    const curve = new Float32Array(n);
    const k = amount;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private playNoise(
    cutoffHz: number,
    durationSec: number,
    gain: number,
    filterType: BiquadFilterType = 'lowpass'
  ): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const bufferSize = Math.floor(ctx.sampleRate * durationSec);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer as AudioBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = cutoffHz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
      source.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + durationSec);
    } catch { /* audio context unavailable — fail silent */ }
  }

  playAttack(): void {
    this.playTone(220, 0.08, 'sawtooth', 0.4);
    this.playTone(180, 0.08, 'square', 0.2, -50);
    this.playNoise(300, 0.03, 0.3);
  }

  playCrit(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const ws = ctx.createWaveShaper();
      ws.curve = this.makeDistortionCurve(150);
      ws.oversample = '2x';
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 880;
      g1.gain.setValueAtTime(0.5, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc1.connect(ws);
      ws.connect(g1);
      g1.connect(this.sfxGain);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.08);
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.value = 660;
      g2.gain.setValueAtTime(0.3, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc2.connect(g2);
      g2.connect(this.sfxGain);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.1);
    } catch { /* audio context unavailable — fail silent */ }
    this.playNoise(3000, 0.04, 0.4, 'highpass');
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
    this.playNoise(150, 0.06, 0.4);
  }

  playKnockdown(): void {
    this.playTone(80, 0.25, 'square', 0.5, -300);
    this.playNoise(100, 0.2, 0.5);
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 40;
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* audio context unavailable — fail silent */ }
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
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* audio context unavailable — fail silent */ }
    this.playTone(660, 0.1, 'sine', 0.25);
    this.playTone(880, 0.15, 'sine', 0.18);
    this.playNoise(4000, 0.05, 0.3, 'highpass');
  }

  playImpact(): void {
    this.playTone(120, 0.12, 'sawtooth', 0.45);
  }

  playInsufficientResource(): void {
    this.playTone(200, 0.1, 'square', 0.2);
    this.playTone(150, 0.12, 'square', 0.15);
  }

  playAoeBoom(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.6, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* audio context unavailable — fail silent */ }
    this.playNoise(200, 0.1, 0.5);
  }

  playBlink(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* audio context unavailable — fail silent */ }
    this.playNoise(1000, 0.1, 0.2, 'bandpass');
  }

  playChannelPulse(): void {
    const pairs: Array<{ freq: number; gain: number; delay: number }> = [
      { freq: 220, gain: 0.3, delay: 0 },
      { freq: 330, gain: 0.2, delay: 0.03 },
    ];
    for (const { freq, gain, delay } of pairs) {
      try {
        const ctx = this.ensureContext();
        if (!this.sfxGain) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + 0.3);
      } catch { /* audio context unavailable — fail silent */ }
    }
  }

  playAuraPulse(): void {
    const freqs = [110, 217, 331, 443];
    const gains = [0.15, 0.12, 0.10, 0.08];
    for (let i = 0; i < freqs.length; i++) {
      try {
        const ctx = this.ensureContext();
        if (!this.sfxGain) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freqs[i];
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(gains[i], ctx.currentTime + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch { /* audio context unavailable — fail silent */ }
    }
  }

  playZonePulse(): void {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* audio context unavailable — fail silent */ }
    this.playNoise(80, 0.15, 0.4);
  }

  playSummonSpawn(): void {
    const notes = [165, 196, 247, 330]; // E3, G3, B3, E4
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.25), i * 70);
    });
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
