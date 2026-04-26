import { Server, matchMaker, createRouter, createEndpoint } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type, ngrok-skip-browser-warning',
};

const publicRoomsPreflightEndpoint = createEndpoint('/api/public-rooms', { method: 'OPTIONS' }, async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

const publicRoomsEndpoint = createEndpoint('/api/public-rooms', { method: 'GET' }, async () => {
  try {
    const rooms = await matchMaker.query({});
    const publicRooms = rooms
      .filter((r) => r.metadata?.visibility === 'public')
      .map((r) => ({
        roomId: r.roomId,
        name: r.metadata?.name ?? '',
        hostName: r.metadata?.hostName ?? '',
        rounds: r.metadata?.rounds ?? 3,
        clients: r.clients,
        maxClients: r.maxClients,
      }));
    return new Response(JSON.stringify(publicRooms), {
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'query failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  }
});

const app = createServer();
const gameServer = new Server({ server: app });

gameServer.define('match', MatchRoom).filterBy(['code', 'visibility']);

// Must be set before listen() so bindRouterToTransport picks it up.
gameServer.router = createRouter({ publicRoomsPreflightEndpoint, publicRoomsEndpoint });

const port = Number(process.env.PORT ?? 2567);

// IMPORTANT: must call gameServer.listen(), NOT app.listen().
// gameServer.listen() binds the matchmake HTTP router via
// bindRouterToTransport (Server.cjs:133). Calling app.listen() directly opens
// the TCP port but leaves POST /matchmake/* with no handler — requests hang
// forever with no error.
gameServer
  .listen(port)
  .then(() => {
    console.log(`[server] Colyseus listening on :${port}`);
  })
  .catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
