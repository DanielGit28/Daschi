// Conexión a Neon desde las API routes. En Vercel (Fluid compute) se usa node-postgres con un pool
// reutilizado entre pedidos y `attachDatabasePool` para cerrar conexiones ociosas antes de suspender.
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL (pooled) en el entorno del servidor.');
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
  attachDatabasePool(pool);
  return pool;
}
