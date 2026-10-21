import { DatabaseService } from '@ime/db';

/**
 * Reports whether the services the API depends on are reachable.
 */
export class HealthService {
  constructor(
    private readonly database: DatabaseService = DatabaseService.getInstance(),
  ) {}

  /**
   * Report whether the database answers a trivial query.
   */
  public isDatabaseReachable(): Promise<boolean> {
    return this.database.ping();
  }
}
