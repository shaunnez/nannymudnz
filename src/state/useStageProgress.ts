import type { StageId } from '@nannymud/shared/simulation/types';

const STORAGE_KEY = 'nannymud_stage_progress';

interface StageProgress {
  unlockedStages: StageId[];
}

export function getProgress(): StageProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlockedStages: [] };
    return JSON.parse(raw) as StageProgress;
  } catch {
    return { unlockedStages: [] };
  }
}

export function unlockStage(id: StageId): void {
  const progress = getProgress();
  if (!progress.unlockedStages.includes(id)) {
    progress.unlockedStages.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
}

export function isStageUnlocked(id: StageId): boolean {
  if (id === 'assembly') return true;
  return getProgress().unlockedStages.includes(id);
}
