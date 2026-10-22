import {
  DatabaseRepository,
  type DesignSlot,
  type ReleaseDesignDetails,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';
import {
  CloudStorageService,
  UploadService,
  type UploadTarget,
} from '../storage';
import { DESIGN_SLOT_IMAGE_RULES } from '../storage/media-types';

const TEXT_SLOT_MAX_LENGTH = 2000;
const IMAGE_URL_EXPIRY_SECONDS = 3600;

/**
 * A slot image a manager uploaded, with a link to see it.
 */
export interface SlotImage {
  id: string;
  url: string;
}

/**
 * A release's design as its managers edit it.
 */
export interface ManagedReleaseDesign {
  /** The design and version it renders with, or null for the default layout. */
  applied: ReleaseDesignDetails | null;
  /** The design's newest version, when it is newer than the applied one. */
  newerVersion: number | null;
  images: SlotImage[];
}

/**
 * Dressing a release in a design, for the artist's managers: applying a
 * licensed design, filling in its slots with text and uploaded images,
 * moving to a newer version, and going back to the default layout.
 *
 * A release keeps its slot values across designs and versions: a value stays
 * wherever the new version has a slot of the same name and kind.
 */
export class ReleaseDesignService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
    private readonly uploads: UploadService = new UploadService(storage),
  ) {}

  /**
   * A release's design, whether a newer version is out, and its slot images.
   */
  public async getForRelease(
    userId: string,
    releaseId: string,
  ): Promise<ManagedReleaseDesign> {
    await this.access.requireReleaseManager(userId, releaseId);
    const [applied, images] = await Promise.all([
      this.db.designs.getReleaseDesign(releaseId),
      this.db.designs.listReleaseDesignImages(releaseId),
    ]);
    const latest =
      applied && (await this.db.designs.getLatestVersion(applied.designId));

    return {
      applied,
      newerVersion:
        latest && applied && latest.version > applied.version
          ? latest.version
          : null,
      images: await Promise.all(
        images.map(async (image) => ({
          id: image.id,
          url: await this.storage.getObjectSignedUrl(
            image.objectKey,
            IMAGE_URL_EXPIRY_SECONDS,
          ),
        })),
      ),
    };
  }

  /**
   * Apply one of the artist's licensed designs, at its latest version,
   * replacing whichever design the release used.
   *
   * @throws ApiError 403 without a license, 409 when the design is not for
   * release pages, was taken down, or has no version.
   */
  public async apply(
    userId: string,
    releaseId: string,
    designId: string,
  ): Promise<void> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    const design = await this.db.designs.getById(designId);
    if (!(await this.db.designs.hasLicense(designId, release.artistId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Get this design for the artist before applying it.',
      );
    }
    if (
      !design ||
      design.surface !== 'release' ||
      design.status === 'taken_down'
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This design cannot be applied to a release.',
      );
    }

    await this.applyLatest(releaseId, designId);
  }

  /**
   * Move a release to its design's newest version.
   *
   * @throws ApiError 409 when the release uses the default layout.
   */
  public async updateToLatest(
    userId: string,
    releaseId: string,
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    const applied = await this.requireApplied(releaseId);
    await this.applyLatest(releaseId, applied.designId);
  }

  /**
   * Set every slot value at once. Text slots take text; image slots take the
   * id of an image uploaded for this release.
   *
   * @throws ApiError 400 for a value the design has no slot for, overlong
   * text, or an image from somewhere else; 409 when the release uses the
   * default layout.
   */
  public async customize(
    userId: string,
    releaseId: string,
    values: Record<string, string>,
  ): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    const applied = await this.requireApplied(releaseId);
    const slots = new Map(applied.slots.map((slot) => [slot.name, slot]));
    const imageIds = new Set(
      (await this.db.designs.listReleaseDesignImages(releaseId)).map(
        (image) => image.id,
      ),
    );

    for (const [name, value] of Object.entries(values)) {
      const slot = slots.get(name);
      const valid =
        slot?.kind === 'text'
          ? value.length <= TEXT_SLOT_MAX_LENGTH
          : slot?.kind === 'image' && imageIds.has(value);
      if (!valid) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          slot
            ? slot.kind === 'text'
              ? `${slot.label} is up to ${TEXT_SLOT_MAX_LENGTH} characters.`
              : `${slot.label} must be an image uploaded for this release.`
            : `This design has no slot called ${name}.`,
        );
      }
    }

    await this.db.designs.updateReleaseCustomization(releaseId, values);
  }

  /**
   * Get somewhere to upload an image for one of the design's image slots.
   *
   * @throws ApiError 400 for a file type slot images cannot be.
   */
  public async createImageUpload(
    userId: string,
    releaseId: string,
    contentType: string,
  ): Promise<UploadTarget> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    await this.access.requireUploadsAllowed(release.artistId);
    return this.uploads.createTarget(
      this.imagePrefix(releaseId),
      'slot',
      contentType,
      DESIGN_SLOT_IMAGE_RULES,
    );
  }

  /**
   * Record an uploaded slot image. Its id is the value to put in an image
   * slot.
   *
   * @throws ApiError 400 when nothing valid was uploaded to that key.
   */
  public async confirmImageUpload(
    userId: string,
    releaseId: string,
    objectKey: string,
  ): Promise<SlotImage> {
    await this.access.requireReleaseManager(userId, releaseId);
    const stored = await this.uploads.confirm(
      objectKey,
      this.imagePrefix(releaseId),
      DESIGN_SLOT_IMAGE_RULES,
    );
    const image = await this.db.designs.addReleaseDesignImage({
      releaseId,
      bucket: this.storage.bucket,
      objectKey,
      mimeType: stored.contentType,
      byteSize: stored.byteSize,
    });

    return {
      id: image.id,
      url: await this.storage.getObjectSignedUrl(
        objectKey,
        IMAGE_URL_EXPIRY_SECONDS,
      ),
    };
  }

  /**
   * Delete a slot image and its file.
   *
   * @throws ApiError 404 when it does not exist, 409 while a slot shows it.
   */
  public async deleteImage(userId: string, imageId: string): Promise<void> {
    const image = await this.db.designs.getReleaseDesignImage(imageId);
    if (!image) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Image not found.',
      );
    }
    await this.access.requireReleaseManager(userId, image.releaseId);

    const applied = await this.db.designs.getReleaseDesign(image.releaseId);
    if (applied && Object.values(applied.customization).includes(imageId)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'A slot still shows this image. Change the slot first.',
      );
    }

    await this.db.designs.deleteReleaseDesignImage(imageId);
    await this.storage.deleteObject(image.objectKey);
  }

  /**
   * Return a release to the default layout. Its uploaded images are kept for
   * when a design is applied again.
   */
  public async remove(userId: string, releaseId: string): Promise<void> {
    await this.access.requireReleaseManager(userId, releaseId);
    await this.db.designs.clearReleaseDesign(releaseId);
  }

  /**
   * Point a release at a design's latest version, keeping each slot value the
   * new version still has a slot for.
   */
  private async applyLatest(
    releaseId: string,
    designId: string,
  ): Promise<void> {
    const [latest, current] = await Promise.all([
      this.db.designs.getLatestVersion(designId),
      this.db.designs.getReleaseDesign(releaseId),
    ]);
    if (!latest) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This design has no version to apply.',
      );
    }

    await this.db.designs.setReleaseDesign(
      releaseId,
      latest.id,
      this.carryOver(current, latest.slots),
    );
  }

  private carryOver(
    current: ReleaseDesignDetails | null,
    slots: DesignSlot[],
  ): Record<string, string> {
    if (!current) return {};
    const kinds = new Map(current.slots.map((slot) => [slot.name, slot.kind]));
    return Object.fromEntries(
      slots
        .filter(
          (slot) =>
            current.customization[slot.name] !== undefined &&
            kinds.get(slot.name) === slot.kind,
        )
        .map((slot) => [slot.name, current.customization[slot.name]]),
    );
  }

  private async requireApplied(
    releaseId: string,
  ): Promise<ReleaseDesignDetails> {
    const applied = await this.db.designs.getReleaseDesign(releaseId);
    if (!applied) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This release uses the default layout. Apply a design first.',
      );
    }
    return applied;
  }

  private imagePrefix(releaseId: string): string {
    return `releases/${releaseId}/design-images/`;
  }
}
