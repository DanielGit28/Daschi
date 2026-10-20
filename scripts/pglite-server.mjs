// Solo para tests: Postgres en memoria (PGlite) escuchando el protocolo de Postgres en 127.0.0.1:<puerto>.
// Corre fuera de Jest para que PGlite cargue como ESM normal. Uso: node scripts/pglite-server.mjs 54329
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.argv[2] ?? 54329);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.log('ready');

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
