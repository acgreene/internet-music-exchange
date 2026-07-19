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
 * Owns the database handle and the operations that run against it, so callers
 * never build a connection themselves.
 */
export class DatabaseService {
  /**
   * The database handle every query runs through.
   */
  public readonly db: Db;

  constructor(
    /**
     * Postgres connection string.
     */
    connectionString: string = env.DATABASE_URL,
  ) {
    this.db = this.createDb(connectionString);
  }

  /**
   * Report whether the database answers a trivial query.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a database handle from a Postgres connection string.
   */
  private createDb(connectionString: string): Db {
    const client = postgres(connectionString, {
      prepare: false,
      connect_timeout: 5,
    });
    return drizzle(client, { schema });
  }
}

/**
 * Singleton database service, includes higher order convenience methods
 * to interact with the database. For database queries use the `db` singleton.
 */
export const databaseService = new DatabaseService();

/**
 * Singleton database handle used to interact with and query the database.
 */
export const db = databaseService.db;
