import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getProgress, unlockStage, isStageUnlocked } from '../useStageProgress';

describe('useStageProgress', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: vi.fn(() => {
        for (const key in store) delete store[key];
      }),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('assembly is always unlocked', () => {
    expect(isStageUnlocked('assembly')).toBe(true);
  });

  it('other stages start locked', () => {
    expect(isStageUnlocked('market')).toBe(false);
    expect(isStageUnlocked('rooftops')).toBe(false);
  });

  it('unlockStage persists and isStageUnlocked reflects it', () => {
    unlockStage('market');
    expect(isStageUnlocked('market')).toBe(true);
  });

  it('unlockStage does not duplicate entries', () => {
    unlockStage('market');
    unlockStage('market');
    const progress = getProgress();
    expect(progress.unlockedStages.filter(s => s === 'market').length).toBe(1);
  });

  it('getProgress returns empty array on fresh state', () => {
    expect(getProgress().unlockedStages).toEqual([]);
  });
});
