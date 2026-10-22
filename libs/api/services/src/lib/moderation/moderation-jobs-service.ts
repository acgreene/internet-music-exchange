import { DatabaseRepository } from '@ime/db';
import { Logger } from '@ime/utils';
import { ModerationService } from './moderation-service';
import { CONTEST_DAYS } from './report-service';

const DAY_MS = 86_400_000;

/**
 * Moderation's daily work, run by the worker: making copyright takedowns
 * final once the window to contest them has passed with no contest.
 */
export class ModerationJobsService {
  private readonly log = new Logger('api').child('moderation-jobs');

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly moderation: ModerationService = new ModerationService(db),
  ) {}

  /**
   * Run everything due today. Finalizing is safe to repeat, so a restart
   * never refunds anyone twice.
   */
  public async runDaily(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - CONTEST_DAYS * DAY_MS);
    for (const releaseId of await this.db.moderation.listOverdueCopyrightTakedowns(
      cutoff,
    )) {
      const outcome = await this.moderation.finalizeTakedown(releaseId, null);
      if (outcome.failedRefunds.length > 0) {
        this.log.error(
          `takedown of ${releaseId} is final, but these refunds failed: ${outcome.failedRefunds.join(', ')}`,
        );
      }
    }
  }
}
