import { Client, Room } from 'colyseus.js';
import type { MatchState } from '@nannymud/shared';

const WS_URL = (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.VITE_COLYSEUS_URL ?? 'ws://localhost:2567';

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

export async function joinByCode(code: string, playerName: string): Promise<Room<MatchState>> {
  return await getClient().joinById<MatchState>(code, { name: playerName });
}

// Test hook: allow tests to inject a mock client
export function __setClientForTests(c: Client | null): void {
  client = c;
}
