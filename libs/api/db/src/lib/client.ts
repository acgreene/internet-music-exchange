import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@ime/env';
import * as schema from './schema';

/**
 * The Drizzle database handle, typed against the full schema.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Create a database handle from a Postgres connection string.
 */
export function createDb(connectionString: string): Db {
  const client = postgres(connectionString, {
    prepare: false,
    connect_timeout: 5,
  });
  return drizzle(client, { schema });
}

/**
 * Singleton database instance.
 */
export const db: Db = createDb(env.DATABASE_URL);

/**
 * Report whether the database answers a trivial query.
 */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
