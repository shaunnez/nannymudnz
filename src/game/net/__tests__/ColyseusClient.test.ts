import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClient, hostRoom, joinByCode, __setClientForTests } from '../ColyseusClient';

describe('ColyseusClient', () => {
  const mockRoom = {};
  const mockCreate = vi.fn().mockResolvedValue(mockRoom);
  const mockJoinById = vi.fn().mockResolvedValue(mockRoom);
  const mockClient = { create: mockCreate, joinById: mockJoinById } as unknown as import('colyseus.js').Client;

  beforeEach(() => {
    vi.clearAllMocks();
    __setClientForTests(null);
  });

  it('getClient() returns the same instance on repeated calls (singleton)', () => {
    __setClientForTests(mockClient);
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
    expect(a).toBe(mockClient);
  });

  it('hostRoom calls client.create with expected opts including playerName', async () => {
    __setClientForTests(mockClient);
    const opts = { name: 'TestRoom', rounds: 3 as const, visibility: 'public' as const, playerName: 'Alice' };
    await hostRoom(opts);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith('match', {
      name: 'TestRoom',
      rounds: 3,
      visibility: 'public',
      playerName: 'Alice',
    });
  });

  it('joinByCode calls client.joinById with code and name', async () => {
    __setClientForTests(mockClient);
    await joinByCode('ABCDEF', 'Alice');
    expect(mockJoinById).toHaveBeenCalledOnce();
    expect(mockJoinById).toHaveBeenCalledWith('ABCDEF', { name: 'Alice' });
  });
});
