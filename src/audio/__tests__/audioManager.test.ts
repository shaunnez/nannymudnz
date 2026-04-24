import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager } from '../audioManager';

// --- mock scaffolding ---
const mockGainParam = () => ({
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  value: 0,
});
const mockOscillator = () => ({
  type: 'sine' as OscillatorType,
  frequency: { value: 220, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  detune: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
});
const mockGainNode = () => ({ gain: mockGainParam(), connect: vi.fn() });
const mockFilter = () => ({ type: 'lowpass' as BiquadFilterType, frequency: { value: 350 }, connect: vi.fn() });
const mockWaveShaper = () => ({
  curve: null as Float32Array | null,
  oversample: '2x' as OverSampleType,
  connect: vi.fn(),
});
const mockBufferSource = () => ({
  buffer: null as AudioBuffer | null,
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
});
function makeCtxMock() {
  return {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createOscillator: vi.fn(() => mockOscillator()),
    createGain: vi.fn(() => mockGainNode()),
    createBiquadFilter: vi.fn(() => mockFilter()),
    createWaveShaper: vi.fn(() => mockWaveShaper()),
    createBuffer: vi.fn((_ch: number, size: number) => ({ getChannelData: vi.fn(() => new Float32Array(size)) })),
    createBufferSource: vi.fn(() => mockBufferSource()),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
}
// --- end scaffolding ---

describe('new ability-category sounds', () => {
  let ctx: ReturnType<typeof makeCtxMock>;

  beforeEach(() => {
    ctx = makeCtxMock();
    vi.stubGlobal('AudioContext', vi.fn(function() { return ctx; }));
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('playAoeBoom creates oscillator and noise buffer', () => {
    const audio = new AudioManager();
    audio.playAoeBoom();
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playBlink creates oscillator and noise buffer', () => {
    const audio = new AudioManager();
    audio.playBlink();
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playChannelPulse creates exactly 2 oscillators', () => {
    const audio = new AudioManager();
    audio.playChannelPulse();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('playAuraPulse creates exactly 4 oscillators', () => {
    const audio = new AudioManager();
    audio.playAuraPulse();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
  });

  it('playZonePulse creates oscillator and noise buffer', () => {
    const audio = new AudioManager();
    audio.playZonePulse();
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playSummonSpawn schedules 4 sine notes via setTimeout', () => {
    vi.useFakeTimers();
    const audio = new AudioManager();
    audio.playSummonSpawn();
    vi.runAllTimers();
    // 4 notes use playTone → createOscillator each
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

describe('enhanced existing sounds', () => {
  let ctx: ReturnType<typeof makeCtxMock>;

  beforeEach(() => {
    ctx = makeCtxMock();
    vi.stubGlobal('AudioContext', vi.fn(function() { return ctx; }));
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('playAttack creates noise buffer for punch layer', () => {
    const audio = new AudioManager();
    audio.playAttack();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playCrit creates WaveShaper for distortion', () => {
    const audio = new AudioManager();
    audio.playCrit();
    expect(ctx.createWaveShaper).toHaveBeenCalled();
  });

  it('playCrit creates noise buffer for sparkle layer', () => {
    const audio = new AudioManager();
    audio.playCrit();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playKnockdown creates noise buffer for thud layer', () => {
    const audio = new AudioManager();
    audio.playKnockdown();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playLand creates noise buffer for thud layer', () => {
    const audio = new AudioManager();
    audio.playLand();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });

  it('playCast creates noise buffer for sparkle layer', () => {
    const audio = new AudioManager();
    audio.playCast();
    expect(ctx.createBuffer).toHaveBeenCalled();
  });
});
