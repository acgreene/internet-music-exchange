import {
  type Currency,
  DatabaseRepository,
  type Design,
  type DesignSale,
  type DesignSlot,
  type DesignSurface,
  type DesignVersion,
  type DesignVersionUsage,
  type DesignVisibility,
  getPostgresErrorCode,
  PostgresErrorCode,
} from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  HttpStatus,
  isDesignStyleId,
  MAX_DESIGN_STYLES,
} from '@ime/models';
import { AccessService } from '../access/access-service';
import type { PricingInput } from '../releases/release-service';
import { SellingGateService } from '../selling';
import {
  CloudStorageService,
  UploadService,
  type UploadTarget,
} from '../storage';
import { DESIGN_BUNDLE_RULES } from '../storage/media-types';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const SLOT_LABEL_MAX_LENGTH = 60;
const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const MAX_SLOTS = 30;
/** Slot names are keys in a release's customization, so keep them plain. */
const SLOT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export interface CreateDesignInput {
  name: string;
  description?: string | null;
  /** Release pages are the only surface for now. */
  surface?: DesignSurface;
}

export interface DesignChanges {
  name?: string;
  description?: string | null;
  visibility?: DesignVisibility;
  /** Style ids from IME's list, most fitting first. */
  styles?: string[];
}

export interface DesignVersionInput {
  objectKey: string;
  /** The slots this version exposes for artists to fill in. */
  slots: DesignSlot[];
}

/**
 * One of a designer's designs with its versions and how widely each is used.
 */
export interface ManagedDesign {
  design: Design;
  versions: DesignVersion[];
  usage: DesignVersionUsage[];
}

/**
 * The designer's side of creative pages: building designs, uploading
 * versions, pricing, publishing, granting private designs, and seeing sales.
 *
 * A version is one self-contained HTML file that never changes once
 * uploaded, so a release always renders exactly what its managers chose.
 */
export class DesignService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
    private readonly gate: SellingGateService = new SellingGateService(db),
    private readonly uploads: UploadService = new UploadService(storage),
  ) {}

  /**
   * Start a draft design. It is free and public until changed.
   *
   * @throws ApiError 400 for an invalid name or description.
   */
  public async create(
    userId: string,
    input: CreateDesignInput,
  ): Promise<Design> {
    if (!(await this.db.users.getById(userId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    }
    return this.db.designs.create({
      designerUserId: userId,
      name: this.validName(input.name),
      surface: input.surface ?? 'release',
      description: this.validDescription(input.description),
    });
  }

  /**
   * Every design a designer has made, newest first.
   */
  public listMine(userId: string): Promise<Design[]> {
    return this.db.designs.listByDesigner(userId);
  }

  /**
   * One of a designer's designs, with its versions and their usage.
   */
  public async getMine(
    userId: string,
    designId: string,
  ): Promise<ManagedDesign> {
    const design = await this.access.requireDesigner(userId, designId);
    const [versions, usage] = await Promise.all([
      this.db.designs.listVersions(designId),
      this.db.designs.listVersionUsage(designId),
    ]);
    return { design, versions, usage };
  }

  /**
   * Change a design's name, description, or visibility. Making it private
   * hides it from the marketplace; artists already licensed keep it.
   *
   * @throws ApiError 400 for an invalid name or description.
   */
  public async update(
    userId: string,
    designId: string,
    changes: DesignChanges,
  ): Promise<Design> {
    await this.access.requireDesigner(userId, designId);
    await this.db.designs.updateById(designId, {
      name:
        changes.name === undefined ? undefined : this.validName(changes.name),
      description:
        changes.description === undefined
          ? undefined
          : this.validDescription(changes.description),
      visibility: changes.visibility,
      styles:
        changes.styles === undefined
          ? undefined
          : this.validStyles(changes.styles),
    });
    return (await this.db.designs.getById(designId)) as Design;
  }

  /**
   * Price a design like a release. Paid prices are in the designer's selling
   * currency, so the designer needs a payment account first.
   *
   * @throws ApiError 400 for an invalid price, 409 when a paid price is set
   * before the designer has a payment account.
   */
  public async setPricing(
    userId: string,
    designId: string,
    input: PricingInput,
  ): Promise<Design> {
    await this.access.requireDesigner(userId, designId);

    let currency: Currency | null = null;
    if (input.mode !== 'free') {
      const account = await this.db.payments.getAccountByDesignerUserId(userId);
      if (!account?.defaultCurrency) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Connect a payment account before setting a paid price.',
        );
      }
      currency = account.defaultCurrency;
    }

    try {
      await this.db.designs.updateById(designId, {
        pricingMode: input.mode,
        currency,
        minimumPrice: input.minimumPrice ?? 0,
        suggestedPrice: input.suggestedPrice ?? null,
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.CheckViolation) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          'A fixed price must be above zero, a free design has no price, and a suggestion cannot be below the minimum.',
        );
      }
      throw error;
    }
    return (await this.db.designs.getById(designId)) as Design;
  }

  /**
   * Get somewhere to upload a new version's HTML file.
   *
   * @throws ApiError 400 for anything but HTML, 409 while the design is off
   * sale or taken down.
   */
  public async createVersionUpload(
    userId: string,
    designId: string,
    contentType: string,
  ): Promise<UploadTarget> {
    const design = await this.access.requireDesigner(userId, designId);
    await this.access.requireActiveUser(userId);
    if (design.status === 'taken_down' || design.offSaleAt) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        design.offSaleAt
          ? 'Uploads are paused until your hosting balance is topped up.'
          : 'This design was taken down.',
      );
    }
    return this.uploads.createTarget(
      this.versionPrefix(designId),
      'bundle',
      contentType,
      DESIGN_BUNDLE_RULES,
    );
  }

  /**
   * Record an uploaded version, numbered after the last one. Releases stay on
   * the version they use until their managers switch.
   *
   * @throws ApiError 400 when nothing valid was uploaded to that key, or the
   * slots are invalid.
   */
  public async confirmVersionUpload(
    userId: string,
    designId: string,
    input: DesignVersionInput,
  ): Promise<DesignVersion> {
    await this.access.requireDesigner(userId, designId);
    const slots = this.validSlots(input.slots);
    const stored = await this.uploads.confirm(
      input.objectKey,
      this.versionPrefix(designId),
      DESIGN_BUNDLE_RULES,
    );

    return this.db.designs.addVersion({
      designId,
      bucket: this.storage.bucket,
      objectKey: input.objectKey,
      byteSize: stored.byteSize,
      slots,
    });
  }

  /**
   * Make a design available: on the marketplace if public, to granted
   * artists if private. It needs a version, the designer's hosting paid for,
   * and for a paid design, a payment account that can take charges.
   *
   * @throws ApiError 403 when the user is suspended or the design was taken
   * down, 409 naming what is still missing.
   */
  public async publish(userId: string, designId: string): Promise<Design> {
    await this.access.requireActiveUser(userId);
    const design = await this.access.requireDesigner(userId, designId);
    if (design.status === 'published') return design;
    if (design.status === 'taken_down') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'This design was taken down and cannot be published.',
      );
    }

    const missing: string[] = [];
    if (!(await this.db.designs.getLatestVersion(designId))) {
      missing.push('upload a version');
    }
    missing.push(
      ...(await this.gate.missingToSell(
        { designerUserId: userId },
        design.pricingMode === 'free' ? null : design.currency,
      )),
    );
    if (missing.length > 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `Before publishing: ${missing.join('; ')}.`,
      );
    }

    await this.db.designs.publish(designId);
    return (await this.db.designs.getById(designId)) as Design;
  }

  /**
   * Withdraw a design from the marketplace. Artists already licensed and the
   * releases using it keep it.
   *
   * @throws ApiError 409 when the design is not published.
   */
  public async archive(userId: string, designId: string): Promise<Design> {
    const design = await this.access.requireDesigner(userId, designId);
    if (design.status !== 'published') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a published design can be archived.',
      );
    }
    await this.db.designs.archive(designId);
    return (await this.db.designs.getById(designId)) as Design;
  }

  /**
   * Delete a design nobody holds a license for or uses, with its versions'
   * files.
   *
   * @throws ApiError 409 once it is licensed or in use; archive it instead.
   */
  public async delete(userId: string, designId: string): Promise<void> {
    await this.access.requireDesigner(userId, designId);
    const versions = await this.db.designs.listVersions(designId);

    try {
      await this.db.designs.deleteById(designId);
    } catch (error) {
      if (
        getPostgresErrorCode(error) === PostgresErrorCode.ForeignKeyViolation
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'Artists hold licenses for this design or use it, so it can only be archived.',
        );
      }
      throw error;
    }

    for (const version of versions) {
      await this.storage.deleteObject(version.objectKey);
    }
  }

  /**
   * Grant an artist a license, as when delivering a private design
   * commissioned outside IME. A license is permanent.
   *
   * @throws ApiError 404 when no artist has that handle, 409 when the design
   * is not published.
   */
  public async grant(
    userId: string,
    designId: string,
    artistHandle: string,
  ): Promise<void> {
    await this.access.requireActiveUser(userId);
    const design = await this.access.requireDesigner(userId, designId);
    if (design.status !== 'published') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Publish the design before granting it.',
      );
    }
    const artist = await this.db.artists.getByHandle(artistHandle);
    if (!artist) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'No artist has that handle.',
      );
    }
    await this.db.designs.grantLicense({
      designId,
      artistId: artist.id,
      source: 'grant',
    });
  }

  /**
   * A designer's paid sales across all their designs, newest first.
   */
  public listSales(userId: string): Promise<DesignSale[]> {
    return this.db.designs.listSalesByDesigner(userId);
  }

  private validSlots(slots: DesignSlot[]): DesignSlot[] {
    const names = new Set<string>();
    if (slots.length > MAX_SLOTS) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `A design has at most ${MAX_SLOTS} slots.`,
      );
    }
    for (const slot of slots) {
      const label = slot.label?.trim();
      if (
        !SLOT_NAME_PATTERN.test(slot.name) ||
        names.has(slot.name) ||
        !['text', 'image', 'color'].includes(slot.kind) ||
        (slot.default !== undefined &&
          (slot.kind !== 'color' || !isHexColor(slot.default))) ||
        !label ||
        label.length > SLOT_LABEL_MAX_LENGTH
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          `Each slot needs a unique name of lowercase letters, digits, and underscores, a kind of text, image, or color, and a label up to ${SLOT_LABEL_MAX_LENGTH} characters.`,
        );
      }
      names.add(slot.name);
    }
    return slots.map((slot) => ({
      name: slot.name,
      kind: slot.kind,
      label: slot.label.trim(),
      ...(slot.default ? { default: slot.default.toLowerCase() } : {}),
    }));
  }

  private validName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > NAME_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Design names are 1 to ${NAME_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private validStyles(styles: string[]): string[] {
    const unique = [...new Set(styles)];
    if (unique.length > MAX_DESIGN_STYLES) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Pick up to ${MAX_DESIGN_STYLES} styles.`,
      );
    }
    const unknown = unique.find((style) => !isDesignStyleId(style));
    if (unknown) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `"${unknown}" is not on IME's list of styles.`,
      );
    }
    return unique;
  }

  private validDescription(description?: string | null): string | null {
    const trimmed = description?.trim() || null;
    if (trimmed && trimmed.length > DESCRIPTION_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Descriptions are up to ${DESCRIPTION_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private versionPrefix(designId: string): string {
    return `designs/${designId}/versions/`;
  }
}
