import { describe, it, expect } from 'vitest';
import { createInitialState } from '../simulation';
import { appendLog } from '../combatLog';

describe('combatLog', () => {
  it('appends entries with incrementing ids and current tick', () => {
    const s = createInitialState('knight', 1);
    s.tick = 7;
    appendLog(s, { tag: 'P1', tone: 'info', text: 'hello' });
    expect(s.combatLog).toHaveLength(1);
    expect(s.combatLog[0]).toMatchObject({
      id: 1,
      tickId: 7,
      tag: 'P1',
      tone: 'info',
      text: 'hello',
    });
    expect(s.nextLogId).toBe(2);
  });

  it('caps the log at 64 entries, dropping oldest', () => {
    const s = createInitialState('knight', 1);
    for (let i = 0; i < 100; i++) {
      appendLog(s, { tag: 'SYS', tone: 'info', text: `entry ${i}` });
    }
    expect(s.combatLog).toHaveLength(64);
    expect(s.combatLog[0].text).toBe('entry 36');
    expect(s.combatLog[63].text).toBe('entry 99');
  });
});
