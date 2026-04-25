import { useState } from 'react';

const STORAGE_KEY = 'nannymud_dev_settings';

interface DevSettings {
  enemyHpScale: number;
  useNewVfx: boolean;
}

function loadSettings(): DevSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enemyHpScale: 1, useNewVfx: false };
    return { enemyHpScale: 1, useNewVfx: false, ...JSON.parse(raw) as Partial<DevSettings> };
  } catch {
    return { enemyHpScale: 1, useNewVfx: false };
  }
}

function saveSettings(s: DevSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function readEnemyHpScale(): number {
  return loadSettings().enemyHpScale;
}

export function readUseNewVfx(): boolean {
  return loadSettings().useNewVfx;
}

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(loadSettings);

  const setEnemyHpScale = (v: number) => {
    const next = { ...settings, enemyHpScale: v };
    saveSettings(next);
    setSettings(next);
  };

  const setUseNewVfx = (v: boolean) => {
    const next = { ...settings, useNewVfx: v };
    saveSettings(next);
    setSettings(next);
  };

  return {
    enemyHpScale: settings.enemyHpScale,
    setEnemyHpScale,
    useNewVfx: settings.useNewVfx,
    setUseNewVfx,
  };
}
