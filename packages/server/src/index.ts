import { Server, matchMaker, createRouter, createEndpoint } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

// Colyseus handles OPTIONS preflights at the HTTP server level using this header list.
// ngrok-skip-browser-warning must be included or the Vercel frontend's preflight is rejected.
matchMaker.controller.DEFAULT_CORS_HEADERS = {
  ...matchMaker.controller.DEFAULT_CORS_HEADERS,
  'Access-Control-Allow-Headers':
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning',
};

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
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'query failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

const app = createServer();
const gameServer = new Server({ server: app });

gameServer.define('match', MatchRoom).filterBy(['code', 'visibility']);

// Must be set before listen() so bindRouterToTransport picks it up.
gameServer.router = createRouter({ publicRoomsEndpoint });

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
