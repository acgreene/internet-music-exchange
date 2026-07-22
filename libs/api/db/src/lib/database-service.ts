import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@ime/env';
import * as schema from './schema';

/**
 * The Drizzle database handle typed against our full schema.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * The handle a transaction callback runs its queries through. Repository
 * helpers take one so several writes can share a single transaction.
 */
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Singleton database service, creates an instance of the database connection
 * and provides convenience methods to interact with it.
 */
export class DatabaseService {
  /**
   * The singleton instance of the database service.
   * @private
   */
  private static instance: DatabaseService | null = null;

  /**
   * The database handle every query runs through.
   */
  public readonly db: Db;

  private constructor() {
    this.db = this.createDb(env.DATABASE_URL);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
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
