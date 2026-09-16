import type { Pool } from 'pg';
import type { z } from 'zod';
import type { saveRequestSchema } from '../services/progressSchema.ts';

export async function readSave(pool: Pool, userId: string) {
  const result = await pool.query('SELECT revision, snapshot, updated_at FROM player_save WHERE user_id = $1', [userId]);
  const row = result.rows[0];
  return { userId, revision: row ? Number(row.revision) : 0, snapshot: row?.snapshot ?? null, updatedAt: row?.updated_at ?? null };
}

export async function writeSave(pool: Pool, userId: string, input: z.infer<typeof saveRequestSchema>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializes first-write inserts too. Only the authenticated user's lock is acquired.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
    const { rows } = await client.query('SELECT revision, mutation_id, snapshot FROM player_save WHERE user_id = $1', [userId]);
    const current = rows[0];
    if (current?.mutation_id === input.mutationId) {
      await client.query('COMMIT');
      return { conflict: false, revision: Number(current.revision) };
    }
    if (Number(current?.revision ?? 0) !== input.revision) {
      await client.query('ROLLBACK');
      return { conflict: true, revision: Number(current?.revision ?? 0) };
    }
    const revision = input.revision + 1;
    await client.query(`INSERT INTO player_save(user_id, revision, mutation_id, snapshot) VALUES ($1,$2,$3,$4)
      ON CONFLICT(user_id) DO UPDATE SET revision=$2, mutation_id=$3, snapshot=$4, updated_at=now()`,
      [userId, revision, input.mutationId, JSON.stringify(input.snapshot)]);
    for (const run of input.snapshot.progress.runs) {
      await client.query(`INSERT INTO player_run(user_id,run_id,ended_at,data) VALUES ($1,$2,$3,$4)
        ON CONFLICT(user_id,run_id) DO NOTHING`, [userId, run.id, run.endedAt, JSON.stringify(run)]);
    }
    await client.query('COMMIT');
    return { conflict: false, revision };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
