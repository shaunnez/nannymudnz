import type { SimState, LogEntry, LogTag, LogTone } from './types';

const LOG_CAP = 64;

export interface LogEntryInput {
  tag: LogTag;
  tone: LogTone;
  text: string;
}

export function appendLog(state: SimState, input: LogEntryInput): void {
  const entry: LogEntry = {
    id: state.nextLogId++,
    tickId: state.tick,
    tag: input.tag,
    tone: input.tone,
    text: input.text,
  };
  state.combatLog.push(entry);
  if (state.combatLog.length > LOG_CAP) {
    state.combatLog.splice(0, state.combatLog.length - LOG_CAP);
  }
}
