import { DatabaseRepository, type Design, type DesignVersion } from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type GalleryDesign,
  type GalleryDesignPage,
  HttpStatus,
} from '@ime/models';
import { CatalogCards } from '../discovery/catalog-cards';
import { designEmails, EmailService } from '../email';
import { CloudStorageService } from '../storage';

const BUNDLE_URL_EXPIRY_SECONDS = 3600;
const GALLERY_SIZE = 48;
const RELEASES_SHOWN = 8;
const MESSAGE_MAX_LENGTH = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Requests one person may send in a day, to anyone. */
const REQUESTS_PER_DAY = 5;

/**
 * The public design gallery: every listed design with what it takes to
 * preview it, the releases using one, and asking a designer for a custom
 * design. Anyone can look; asking needs an account, so the designer can
 * reply.
 */
export class DesignGalleryService {
  private readonly cards: CatalogCards;

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly email: EmailService = new EmailService(),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  /**
   * Every listed release design, newest first.
   */
  public async list(): Promise<GalleryDesign[]> {
    const designs = await this.db.designs.listMarketplace(
      'release',
      GALLERY_SIZE,
    );
    const counts = await this.db.designs.countReleasesUsing(
      designs.map((design) => design.id),
    );
    const shown = await Promise.all(
      designs.map(async (design) => {
        const latest = await this.db.designs.getLatestVersion(design.id);
        return latest && this.toGallery(design, latest, counts);
      }),
    );
    return shown.filter((design): design is GalleryDesign => !!design);
  }

  /**
   * One design's gallery page.
   *
   * @throws ApiError 404 unless the design is listed.
   */
  public async get(designId: string): Promise<GalleryDesignPage> {
    const { design, latest } = await this.requireListed(designId);
    const [counts, releases] = await Promise.all([
      this.db.designs.countReleasesUsing([designId]),
      this.db.shelves.listUsingDesign(designId, RELEASES_SHOWN),
    ]);
    return {
      ...(await this.toGallery(design, latest, counts)),
      releases: await this.cards.releases(releases),
    };
  }

  /**
   * Pass a request for a custom design on to the designer by email, with the
   * requester's address to reply to.
   *
   * @throws ApiError 400 for an empty or overlong message, 403 when the
   * requester is suspended, 404 unless the design is listed, 409 when its
   * designer is not taking commissions, 429 after too many requests.
   */
  public async requestCommission(
    userId: string,
    designId: string,
    message: string,
  ): Promise<void> {
    const text = message.trim();
    if (!text || text.length > MESSAGE_MAX_LENGTH) {
      throw this.error(
        HttpStatus.BadRequest,
        `Say what you have in mind, in up to ${MESSAGE_MAX_LENGTH} characters.`,
      );
    }

    const { design } = await this.requireListed(designId);
    const [requester, designer] = await Promise.all([
      this.db.users.getById(userId),
      design.designerUserId
        ? this.db.users.getById(design.designerUserId)
        : null,
    ]);
    if (!requester || requester.suspendedAt) {
      throw this.error(
        HttpStatus.Forbidden,
        'Suspended accounts cannot send requests.',
      );
    }
    if (!designer?.openToCommissions || designer.id === userId) {
      throw this.error(
        HttpStatus.Conflict,
        "This design's designer is not taking requests.",
      );
    }

    const since = new Date(Date.now() - DAY_MS);
    const [toThem, toAnyone] = await Promise.all([
      this.db.designs.countCommissionRequestsSince(userId, since, designer.id),
      this.db.designs.countCommissionRequestsSince(userId, since),
    ]);
    if (toThem > 0 || toAnyone >= REQUESTS_PER_DAY) {
      throw this.error(
        HttpStatus.TooManyRequests,
        toThem > 0
          ? 'You already asked this designer today. Give them time to reply.'
          : 'You have sent several requests today. Try again tomorrow.',
      );
    }

    const [to, replyTo] = await Promise.all([
      this.db.users.getEmail(designer.id),
      this.db.users.getEmail(userId),
    ]);
    if (!to || !replyTo) {
      throw this.error(HttpStatus.Conflict, 'The request could not be sent.');
    }

    await this.db.designs.addCommissionRequest({
      designerUserId: designer.id,
      requesterUserId: userId,
      designId,
      message: text,
    });
    await this.email.send(
      designEmails.commissionRequest(
        to,
        replyTo,
        requester.username ? `@${requester.username}` : 'Someone on IME',
        design.name,
        text,
      ),
    );
  }

  private async requireListed(
    designId: string,
  ): Promise<{ design: Design; latest: DesignVersion }> {
    const design = await this.db.designs.getById(designId);
    const latest = design && (await this.db.designs.getLatestVersion(designId));
    if (
      !design ||
      !latest ||
      design.status !== 'published' ||
      design.visibility !== 'public' ||
      design.offSaleAt ||
      design.surface !== 'release'
    ) {
      throw this.error(HttpStatus.NotFound, 'Design not found.');
    }
    return { design, latest };
  }

  private async toGallery(
    design: Design,
    latest: DesignVersion,
    counts: Map<string, number>,
  ): Promise<GalleryDesign> {
    const designer = design.designerUserId
      ? await this.db.users.getById(design.designerUserId)
      : null;
    return {
      design: {
        id: design.id,
        name: design.name,
        description: design.description,
        surface: design.surface,
        pricingMode: design.pricingMode,
        currency: design.currency,
        minimumPrice: design.minimumPrice,
        suggestedPrice: design.suggestedPrice,
        publishedAt: design.publishedAt,
      },
      designer: designer && {
        username: designer.username,
        name: designer.name,
        openToCommissions: designer.openToCommissions,
      },
      slots: latest.slots,
      bundleUrl: await this.storage.getObjectSignedUrl(
        latest.objectKey,
        BUNDLE_URL_EXPIRY_SECONDS,
      ),
      releaseCount: counts.get(design.id) ?? 0,
    };
  }

  private error(status: HttpStatus, message: string): ApiError {
    return new ApiError(ApiErrorKind.Http, status, message);
  }
}
