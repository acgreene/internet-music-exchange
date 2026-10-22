import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,
  ne,
  sql,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  commissionRequests,
  type Currency,
  type Design,
  type DesignLicense,
  designLicenses,
  designs,
  type DesignSlot,
  type DesignSurface,
  type DesignVersion,
  designVersions,
  type DesignVisibility,
  type PricingMode,
  type ReleaseDesign,
  type ReleaseDesignImage,
  releaseDesignImages,
  releaseDesigns,
  releases,
} from '../tables';

/**
 * The design version a release renders with, and the artist's values for its
 * slots.
 */
export interface ReleaseDesignDetails {
  designId: string;
  designName: string;
  designVersionId: string;
  version: number;
  bucket: string;
  objectKey: string;
  slots: DesignSlot[];
  customization: Record<string, string>;
}

/**
 * How many releases use one version of a design.
 */
export interface DesignVersionUsage {
  designVersionId: string;
  version: number;
  releases: number;
}

/**
 * A paid license, as listed in a designer's sales.
 */
export interface DesignSale extends DesignLicense {
  designName: string;
}

export interface CreateDesignParams {
  designerUserId: string;
  name: string;
  surface: DesignSurface;
  description?: string | null;
}

export interface UpdateDesignParams {
  name?: string;
  description?: string | null;
  visibility?: DesignVisibility;
  pricingMode?: PricingMode;
  currency?: Currency | null;
  minimumPrice?: number;
  suggestedPrice?: number | null;
}

export interface AddDesignVersionParams {
  designId: string;
  bucket: string;
  objectKey: string;
  byteSize: number;
  slots: DesignSlot[];
}

export interface GrantDesignLicenseParams {
  designId: string;
  artistId: string;
  source: 'free' | 'grant';
  acquiredByUserId?: string | null;
}

export interface RecordDesignPurchaseParams {
  designId: string;
  artistId: string;
  acquiredByUserId: string;
  amount: number;
  currency: Currency;
  stripePaymentIntentId: string;
}

export interface AddReleaseDesignImageParams {
  releaseId: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
}

const DEFAULT_LIST_LIMIT = 24;
const DEFAULT_SEARCH_LIMIT = 20;

const isListed = and(
  eq(designs.status, 'published'),
  eq(designs.visibility, 'public'),
  isNull(designs.offSaleAt),
);

/**
 * Queries for page designs: the designs and their versions, the licenses
 * artists hold for them, and which version each release renders with.
 */
export class DesignRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a design by its id.
   *
   * @param designId - The id of the design to look up.
   * @returns The design row, or null when no design has that id.
   */
  public async getById(designId: string): Promise<Design | null> {
    const [design] = await this.db
      .select()
      .from(designs)
      .where(eq(designs.id, designId))
      .limit(1);

    return design ?? null;
  }

  /**
   * Browse the marketplace for one kind of page.
   *
   * @param surface - The surface the designs are built for.
   * @param limit - The maximum number of designs to return.
   * @param offset - How many designs to skip, for paging.
   * @returns Published public designs for that surface, newest first.
   */
  public async listMarketplace(
    surface: DesignSurface,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<Design[]> {
    return this.db
      .select()
      .from(designs)
      .where(and(isListed, eq(designs.surface, surface)))
      .orderBy(desc(designs.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Search the marketplace by design name.
   *
   * @param query - The text to match against design names, case-insensitive.
   * @param surface - The surface to narrow to, or every surface when omitted.
   * @param limit - The maximum number of designs to return.
   * @returns Matching published public designs, newest first.
   */
  public async searchMarketplace(
    query: string,
    surface?: DesignSurface,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<Design[]> {
    return this.db
      .select()
      .from(designs)
      .where(
        and(
          isListed,
          ilike(designs.name, `%${query}%`),
          surface ? eq(designs.surface, surface) : undefined,
        ),
      )
      .orderBy(desc(designs.publishedAt))
      .limit(limit);
  }

  /**
   * List the designs a designer has built, drafts, private, and archived
   * included.
   *
   * @param designerUserId - The id of the designer.
   * @returns Their designs, newest first.
   */
  public async listByDesigner(designerUserId: string): Promise<Design[]> {
    return this.db
      .select()
      .from(designs)
      .where(eq(designs.designerUserId, designerUserId))
      .orderBy(desc(designs.createdAt));
  }

  /**
   * List every designer with at least one published design, public or
   * private, for the monthly close.
   *
   * @returns Their user ids.
   */
  public async listPublishingDesigners(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ designerUserId: designs.designerUserId })
      .from(designs)
      .where(
        and(eq(designs.status, 'published'), isNotNull(designs.designerUserId)),
      );

    return rows.map((row) => row.designerUserId as string);
  }

  /**
   * Create a design. It starts as a free, public draft.
   *
   * @param params - The designer, the design's name and surface, and an
   * optional description.
   * @returns The newly created design row.
   */
  public async create(params: CreateDesignParams): Promise<Design> {
    const [design] = await this.db.insert(designs).values(params).returning();

    return design;
  }

  /**
   * Update a design's details, visibility, or price. Status is changed through
   * `publish` and `archive` instead.
   *
   * @param designId - The id of the design to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    designId: string,
    params: UpdateDesignParams,
  ): Promise<void> {
    await this.db
      .update(designs)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(designs.id, designId));
  }

  /**
   * Make a design available, provided it has at least one version.
   *
   * @param designId - The id of the design to publish.
   * @returns True when the design was published, false when it has no version
   * to render.
   */
  public async publish(designId: string): Promise<boolean> {
    const published = await this.db
      .update(designs)
      .set({
        status: 'published',
        // republishing an archived design keeps the date it first went out
        publishedAt: sql`coalesce(${designs.publishedAt}, now())`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(designs.id, designId),
          exists(
            this.db
              .select({ id: designVersions.id })
              .from(designVersions)
              .where(eq(designVersions.designId, designId)),
          ),
        ),
      )
      .returning({ id: designs.id });

    return published.length > 0;
  }

  /**
   * Withdraw a design from the marketplace. Licenses and the releases using it
   * are unaffected.
   *
   * @param designId - The id of the design to archive.
   */
  public async archive(designId: string): Promise<void> {
    await this.db
      .update(designs)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(designs.id, designId));
  }

  /**
   * Delete a design and its versions. Fails while any artist holds a license
   * for it or any release renders with one of its versions.
   *
   * @param designId - The id of the design to delete.
   */
  public async deleteById(designId: string): Promise<void> {
    await this.db.delete(designs).where(eq(designs.id, designId));
  }

  /**
   * Add a newly uploaded version of a design, numbered after the last one.
   *
   * @param params - The design, where its bundle lives, its size, and the slots
   * read from its manifest.
   * @returns The new version row.
   */
  public async addVersion(
    params: AddDesignVersionParams,
  ): Promise<DesignVersion> {
    return this.db.transaction(async (tx) => {
      // locking the design keeps two uploads from taking the same number
      await tx
        .select({ id: designs.id })
        .from(designs)
        .where(eq(designs.id, params.designId))
        .for('update');

      const [latest] = await tx
        .select({ version: max(designVersions.version) })
        .from(designVersions)
        .where(eq(designVersions.designId, params.designId));

      const [version] = await tx
        .insert(designVersions)
        .values({ ...params, version: (latest?.version ?? 0) + 1 })
        .returning();

      await tx
        .update(designs)
        .set({ updatedAt: new Date() })
        .where(eq(designs.id, params.designId));

      return version;
    });
  }

  /**
   * Find a design version by its id.
   *
   * @param designVersionId - The id of the version.
   * @returns The version row, or null when no version has that id.
   */
  public async getVersionById(
    designVersionId: string,
  ): Promise<DesignVersion | null> {
    const [version] = await this.db
      .select()
      .from(designVersions)
      .where(eq(designVersions.id, designVersionId))
      .limit(1);

    return version ?? null;
  }

  /**
   * Read the newest version of a design.
   *
   * @param designId - The id of the design.
   * @returns Its latest version, or null when nothing has been uploaded yet.
   */
  public async getLatestVersion(
    designId: string,
  ): Promise<DesignVersion | null> {
    const [version] = await this.db
      .select()
      .from(designVersions)
      .where(eq(designVersions.designId, designId))
      .orderBy(desc(designVersions.version))
      .limit(1);

    return version ?? null;
  }

  /**
   * List every version of a design.
   *
   * @param designId - The id of the design.
   * @returns Its versions, newest first.
   */
  public async listVersions(designId: string): Promise<DesignVersion[]> {
    return this.db
      .select()
      .from(designVersions)
      .where(eq(designVersions.designId, designId))
      .orderBy(desc(designVersions.version));
  }

  /**
   * Count how many releases use each version of a design.
   *
   * @param designId - The id of the design.
   * @returns One entry per version, newest first, including versions nobody
   * uses.
   */
  public async listVersionUsage(
    designId: string,
  ): Promise<DesignVersionUsage[]> {
    return this.db
      .select({
        designVersionId: designVersions.id,
        version: designVersions.version,
        releases: count(releaseDesigns.releaseId),
      })
      .from(designVersions)
      .leftJoin(
        releaseDesigns,
        eq(releaseDesigns.designVersionId, designVersions.id),
      )
      .where(eq(designVersions.designId, designId))
      .groupBy(designVersions.id, designVersions.version)
      .orderBy(desc(designVersions.version));
  }

  /**
   * Read an artist's license for a design, refunded or not.
   *
   * @param designId - The id of the design.
   * @param artistId - The id of the artist.
   * @returns The license row, or null when the artist never had one.
   */
  public async getLicense(
    designId: string,
    artistId: string,
  ): Promise<DesignLicense | null> {
    const [license] = await this.db
      .select()
      .from(designLicenses)
      .where(
        and(
          eq(designLicenses.designId, designId),
          eq(designLicenses.artistId, artistId),
        ),
      )
      .limit(1);

    return license ?? null;
  }

  /**
   * Report whether an artist may use a design.
   *
   * @param designId - The id of the design.
   * @param artistId - The id of the artist.
   * @returns True when the artist holds a license that was not refunded.
   */
  public async hasLicense(
    designId: string,
    artistId: string,
  ): Promise<boolean> {
    const [license] = await this.db
      .select({ designId: designLicenses.designId })
      .from(designLicenses)
      .where(
        and(
          eq(designLicenses.designId, designId),
          eq(designLicenses.artistId, artistId),
          isNull(designLicenses.refundedAt),
        ),
      )
      .limit(1);

    return Boolean(license);
  }

  /**
   * List the designs an artist may use: bought, claimed, or granted privately.
   *
   * @param artistId - The id of the artist.
   * @returns The licensed designs, most recently acquired first.
   */
  public async listLicensedDesigns(artistId: string): Promise<Design[]> {
    return this.db
      .select(getTableColumns(designs))
      .from(designLicenses)
      .innerJoin(designs, eq(designs.id, designLicenses.designId))
      .where(
        and(
          eq(designLicenses.artistId, artistId),
          isNull(designLicenses.refundedAt),
          ne(designs.status, 'taken_down'),
        ),
      )
      .orderBy(desc(designLicenses.createdAt));
  }

  /**
   * License a design to an artist without a payment: a free claim, or a
   * designer's grant of a private design. Doing it twice changes nothing.
   *
   * @param params - The design, the artist, how it was acquired, and who
   * claimed it.
   */
  public async grantLicense(params: GrantDesignLicenseParams): Promise<void> {
    await this.db.insert(designLicenses).values(params).onConflictDoNothing();
  }

  /**
   * Record a paid license once the payment settles. Safe to repeat for the
   * same payment, as when a webhook is delivered twice.
   *
   * @param params - The design, the artist, the manager who paid, and the
   * payment.
   * @returns The stored license row.
   */
  public async recordPurchase(
    params: RecordDesignPurchaseParams,
  ): Promise<DesignLicense> {
    const [license] = await this.db
      .insert(designLicenses)
      .values({ ...params, source: 'purchase' })
      // buying again after a refund restores the license with the new payment
      .onConflictDoUpdate({
        target: [designLicenses.designId, designLicenses.artistId],
        set: {
          source: 'purchase',
          acquiredByUserId: params.acquiredByUserId,
          amount: params.amount,
          currency: params.currency,
          stripePaymentIntentId: params.stripePaymentIntentId,
          refundedAt: null,
        },
      })
      .returning();

    return license;
  }

  /**
   * Mark a paid license refunded. The row stays as a sales record, but the
   * artist can no longer use the design.
   *
   * @param stripePaymentIntentId - The payment that was refunded.
   * @returns The refunded license, or null when no license matches or it was
   *   already refunded.
   */
  public async markRefunded(
    stripePaymentIntentId: string,
  ): Promise<DesignLicense | null> {
    const [license] = await this.db
      .update(designLicenses)
      .set({ refundedAt: new Date() })
      .where(
        and(
          eq(designLicenses.stripePaymentIntentId, stripePaymentIntentId),
          // a refund's effects apply once
          isNull(designLicenses.refundedAt),
        ),
      )
      .returning();

    return license ?? null;
  }

  /**
   * List a designer's paid sales across all their designs.
   *
   * @param designerUserId - The id of the designer.
   * @returns Each purchase with its design's name, newest first, refunded ones
   * included.
   */
  public async listSalesByDesigner(
    designerUserId: string,
  ): Promise<DesignSale[]> {
    return this.db
      .select({ ...getTableColumns(designLicenses), designName: designs.name })
      .from(designLicenses)
      .innerJoin(designs, eq(designs.id, designLicenses.designId))
      .where(
        and(
          eq(designs.designerUserId, designerUserId),
          eq(designLicenses.source, 'purchase'),
        ),
      )
      .orderBy(desc(designLicenses.createdAt));
  }

  /**
   * Read the design a release renders with, ready to be served.
   *
   * @param releaseId - The id of the release being rendered.
   * @returns The pinned version's bundle and slots, and the artist's values,
   * or null when the release uses the default layout.
   */
  public async getReleaseDesign(
    releaseId: string,
  ): Promise<ReleaseDesignDetails | null> {
    const [details] = await this.db
      .select({
        designId: designs.id,
        designName: designs.name,
        designVersionId: designVersions.id,
        version: designVersions.version,
        bucket: designVersions.bucket,
        objectKey: designVersions.objectKey,
        slots: designVersions.slots,
        customization: releaseDesigns.customization,
      })
      .from(releaseDesigns)
      .innerJoin(
        designVersions,
        eq(designVersions.id, releaseDesigns.designVersionId),
      )
      .innerJoin(designs, eq(designs.id, designVersions.designId))
      .where(
        and(
          eq(releaseDesigns.releaseId, releaseId),
          // a taken-down design leaves its releases on the default layout
          ne(designs.status, 'taken_down'),
        ),
      )
      .limit(1);

    return details ?? null;
  }

  /**
   * Dress a release in a design version, replacing whichever it used before.
   * Also, how a release moves to a newer version of its design.
   *
   * @param releaseId - The id of the release.
   * @param designVersionId - The version to render with.
   * @param customization - The artist's slot values.
   * @returns The stored row.
   */
  public async setReleaseDesign(
    releaseId: string,
    designVersionId: string,
    customization: Record<string, string> = {},
  ): Promise<ReleaseDesign> {
    const [applied] = await this.db
      .insert(releaseDesigns)
      .values({ releaseId, designVersionId, customization })
      .onConflictDoUpdate({
        target: releaseDesigns.releaseId,
        set: { designVersionId, customization, updatedAt: new Date() },
      })
      .returning();

    return applied;
  }

  /**
   * Replace the artist's slot values for a release's design.
   *
   * @param releaseId - The id of the release.
   * @param customization - The new slot values, replacing the old set whole.
   */
  public async updateReleaseCustomization(
    releaseId: string,
    customization: Record<string, string>,
  ): Promise<void> {
    await this.db
      .update(releaseDesigns)
      .set({ customization, updatedAt: new Date() })
      .where(eq(releaseDesigns.releaseId, releaseId));
  }

  /**
   * Return a release to the default layout.
   *
   * @param releaseId - The id of the release.
   */
  public async clearReleaseDesign(releaseId: string): Promise<void> {
    await this.db
      .delete(releaseDesigns)
      .where(eq(releaseDesigns.releaseId, releaseId));
  }

  /**
   * Record an image an artist uploaded for one of their design's image slots.
   *
   * @param params - The release and the uploaded object.
   * @returns The new image row, whose id goes into the release's customization.
   */
  public async addReleaseDesignImage(
    params: AddReleaseDesignImageParams,
  ): Promise<ReleaseDesignImage> {
    const [image] = await this.db
      .insert(releaseDesignImages)
      .values(params)
      .returning();

    return image;
  }

  /**
   * List the slot images uploaded for a release.
   *
   * @param releaseId - The id of the release.
   * @returns The release's slot images, oldest first.
   */
  public async listReleaseDesignImages(
    releaseId: string,
  ): Promise<ReleaseDesignImage[]> {
    return this.db
      .select()
      .from(releaseDesignImages)
      .where(eq(releaseDesignImages.releaseId, releaseId))
      .orderBy(releaseDesignImages.createdAt);
  }

  /**
   * Delete a slot image.
   *
   * @param imageId - The id of the image.
   * @returns The deleted row, so its object can be removed from storage, or
   * null when there was none.
   */
  public async deleteReleaseDesignImage(
    imageId: string,
  ): Promise<ReleaseDesignImage | null> {
    const [image] = await this.db
      .delete(releaseDesignImages)
      .where(eq(releaseDesignImages.id, imageId))
      .returning();

    return image ?? null;
  }

  /**
   * Find a slot image by its id.
   *
   * @param imageId - The id of the image.
   * @returns The image row, or null when there is none.
   */
  public async getReleaseDesignImage(
    imageId: string,
  ): Promise<ReleaseDesignImage | null> {
    const [image] = await this.db
      .select()
      .from(releaseDesignImages)
      .where(eq(releaseDesignImages.id, imageId))
      .limit(1);

    return image ?? null;
  }

  /**
   * List the releases rendering with any version of a design.
   *
   * @param designId - The id of the design.
   * @returns Each release with its artist and title.
   */
  public async listReleasesUsingDesign(
    designId: string,
  ): Promise<{ releaseId: string; artistId: string; title: string }[]> {
    return this.db
      .select({
        releaseId: releases.id,
        artistId: releases.artistId,
        title: releases.title,
      })
      .from(releaseDesigns)
      .innerJoin(
        designVersions,
        eq(designVersions.id, releaseDesigns.designVersionId),
      )
      .innerJoin(releases, eq(releases.id, releaseDesigns.releaseId))
      .where(eq(designVersions.designId, designId));
  }

  /**
   * How many releases on sale render through each of some designs.
   *
   * @param designIds - The designs to count for.
   * @returns A count per design that has any.
   */
  public async countReleasesUsing(
    designIds: string[],
  ): Promise<Map<string, number>> {
    if (designIds.length === 0) return new Map();
    const rows = await this.db
      .select({ designId: designVersions.designId, count: count() })
      .from(releaseDesigns)
      .innerJoin(
        designVersions,
        eq(designVersions.id, releaseDesigns.designVersionId),
      )
      .innerJoin(releases, eq(releases.id, releaseDesigns.releaseId))
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(
        and(
          inArray(designVersions.designId, designIds),
          eq(releases.status, 'published'),
          isNull(artists.suspendedAt),
          isNull(artists.offSaleAt),
        ),
      )
      .groupBy(designVersions.designId);
    return new Map(rows.map((row) => [row.designId, row.count]));
  }

  /**
   * Record someone asking a designer for a custom design.
   */
  public async addCommissionRequest(params: {
    designerUserId: string;
    requesterUserId: string;
    designId: string | null;
    message: string;
  }): Promise<void> {
    await this.db.insert(commissionRequests).values(params);
  }

  /**
   * How many commission requests someone has sent since a moment, to anyone
   * or to one designer.
   */
  public async countCommissionRequestsSince(
    requesterUserId: string,
    since: Date,
    designerUserId?: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(commissionRequests)
      .where(
        and(
          eq(commissionRequests.requesterUserId, requesterUserId),
          gte(commissionRequests.createdAt, since),
          designerUserId === undefined
            ? undefined
            : eq(commissionRequests.designerUserId, designerUserId),
        ),
      );
    return row?.count ?? 0;
  }

  /**
   * Return an artist's releases that use a design to the default layout, as
   * when the artist's license for it is refunded.
   *
   * @param designId - The id of the design.
   * @param artistId - The id of the artist.
   */
  public async clearDesignFromArtist(
    designId: string,
    artistId: string,
  ): Promise<void> {
    await this.db
      .delete(releaseDesigns)
      .where(
        and(
          inArray(
            releaseDesigns.releaseId,
            this.db
              .select({ id: releases.id })
              .from(releases)
              .where(eq(releases.artistId, artistId)),
          ),
          inArray(
            releaseDesigns.designVersionId,
            this.db
              .select({ id: designVersions.id })
              .from(designVersions)
              .where(eq(designVersions.designId, designId)),
          ),
        ),
      );
  }

  /**
   * List the paid licenses of a design that have not been refunded, as when
   * refunding everyone who bought a design that was taken down.
   *
   * @param designId - The id of the design.
   * @returns The license rows.
   */
  public async listPaidLicenses(designId: string): Promise<DesignLicense[]> {
    return this.db
      .select()
      .from(designLicenses)
      .where(
        and(
          eq(designLicenses.designId, designId),
          eq(designLicenses.source, 'purchase'),
          isNull(designLicenses.refundedAt),
        ),
      );
  }
}
