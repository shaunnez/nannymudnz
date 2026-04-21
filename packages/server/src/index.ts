import { Server } from 'colyseus';
import { createServer } from 'node:http';

const app = createServer();
const gameServer = new Server({ server: app });
const port = Number(process.env.PORT ?? 2567);
app.listen(port, () => {
  console.log(`[server] Colyseus listening on :${port}`);
});
