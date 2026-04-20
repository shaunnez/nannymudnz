export interface KeyBindings {
  left: string;
  right: string;
  up: string;
  down: string;
  jump: string;
  attack: string;
  block: string;
  grab: string;
  pause: string;
}

export const DEFAULT_BINDINGS: KeyBindings = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: ' ',
  attack: 'j',
  block: 'k',
  grab: 'l',
  pause: 'Escape',
};

const STORAGE_KEY = 'nannymud_keybindings';

export function loadKeyBindings(): KeyBindings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_BINDINGS, ...JSON.parse(saved) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_BINDINGS };
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore */
  }
}
