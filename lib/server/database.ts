import 'server-only';
import crypto from 'node:crypto';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';

types.setTypeParser(20, Number);

declare global {
  // eslint-disable-next-line no-var
  var __ecpPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __ecpDatabaseReady: Promise<void> | undefined;
}

function connectionConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const runtimeUrl = new URL(databaseUrl);
  runtimeUrl.searchParams.delete('sslmode');
  return {
    connectionString: runtimeUrl.toString(),
    max: Number(process.env.DB_POOL_SIZE) || (process.env.VERCEL ? 1 : 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  };
}

export function getPool() {
  if (!globalThis.__ecpPool) globalThis.__ecpPool = new Pool(connectionConfig());
  return globalThis.__ecpPool;
}

export const now = () => new Date().toISOString();

export function passwordHash(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64), expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function ensureDatabase() {
  if (!globalThis.__ecpDatabaseReady) {
    globalThis.__ecpDatabaseReady = (async () => {
      const pool = getPool();
      await pool.query('SELECT 1 FROM admins LIMIT 1');
      const existing = await one<{ id: number }>('SELECT id FROM admins LIMIT 1');
      if (!existing) {
        const password = process.env.ADMIN_PASSWORD;
        if (!password) throw new Error('ADMIN_PASSWORD is required when the admins table is empty.');
        const timestamp = now();
        await pool.query('INSERT INTO admins(username,email,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$4) ON CONFLICT (username) DO NOTHING', [process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_EMAIL || 'admin@example.com', passwordHash(password), timestamp]);
      }
    })().catch(error => { globalThis.__ecpDatabaseReady = undefined; throw error; });
  }
  return globalThis.__ecpDatabaseReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  await ensureDatabase();
  return getPool().query<T>(sql, params);
}

export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return (await getPool().query<T>(sql, params)).rows[0];
}

export async function all<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return (await query<T>(sql, params)).rows;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  await ensureDatabase();
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function count(sql: string, params: unknown[] = []) {
  return Number((await one<{ n: number }>(sql, params))?.n || 0);
}

export async function log(participantId: number, type: string, key: string, details: object | null = null, at = now(), executor: Pool | PoolClient = getPool()) {
  await executor.query('INSERT INTO activity_logs(participant_id,event_type,event_key,details_json,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT (participant_id,event_key) DO NOTHING', [participantId, type, key, details, at]);
  await executor.query('UPDATE participants SET last_activity_at=$1 WHERE id=$2', [at, participantId]);
}

export async function participantProgress(id: number, executor: Pool | PoolClient = getPool()) {
  return (await executor.query(`SELECT p.*,a.*,g.stage_1_at,g.stage_2_at,g.stage_3_at,g.stage_4_at,g.stage_5_at,g.completed_at game_done,(SELECT score FROM quiz_attempts q WHERE q.participant_id=p.id ORDER BY q.id DESC LIMIT 1) quiz_score,(SELECT total FROM quiz_attempts q WHERE q.participant_id=p.id ORDER BY q.id DESC LIMIT 1) quiz_total FROM participants p LEFT JOIN awareness_progress a ON a.participant_id=p.id LEFT JOIN game_progress g ON g.participant_id=p.id WHERE p.id=$1`, [id])).rows[0];
}

export async function completeIfReady(id: number) {
  const progress = await participantProgress(id);
  if (progress?.general_knowledge_completed_at && progress.game_completed_at && progress.quiz_completed_at && !progress.awareness_completed_at) {
    const timestamp = now();
    await transaction(async client => {
      await client.query("UPDATE participants SET awareness_completed_at=$1,status='COMPLETED',last_activity_at=$1 WHERE id=$2", [timestamp, id]);
      await log(id, 'AWARENESS_COMPLETED', 'AWARENESS_COMPLETED', null, timestamp, client);
    });
  }
}
