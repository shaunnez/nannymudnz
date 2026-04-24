import { Client, Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';

const WS_URL = import.meta.env.VITE_COLYSEUS_URL ?? 'ws://localhost:2567';

let client: Client | null = null;

export function getClient(): Client {
  if (!client) client = new Client(WS_URL);
  return client;
}

export interface HostRoomOpts {
  name: string;
  rounds: 1 | 3 | 5 | 7;
  visibility: 'public' | 'private';
  playerName: string;
}

export async function hostRoom(opts: HostRoomOpts): Promise<Room<MatchState>> {
  return await getClient().create<MatchState>('match', {
    name: opts.name,
    rounds: opts.rounds,
    visibility: opts.visibility,
    playerName: opts.playerName,
  });
}

export async function joinRoom(id: string, playerName: string): Promise<Room<MatchState>> {
  return await getClient().joinById<MatchState>(id, { name: playerName });
}

export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  rounds: number;
  clients: number;
  maxClients: number;
}

export async function getPublicRooms(): Promise<PublicRoom[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Room query timed out')), 6000);
    getClient().joinOrCreate<void>('query').then((room) => {
      room.onMessage<PublicRoom[]>('rooms', (rooms) => {
        clearTimeout(timer);
        resolve(rooms);
        room.leave().catch(() => {});
      });
    }).catch((err) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error('Failed to query rooms'));
    });
  });
}

// Test hook: allow tests to inject a mock client
export function __setClientForTests(c: Client | null): void {
  client = c;
}
