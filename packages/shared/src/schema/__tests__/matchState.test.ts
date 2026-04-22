import { describe, it, expect } from 'vitest';
import { MatchState, PlayerSlot } from '../index';

describe('MatchState', () => {
  it('initializes with phase lobby and empty slots', () => {
    const s = new MatchState();
    expect(s.phase).toBe('lobby');
    expect(s.players.size).toBe(0);
  });
  it('adds a PlayerSlot', () => {
    const s = new MatchState();
    const slot = new PlayerSlot();
    slot.sessionId = 'abc';
    slot.name = 'Alice';
    s.players.set('abc', slot);
    expect(s.players.get('abc')?.name).toBe('Alice');
  });
});
