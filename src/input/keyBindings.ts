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
  fullscreen: string;
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
  pause: 'p',
  fullscreen: 'f',
};

const STORAGE_KEY = 'nannymud_keybindings';

export function loadKeyBindings(): KeyBindings {
  let bindings: KeyBindings = { ...DEFAULT_BINDINGS };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      bindings = { ...DEFAULT_BINDINGS, ...JSON.parse(saved) };
    }
  } catch {
    /* ignore */
  }

  // Migrate legacy bindings: Esc used to be pause, but browser fullscreen
  // hijacks Esc. One-shot rewrite so old players don't find pause unusable.
  let migrated = false;
  if (bindings.pause === 'Escape' || bindings.pause === 'Esc') {
    bindings.pause = 'p';
    migrated = true;
  }
  // Fill in any keys that didn't exist in older saved copies.
  if (!bindings.fullscreen) {
    bindings.fullscreen = 'f';
    migrated = true;
  }
  if (migrated) {
    saveKeyBindings(bindings);
  }

  return bindings;
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore */
  }
}
