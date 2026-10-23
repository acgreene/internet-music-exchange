import {
  DatabaseRepository,
  type Design,
  type DesignVersion,
  type GalleryDesignerRow,
  type GalleryDesignRow,
  type GalleryFilter,
} from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  DESIGN_STYLES,
  type GalleryDesign,
  type GalleryDesigner,
  type GalleryDesignersPage,
  type GalleryDesignersQuery,
  type GalleryDesignPage,
  type GalleryDesignsPage,
  type GalleryHome,
  type GalleryQuery,
  HttpStatus,
} from '@ime/models';
import { CatalogCards } from '../discovery/catalog-cards';
import { designEmails, EmailService } from '../email';
import { CloudStorageService } from '../storage';

const BUNDLE_URL_EXPIRY_SECONDS = 3600;
/** How many designs or designers one page of the gallery shows. */
const PAGE_SIZE = 24;
/** How many designs a shelf on the gallery's front shows. */
const SHELF_SIZE = 4;
/** How many designs a shelf reads, to keep one per designer. */
const SHELF_READ = 24;
/** How many designers taking requests the front shows. */
const DESIGNERS_SHOWN = 6;
/** A style needs this many designs to get a day on the front. */
const STYLE_SHELF_MIN = 3;
/** How many of a designer's designs their card names. */
const DESIGNS_NAMED = 3;
/** A design this cheap or cheaper counts as under $10. */
const UNDER_TEN = 1000;
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
   * A page of listed release designs, narrowed by words (in the name,
   * description, or designer), a style, a price, a designer, or designers
   * taking requests, in today's shuffle unless asked otherwise.
   */
  public async list(query: GalleryQuery = {}): Promise<GalleryDesignsPage> {
    const page = query.page ?? 1;
    const rows = await this.db.designs.listGallery({
      ...this.base(),
      words: query.q?.trim() || undefined,
      style: query.style,
      price:
        query.price === 'free'
          ? 'free'
          : query.price === 'under-10'
            ? UNDER_TEN
            : undefined,
      requests: !!query.requests,
      designer: query.designer?.trim() || undefined,
      order: query.sort ?? 'shuffle',
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    });
    return {
      designs: await this.toGalleryRows(rows.slice(0, PAGE_SIZE)),
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  /**
   * A page of the designers behind listed designs, narrowed by words in
   * their name, a style they work in, or to those taking custom requests,
   * in today's shuffle unless asked otherwise.
   */
  public async listDesigners(
    query: GalleryDesignersQuery = {},
  ): Promise<GalleryDesignersPage> {
    const page = query.page ?? 1;
    const rows = await this.db.designs.listGalleryDesigners({
      surface: 'release',
      day: today(),
      words: query.q?.trim() || undefined,
      style: query.style,
      requests: !!query.requests,
      order: query.sort ?? 'shuffle',
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    });
    return {
      designers: rows.slice(0, PAGE_SIZE).map(toDesigner),
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  /**
   * The gallery's front: the newest designs, designs on the latest
   * releases, a style of the day, and designers taking requests. Shelves
   * keep one design per designer, so no one fills a row.
   */
  public async home(): Promise<GalleryHome> {
    const read = (filter: Partial<GalleryFilter>) =>
      this.db.designs.listGallery({
        ...this.base(),
        limit: SHELF_READ,
        offset: 0,
        ...filter,
      });
    const [newestRows, inUseRows, style, designers] = await Promise.all([
      read({ order: 'newest' }),
      read({ order: 'recently-used', inUse: true }),
      this.styleOfTheDay(read),
      this.db.designs.listGalleryDesigners({
        surface: 'release',
        day: today(),
        requests: true,
        order: 'shuffle',
        limit: DESIGNERS_SHOWN,
        offset: 0,
      }),
    ]);
    const newest = onePerDesigner(newestRows);
    // a design already on the first shelf leaves room on the second
    const shown = new Set(newest.map((row) => row.design.id));
    const inUse = onePerDesigner(
      inUseRows.filter((row) => !shown.has(row.design.id)),
    );
    const [newestDesigns, inUseDesigns, styleDesigns] = await Promise.all([
      this.toGalleryRows(newest),
      this.toGalleryRows(inUse),
      style ? this.toGalleryRows(style.rows) : [],
    ]);
    return {
      newest: newestDesigns,
      inUse: inUseDesigns,
      style: style && { id: style.id, designs: styleDesigns },
      designers: designers.map(toDesigner),
    };
  }

  /**
   * A different style each day, starting from the day's turn and moving on
   * until one fills a shelf with a design from each of several designers.
   */
  private async styleOfTheDay(
    read: (filter: Partial<GalleryFilter>) => Promise<GalleryDesignRow[]>,
  ): Promise<{ id: string; rows: GalleryDesignRow[] } | null> {
    const counts = await this.db.designs.countListedStyles('release');
    const candidates = DESIGN_STYLES.filter(
      (style) => (counts.get(style.id) ?? 0) >= STYLE_SHELF_MIN,
    );
    const day = Math.floor(Date.now() / DAY_MS);
    for (let turn = 0; turn < candidates.length; turn++) {
      const { id } = candidates[(day + turn) % candidates.length];
      const rows = onePerDesigner(await read({ style: id }));
      if (rows.length >= STYLE_SHELF_MIN) return { id, rows };
    }
    return null;
  }

  private base(): Pick<GalleryFilter, 'surface' | 'day' | 'order'> {
    return { surface: 'release', day: today(), order: 'shuffle' };
  }

  /** Gallery designs from listed rows, each with a link to its latest version. */
  private async toGalleryRows(
    rows: GalleryDesignRow[],
  ): Promise<GalleryDesign[]> {
    const shown = await Promise.all(
      rows.map(async (row) => {
        const latest = await this.db.designs.getLatestVersion(row.design.id);
        return latest && this.present(row, latest);
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
    const designer = design.designerUserId
      ? await this.db.users.getById(design.designerUserId)
      : null;
    const row: GalleryDesignRow = {
      design,
      releaseCount: counts.get(designId) ?? 0,
      designer: designer && {
        username: designer.username,
        name: designer.name,
        openToCommissions: designer.openToCommissions,
      },
    };
    return {
      ...(await this.present(row, latest)),
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

  private async present(
    { design, designer, releaseCount }: GalleryDesignRow,
    latest: DesignVersion,
  ): Promise<GalleryDesign> {
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
        styles: design.styles,
        publishedAt: design.publishedAt,
      },
      designer,
      slots: latest.slots,
      bundleUrl: await this.storage.getObjectSignedUrl(
        latest.objectKey,
        BUNDLE_URL_EXPIRY_SECONDS,
      ),
      releaseCount,
    };
  }

  private error(status: HttpStatus, message: string): ApiError {
    return new ApiError(ApiErrorKind.Http, status, message);
  }
}

/** Today in UTC, which seeds the gallery's shuffle. */
const today = () => new Date().toISOString().slice(0, 10);

/** The first design from each designer, up to a shelf's worth. */
function onePerDesigner(rows: GalleryDesignRow[]): GalleryDesignRow[] {
  const seen = new Set<string>();
  const kept: GalleryDesignRow[] = [];
  for (const row of rows) {
    const key = row.design.designerUserId ?? row.design.id;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
    if (kept.length === SHELF_SIZE) break;
  }
  return kept;
}

/** A designer card: their styles by how many designs carry them, and a few designs. */
function toDesigner(row: GalleryDesignerRow): GalleryDesigner {
  const counts = new Map<string, number>();
  for (const design of row.designs) {
    for (const style of design.styles) {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    }
  }
  return {
    username: row.username,
    name: row.name,
    openToCommissions: row.openToCommissions,
    designCount: row.designs.length,
    releaseCount: row.releaseCount,
    styles: [...counts].sort((a, b) => b[1] - a[1]).map(([style]) => style),
    designs: row.designs
      .slice(0, DESIGNS_NAMED)
      .map(({ id, name }) => ({ id, name })),
  };
}
