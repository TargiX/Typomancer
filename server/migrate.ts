import { getMigrations } from 'better-auth/db/migration';
import { auth, pool } from './auth.ts';

export async function migrate() {
  const connection = await pool.connect();
  try {
    await connection.query("SELECT pg_advisory_lock(hashtext('typomancer-schema-v1'))");
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS player_save (
        user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        revision bigint NOT NULL CHECK (revision > 0),
        mutation_id uuid NOT NULL,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS player_run (
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        run_id text NOT NULL,
        ended_at timestamptz NOT NULL,
        data jsonb NOT NULL,
        PRIMARY KEY (user_id, run_id)
      );
      CREATE INDEX IF NOT EXISTS player_run_history ON player_run(user_id, ended_at DESC);
    `);
  } finally {
    await connection.query("SELECT pg_advisory_unlock(hashtext('typomancer-schema-v1'))");
    connection.release();
  }
}
