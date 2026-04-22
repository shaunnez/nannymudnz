import { Server } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

const app = createServer();
const gameServer = new Server({ server: app });

gameServer.define('match', MatchRoom).filterBy(['code']);

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
