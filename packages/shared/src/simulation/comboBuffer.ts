import type { ComboBuffer, InputState } from './types';
import { COMBO_WINDOW_MS } from './constants';

export function createComboBuffer(): ComboBuffer {
  return { entries: [], lastKeyMs: 0 };
}

export function pushComboKey(buffer: ComboBuffer, key: string, timeMs: number): void {
  buffer.entries.push({ key, timeMs });
  buffer.lastKeyMs = timeMs;
  pruneBuffer(buffer, timeMs);
}

function pruneBuffer(buffer: ComboBuffer, nowMs: number): void {
  buffer.entries = buffer.entries.filter(e => nowMs - e.timeMs <= COMBO_WINDOW_MS * 6);
  if (buffer.entries.length > 10) {
    buffer.entries = buffer.entries.slice(-10);
  }
}

export function checkCombo(buffer: ComboBuffer, sequence: string[], nowMs: number): boolean {
  pruneBuffer(buffer, nowMs);

  if (buffer.entries.length < sequence.length) return false;

  const recent = buffer.entries.slice(-sequence.length);
  if (recent.length !== sequence.length) return false;

  for (let i = 0; i < sequence.length; i++) {
    if (recent[i].key !== sequence[i]) return false;
  }

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].timeMs - recent[i - 1].timeMs > COMBO_WINDOW_MS) return false;
  }

  return true;
}

export function clearCombo(buffer: ComboBuffer): void {
  buffer.entries = [];
}

export function detectComboFromInput(
  buffer: ComboBuffer,
  _input: InputState,
  nowMs: number,
): string | null {
  const sequences: [string[], string][] = [
    [['down', 'up', 'down', 'up', 'attack'], 'down,up,down,up,attack'],
    [['down', 'down', 'attack'], 'down,down,attack'],
    [['right', 'right', 'attack'], 'right,right,attack'],
    [['down', 'up', 'attack'], 'down,up,attack'],
    [['left', 'right', 'attack'], 'left,right,attack'],
  ];

  for (const [seq, comboId] of sequences) {
    if (checkCombo(buffer, seq, nowMs)) {
      return comboId;
    }
  }
  return null;
}

export function getComboHints(buffer: ComboBuffer, nowMs: number): string[] {
  pruneBuffer(buffer, nowMs);
  if (buffer.entries.length === 0) return [];

  const sequences: [string[], string][] = [
    [['down', 'up', 'down', 'up', 'attack'], 'down,up,down,up,attack'],
    [['down', 'down', 'attack'], 'down,down,attack'],
    [['right', 'right', 'attack'], 'right,right,attack'],
    [['down', 'up', 'attack'], 'down,up,attack'],
    [['left', 'right', 'attack'], 'left,right,attack'],
  ];

  const hints: string[] = [];
  for (const [seq, comboId] of sequences) {
    const last = buffer.entries.slice(-(seq.length - 1));
    if (last.length > 0) {
      const prefix = seq.slice(0, last.length);
      const matches = last.every((e, i) => e.key === prefix[i]);
      if (matches && last.length < seq.length) {
        hints.push(comboId);
      }
    }
  }
  return hints;
}
