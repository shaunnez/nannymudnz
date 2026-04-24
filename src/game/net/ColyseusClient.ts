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
  const response = await getClient().http.get('/api/public-rooms');
  if (response.status >= 400) throw new Error('Failed to fetch rooms');
  return response.data as PublicRoom[];
}

// Test hook: allow tests to inject a mock client
export function __setClientForTests(c: Client | null): void {
  client = c;
}
