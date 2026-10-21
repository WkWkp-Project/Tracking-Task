// Optional Postgres persistence for the JSON document store.
//
// Hosts with an ephemeral filesystem (e.g. Render's free tier) lose db.json on
// every deploy or restart. When DATABASE_URL is set, db.js keeps the exact same
// in-memory document model but loads/saves the whole snapshot as one JSONB row
// here instead of a local file. Single-instance only (last write wins).

import pg from 'pg';

const KEY = 'main';

// `pool` only needs a `query(text, params)` method, so tests can pass a fake.
export function createPgStore(pool) {
  return {
    async init() {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS app_state (
           id text PRIMARY KEY,
           data jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`
      );
    },
    // Returns the raw JSON text, or null when nothing has been saved yet.
    async load() {
      const res = await pool.query('SELECT data::text AS raw FROM app_state WHERE id = $1', [KEY]);
      return res.rows[0]?.raw ?? null;
    },
    async save(raw) {
      await pool.query(
        `INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [KEY, raw]
      );
    },
  };
}

export async function connectPgStore(connectionString, env = process.env) {
  // Managed Postgres (Neon, Supabase, …) requires TLS; set DATABASE_SSL=false
  // only for a local database without it.
  const ssl = env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false };
  const pool = new pg.Pool({ connectionString, ssl, max: 3, connectionTimeoutMillis: 15000 });
  const store = createPgStore(pool);
  await store.init();
  return store;
}
