import { Server, matchMaker } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

const app = createServer();
const gameServer = new Server({
  server: app,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  express: async (expressApp: any) => {
    expressApp.get('/api/public-rooms', async (_req: any, res: any) => {
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
        res.set('Access-Control-Allow-Origin', '*');
        res.json(publicRooms);
      } catch {
        res.status(500).json({ error: 'query failed' });
      }
    });
  },
});

gameServer.define('match', MatchRoom).filterBy(['code', 'visibility']);

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
