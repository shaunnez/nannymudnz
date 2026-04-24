import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClient, hostRoom, joinRoom, getPublicRooms, __setClientForTests } from '../ColyseusClient';

describe('ColyseusClient', () => {
  const mockRoom = {};
  const mockCreate = vi.fn().mockResolvedValue(mockRoom);
  const mockJoinById = vi.fn().mockResolvedValue(mockRoom);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient = { create: mockCreate, joinById: mockJoinById } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    __setClientForTests(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('joinRoom calls client.joinById with id and name', async () => {
    __setClientForTests(mockClient);
    await joinRoom('ABCDEF', 'Alice');
    expect(mockJoinById).toHaveBeenCalledOnce();
    expect(mockJoinById).toHaveBeenCalledWith('ABCDEF', { name: 'Alice' });
  });

  describe('getPublicRooms', () => {
    it('returns mapped public rooms from the server endpoint', async () => {
      const serverPayload = [
        {
          roomId: 'AAA111',
          name: 'Pub Room',
          hostName: 'Alice',
          rounds: 3,
          clients: 1,
          maxClients: 2,
        },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverPayload),
      }));
      const rooms = await getPublicRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0]).toEqual({
        roomId: 'AAA111',
        name: 'Pub Room',
        hostName: 'Alice',
        rounds: 3,
        clients: 1,
        maxClients: 2,
      });
    });

    it('throws when fetch response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      await expect(getPublicRooms()).rejects.toThrow('Failed to fetch rooms');
    });
  });
});
