import { useState } from 'react';

const STORAGE_KEY = 'nannymud_dev_settings';

interface DevSettings {
  enemyHpScale: number;
}

function loadSettings(): DevSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enemyHpScale: 1 };
    return { enemyHpScale: 1, ...JSON.parse(raw) as Partial<DevSettings> };
  } catch {
    return { enemyHpScale: 1 };
  }
}

function saveSettings(s: DevSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function readEnemyHpScale(): number {
  return loadSettings().enemyHpScale;
}

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(loadSettings);

  const setEnemyHpScale = (v: number) => {
    const next = { ...settings, enemyHpScale: v };
    saveSettings(next);
    setSettings(next);
  };

  return { enemyHpScale: settings.enemyHpScale, setEnemyHpScale };
}
