import { Server } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

const app = createServer();
const gameServer = new Server({ server: app });

gameServer.define('match', MatchRoom).filterBy(['code']);

const port = Number(process.env.PORT ?? 2567);
app.listen(port, () => {
  console.log(`[server] Colyseus listening on :${port}`);
});
