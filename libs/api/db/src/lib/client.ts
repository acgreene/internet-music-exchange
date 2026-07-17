import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * The Drizzle database handle, typed against the full schema.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Create a database handle from a Postgres connection string.
 * prepare is disabled to stay compatible with Supabase's transaction pooler.
 */
export function createDb(connectionString: string): Db {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}
