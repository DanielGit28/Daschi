/**
 * @jest-environment node
 */
// Dos dispositivos (SQLite real con sql.js) sincronizando contra el código real del servidor y el
// driver real (node-postgres) sobre Postgres real (PGlite en otro proceso), con la migración de Neon.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { BadRequest, listDogs, parseSyncRequest, syncDog } from '../../server/sync';
import { newAppDatabase } from '../../test-utils/sqljs';
import { addPottyLog, createDog, deleteDog, deletePottyLog, getDogs, getDoneItems, getPottyLogsSince, getReminders, setItemDone, updateDog } from '../db';
import { adoptDog, syncAll, type Transport } from '../sync';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.setTimeout(30_000);

const ROOT = path.join(__dirname, '../../..');
const PORT = 54329;
const MIGRATION = readFileSync(path.join(ROOT, 'server/migrations/001_sync_tables.sql'), 'utf8');

let server: ChildProcess;
let pool: Pool;
let transport: Transport;

beforeAll(async () => {
  // PGlite corre fuera de Jest (como ESM normal) y escucha el protocolo de Postgres.
  server = spawn(process.execPath, [path.join(ROOT, 'scripts/pglite-server.mjs'), String(PORT)], { cwd: ROOT });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on('data', (d) => String(d).includes('ready') && resolve());
    server.stderr!.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => reject(new Error(`pglite-server terminó (${code})`)));
  });
  // PGlite atiende una conexión a la vez.
  pool = new Pool({ host: '127.0.0.1', port: PORT, user: 'postgres', database: 'postgres', max: 1 });
});

afterAll(async () => {
  await pool?.end();
  server?.kill();
});

beforeEach(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(MIGRATION);
  // Igual que por HTTP: el pedido viaja como JSON y el servidor lo valida.
  transport = async (req) => JSON.parse(JSON.stringify(await syncDog(pool, parseSyncRequest(JSON.parse(JSON.stringify(req))))));
});

const tick = () => new Promise((r) => setTimeout(r, 5));
const OLI = { name: 'Olivia', breed: 'Dachshund (salchicha)', birth_date: '2026-08-24', weight_kg: 1.8 };
const since = new Date('2026-01-01');

async function twoDevices() {
  const phone = await newAppDatabase();
  const web = await newAppDatabase();
  const oli = await createDog(phone, OLI);
  await addPottyLog(phone, oli, 'pipi', 'fuera', new Date('2026-10-25T15:00:00Z'));
  await syncAll(phone, transport);
  await adoptDog(web, oli, transport);
  return { phone, web, oli };
}

describe('sincronización', () => {
  it('otro dispositivo trae la mascota con todo su historial', async () => {
    const { web, oli } = await twoDevices();
    const [dog] = await getDogs(web);
    expect(dog).toMatchObject({ id: oli, name: 'Olivia', weight_kg: 1.8, dirty: 0 });
    expect(await getPottyLogsSince(web, oli, since)).toHaveLength(1);
    expect(await getReminders(web, oli)).toHaveLength(6);
  });

  it('los registros viajan en los dos sentidos', async () => {
    const { phone, web, oli } = await twoDevices();
    await addPottyLog(web, oli, 'popo', 'fuera');
    await setItemDone(web, oli, 'prep-guacal', true);
    await syncAll(web, transport);

    expect(await syncAll(phone, transport)).toBe(2);
    expect(await getPottyLogsSince(phone, oli, since)).toHaveLength(2);
    expect(await getDoneItems(phone, oli)).toEqual(new Set(['prep-guacal']));
  });

  it('sin cambios no baja nada', async () => {
    const { phone } = await twoDevices();
    expect(await syncAll(phone, transport)).toBe(0);
    expect(await syncAll(phone, transport)).toBe(0);
  });

  it('borrar un registro se refleja en el otro dispositivo', async () => {
    const { phone, web, oli } = await twoDevices();
    const [log] = await getPottyLogsSince(web, oli, since);
    await deletePottyLog(web, log.id);
    await syncAll(web, transport);
    await syncAll(phone, transport);
    expect(await getPottyLogsSince(phone, oli, since)).toHaveLength(0);
  });

  it('si dos dispositivos editan lo mismo, gana el cambio más reciente aunque suba primero', async () => {
    const { phone, web, oli } = await twoDevices();
    await updateDog(web, oli, { ...OLI, name: 'Oli (web)' });
    await tick();
    await updateDog(phone, oli, { ...OLI, name: 'Oli (teléfono)' });

    await syncAll(phone, transport); // el más nuevo sube primero
    await syncAll(web, transport); // el más viejo no lo pisa en el servidor y baja el nuevo
    await syncAll(phone, transport);

    expect((await getDogs(phone))[0].name).toBe('Oli (teléfono)');
    expect((await getDogs(web))[0].name).toBe('Oli (teléfono)');
  });

  it('un cambio local hecho mientras se sincronizaba no se pierde', async () => {
    const { phone, oli } = await twoDevices();
    await updateDog(phone, oli, { ...OLI, name: 'Antes' });
    const slow: Transport = async (req) => {
      await tick();
      await updateDog(phone, oli, { ...OLI, name: 'Durante' }); // edición mientras el pedido viaja
      return transport(req);
    };
    await syncAll(phone, slow);
    const [dog] = await getDogs(phone);
    expect(dog).toMatchObject({ name: 'Durante', dirty: 1 });
    await syncAll(phone, transport);
    expect((await listDogs(pool))[0].name).toBe('Durante');
  });

  it('los perfiles públicos no muestran mascotas eliminadas', async () => {
    const { phone, oli } = await twoDevices();
    expect((await listDogs(pool)).map((d) => d.name)).toEqual(['Olivia']);
    await deleteDog(phone, oli);
    await syncAll(phone, transport);
    expect(await listDogs(pool)).toEqual([]);
  });

  it('el servidor rechaza filas de otra mascota y tablas desconocidas', () => {
    const row = { id: 'x', dog_id: 'otra', kind: 'pipi', place: 'fuera', logged_at: 'x', updated_at: '2026-10-20T00:00:00.000Z', deleted: 0 };
    expect(() => parseSyncRequest({ dogId: 'oli', cursor: 0, changes: { potty_logs: [row] } })).toThrow(BadRequest);
    expect(() => parseSyncRequest({ dogId: 'oli', cursor: 0, changes: { users: [] } })).toThrow(BadRequest);
    expect(() => parseSyncRequest({ dogId: 'oli', cursor: -1, changes: {} })).toThrow(BadRequest);
  });
});
