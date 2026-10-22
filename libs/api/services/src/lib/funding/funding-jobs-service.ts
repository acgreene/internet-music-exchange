import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { EmailService, fundingEmails } from '../email';
import { ReleaseFilesService } from '../releases/release-files-service';
import { GRACE_DAYS } from './monthly-close-service';

/** Warnings go out when this many days of the grace period are left. */
const WARNING_DAYS = [7, 1];

/** How long an artist stays off sale before files nobody owns are deleted. */
const CLEANUP_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Funding's daily work, run by the worker: counting each day's storage,
 * warning sellers whose balance lapsed, taking their things off sale when the
 * grace period ends, and deleting files nobody owns once an artist has been
 * off sale long enough.
 *
 * Each run is claimed in `job_runs` first, so a worker restart never repeats
 * one.
 */
export class FundingJobsService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly releaseFiles: ReleaseFilesService = new ReleaseFilesService(
      db,
    ),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Run everything due today.
   */
  public async runDaily(now: Date = new Date()): Promise<void> {
    await this.snapshotStorage(now);
    await this.checkLapses(now);
    await this.cleanUpLongOffSale(now);
  }

  /**
   * Add what every artist and designer stores today to this month's usage.
   */
  public async snapshotStorage(now: Date): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    if (!(await this.db.jobRuns.claim('storage_snapshot', day))) return;

    try {
      const month = `${day.slice(0, 7)}-01`;
      const [artists, designers] = await Promise.all([
        this.db.funding.listStoredBytesByArtist(),
        this.db.funding.listStoredBytesByDesigner(),
      ]);
      for (const { owner, bytes } of artists) {
        await this.db.funding.addStoredBytes(month, { artistId: owner }, bytes);
      }
      for (const { owner, bytes } of designers) {
        await this.db.funding.addStoredBytes(
          month,
          { designerUserId: owner },
          bytes,
        );
      }
    } catch (error) {
      // let tomorrow's attempt, or a restart, try today again
      await this.db.jobRuns.release('storage_snapshot', day);
      throw error;
    }
  }

  /**
   * Warn lapsed sellers as their grace period runs out, and take what they
   * pay for off sale when it ends.
   */
  public async checkLapses(now: Date): Promise<void> {
    const billingUrl = `${this.webAppUrl}/manage/billing`;

    for (const billing of await this.db.funding.listLapsedSince(now)) {
      const lapsedAt = billing.lapsedAt as Date;
      const daysLeft =
        GRACE_DAYS - Math.floor((now.getTime() - lapsedAt.getTime()) / DAY_MS);
      // one lapse, one set of emails, even across restarts
      const lapse = `${billing.userId}:${lapsedAt.toISOString()}`;

      if (daysLeft <= 0) {
        if (await this.db.jobRuns.claim('off_sale', lapse)) {
          await this.takeOffSale(billing.userId, billingUrl);
        }
        continue;
      }

      for (const warning of WARNING_DAYS) {
        if (
          daysLeft <= warning &&
          (await this.db.jobRuns.claim(`lapse_warning_${warning}`, lapse))
        ) {
          const address = await this.db.users.getEmail(billing.userId);
          if (address) {
            await this.email.send(
              fundingEmails.lapseWarning(address, daysLeft, billingUrl),
            );
          }
        }
      }
    }
  }

  /**
   * Delete the files of releases nobody owns, for artists that have been off
   * sale for 90 days. Files listeners own are always kept.
   */
  public async cleanUpLongOffSale(now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - CLEANUP_DAYS * DAY_MS);

    for (const artistId of await this.db.funding.listArtistsOffSaleSince(
      cutoff,
    )) {
      const artist = await this.db.artists.getById(artistId);
      const run = `${artistId}:${artist?.offSaleAt?.toISOString()}`;
      if (!(await this.db.jobRuns.claim('off_sale_cleanup', run))) continue;

      for (const release of await this.db.releases.listAllByArtist(artistId)) {
        if ((await this.db.entitlements.countOwners(release.id)) > 0) continue;
        await this.releaseFiles.deleteAll(release.id);
      }
    }
  }

  private async takeOffSale(userId: string, billingUrl: string): Promise<void> {
    const shares = await this.db.funding.listSharesPaidBy(userId);
    const artistIds = shares.map((share) => share.artistId);
    await this.db.transaction(async (repos) => {
      await repos.funding.takeArtistsOffSale(artistIds);
      await repos.funding.takeDesignsOffSale(userId);
    });

    // every manager of an affected artist hears about it, not only the payer
    for (const artistId of artistIds) {
      const artist = await this.db.artists.getById(artistId);
      for (const manager of await this.db.artists.listManagers(artistId)) {
        const address = await this.db.users.getEmail(manager.userId);
        if (address) {
          await this.email.send(
            fundingEmails.offSale(
              address,
              artist?.name ?? 'Your artist',
              billingUrl,
            ),
          );
        }
      }
    }

    const designs = await this.db.designs.listByDesigner(userId);
    const address = await this.db.users.getEmail(userId);
    if (designs.length > 0 && address) {
      await this.email.send(
        fundingEmails.offSale(address, 'Your designs', billingUrl),
      );
    }
  }
}
