import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * The Drizzle database handle, typed against the full schema.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Create a database handle from a Postgres connection string. prepare is
 * disabled to stay compatible with Supabase's transaction pooler, and
 * connections fail fast so health checks report an unreachable database
 * promptly.
 */
export function createDb(connectionString: string): Db {
  const client = postgres(connectionString, {
    prepare: false,
    connect_timeout: 5,
  });
  return drizzle(client, { schema });
}

let sharedDb: Db | undefined;

/**
 * The process-wide database handle, created lazily from DATABASE_URL. Throws
 * when the variable is missing so a misconfigured process fails loudly.
 */
export function getDb(): Db {
  if (!sharedDb) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and run `supabase start`.',
      );
    }
    sharedDb = createDb(connectionString);
  }
  return sharedDb;
}

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
