import { randomUUID } from 'node:crypto';
import {
  type Artist,
  type ArtistImageKind,
  type ArtistLink,
  DatabaseRepository,
  getPostgresErrorCode,
  PostgresErrorCode,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';
import {
  firstAvailable,
  HANDLE_MAX_LENGTH,
  isValidHandle,
  toHandle,
} from '../naming/naming-utils';
import { CloudStorageService } from '../storage';
import { FILE_EXTENSIONS, IMAGE_TYPES } from '../storage/media-types';

const NAME_MAX_LENGTH = 100;
const BIO_MAX_LENGTH = 2000;
const LINK_LIMIT = 10;
const LINK_LABEL_MAX_LENGTH = 50;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_URL_EXPIRY_SECONDS = 3600;

export interface CreateArtistInput {
  name: string;
  /** Generated from the name when left out. */
  handle?: string;
  bio?: string | null;
}

export interface UpdateArtistInput {
  name?: string;
  handle?: string;
  bio?: string | null;
}

export interface LinkInput {
  label: string;
  url: string;
}

export interface ImageUpload {
  body: Uint8Array;
  contentType: string;
}

/**
 * An artist's public profile, as `/artists/<handle>` shows it.
 */
export interface ArtistProfile {
  artist: Artist;
  avatarUrl: string | null;
  headerUrl: string | null;
  links: ArtistLink[];
  followerCount: number;
}

/**
 * Artists and the managers who run them: creating and editing profiles,
 * handles, images, links, and who may manage.
 */
export class ArtistService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
  ) {}

  /**
   * Create an artist, with its creator as the first manager. A handle is made
   * from the name when none is given.
   *
   * @throws ApiError 400 for invalid fields, 409 when a chosen handle is taken.
   */
  public async create(
    userId: string,
    input: CreateArtistInput,
  ): Promise<Artist> {
    const name = this.validName(input.name);
    const bio = this.validBio(input.bio);
    const handle =
      input.handle === undefined
        ? await this.generateHandle(name)
        : await this.availableHandle(input.handle);

    try {
      return await this.db.artists.create({
        name,
        handle,
        bio,
        createdByUserId: userId,
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.UniqueViolation)
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'That handle is taken.',
        );
      throw error;
    }
  }

  /**
   * Read an artist's public profile.
   *
   * @throws ApiError 404 when no visible artist has that handle.
   */
  public async getProfile(handle: string): Promise<ArtistProfile> {
    const artist = await this.db.artists.getByHandle(handle);
    if (!artist || artist.suspendedAt)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Artist not found.',
      );

    const [images, links, followerCount] = await Promise.all([
      this.db.artists.listImages(artist.id),
      this.db.artists.listLinks(artist.id),
      this.db.social.countFollowers(artist.id),
    ]);

    const urlFor = (kind: ArtistImageKind) => {
      const image = images.find((i) => i.kind === kind);
      return image
        ? this.storage.getObjectSignedUrl(
            image.objectKey,
            IMAGE_URL_EXPIRY_SECONDS,
          )
        : Promise.resolve(null);
    };

    return {
      artist,
      avatarUrl: await urlFor('avatar'),
      headerUrl: await urlFor('header'),
      links,
      followerCount,
    };
  }

  /**
   * List the artists a user manages, to switch between them.
   */
  public listManaged(userId: string): Promise<Artist[]> {
    return this.db.artists.listManagedArtists(userId);
  }

  /**
   * Edit an artist's name, handle, or bio.
   *
   * @throws ApiError 400 for invalid fields, 403 when the user does not manage
   * the artist, 409 when the handle is taken.
   */
  public async update(
    userId: string,
    artistId: string,
    input: UpdateArtistInput,
  ): Promise<Artist> {
    await this.access.requireManager(userId, artistId);

    const changes = {
      name: input.name === undefined ? undefined : this.validName(input.name),
      bio: input.bio === undefined ? undefined : this.validBio(input.bio),
      handle:
        input.handle === undefined
          ? undefined
          : await this.availableHandle(input.handle, artistId),
    };

    try {
      await this.db.artists.updateById(artistId, changes);
    } catch (error) {
      if (getPostgresErrorCode(error) === PostgresErrorCode.UniqueViolation)
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'That handle is taken.',
        );
      throw error;
    }

    return (await this.db.artists.getById(artistId)) as Artist;
  }

  /**
   * Report whether a handle is valid and free.
   */
  public async isHandleAvailable(
    handle: string,
    artistId?: string,
  ): Promise<boolean> {
    if (!isValidHandle(handle)) return false;
    return this.db.artists.isHandleAvailable(handle, artistId);
  }

  /**
   * Replace an artist's profile links.
   *
   * @throws ApiError 400 for too many links or an invalid one, 403 when the
   * user does not manage the artist.
   */
  public async setLinks(
    userId: string,
    artistId: string,
    links: LinkInput[],
  ): Promise<ArtistLink[]> {
    await this.access.requireManager(userId, artistId);

    if (links.length > LINK_LIMIT) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `An artist can have at most ${LINK_LIMIT} links.`,
      );
    }
    const cleaned = links.map((link) => this.validLink(link));

    await this.db.artists.replaceLinks(artistId, cleaned);
    return this.db.artists.listLinks(artistId);
  }

  /**
   * Upload an artist's avatar or header, replacing the old one.
   *
   * @returns A URL to the new image.
   * @throws ApiError 400 for an unsupported or oversized file, 403 when the
   * user does not manage the artist.
   */
  public async setImage(
    userId: string,
    artistId: string,
    kind: ArtistImageKind,
    upload: ImageUpload,
  ): Promise<string> {
    await this.access.requireManager(userId, artistId);

    if (!IMAGE_TYPES.includes(upload.contentType)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Images must be JPEG, PNG, or WebP.',
      );
    }
    if (upload.body.byteLength > IMAGE_MAX_BYTES) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Images must be 5 MB or smaller.',
      );
    }

    const objectKey = `artists/${artistId}/${kind}-${randomUUID()}.${FILE_EXTENSIONS[upload.contentType]}`;
    await this.storage.uploadObject(objectKey, upload.body, upload.contentType);

    const replaced = await this.db.artists.setImage({
      artistId,
      kind,
      bucket: this.storage.bucket,
      objectKey,
      mimeType: upload.contentType,
      byteSize: upload.body.byteLength,
    });
    if (replaced) await this.storage.deleteObject(replaced.objectKey);

    return this.storage.getObjectSignedUrl(objectKey, IMAGE_URL_EXPIRY_SECONDS);
  }

  /**
   * Remove an artist's avatar or header.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async removeImage(
    userId: string,
    artistId: string,
    kind: ArtistImageKind,
  ): Promise<void> {
    await this.access.requireManager(userId, artistId);

    const removed = await this.db.artists.removeImage(artistId, kind);
    if (removed) await this.storage.deleteObject(removed.objectKey);
  }

  /**
   * List an artist's managers, for its other managers.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async listManagers(userId: string, artistId: string) {
    await this.access.requireManager(userId, artistId);
    return this.db.artists.listManagers(artistId);
  }

  /**
   * Add a user, found by username, as a manager.
   *
   * @throws ApiError 403 when the user does not manage the artist, 404 when
   * nobody has that username.
   */
  public async addManager(
    userId: string,
    artistId: string,
    username: string,
  ): Promise<void> {
    await this.access.requireManager(userId, artistId);

    const newManager = await this.db.users.getByUsername(username);
    if (!newManager)
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'No user has that username.',
      );

    await this.db.artists.addManager(newManager.id, artistId);
  }

  /**
   * Remove a manager, or step down yourself.
   *
   * @throws ApiError 403 when the user does not manage the artist, 409 when the
   * manager is the last one or still pays part of the artist's costs.
   */
  public async removeManager(
    userId: string,
    artistId: string,
    managerUserId: string,
  ): Promise<void> {
    await this.access.requireManager(userId, artistId);

    // their part of the hosting costs would otherwise go unpaid
    const shares = await this.db.funding.listCostShares(artistId);
    if (shares.some((share) => share.userId === managerUserId)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        "This manager pays part of the artist's hosting costs. Change how the costs are split first.",
      );
    }

    if (!(await this.db.artists.removeManager(managerUserId, artistId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'An artist must keep at least one manager.',
      );
    }

    // a pending split offered to them can no longer be accepted
    const offers = await this.db.funding.listOffers(artistId);
    if (offers.some((offer) => offer.userId === managerUserId)) {
      await this.db.funding.withdrawOffers(artistId);
    }
  }

  private validName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Artist names are 1 to ${NAME_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private validBio(bio: string | null | undefined): string | null {
    const trimmed = bio?.trim() || null;
    if (trimmed && trimmed.length > BIO_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Bios are at most ${BIO_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private validLink(link: LinkInput): LinkInput {
    const label = link.label.trim();
    if (label.length === 0 || label.length > LINK_LABEL_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Link labels are 1 to ${LINK_LABEL_MAX_LENGTH} characters.`,
      );
    }

    const url = link.url.trim();
    if (!URL.canParse(url)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `"${url}" is not a valid link.`,
      );
    }
    if (new URL(url).protocol !== 'https:') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Links must start with https://.',
      );
    }

    return { label, url };
  }

  private async availableHandle(
    handle: string,
    artistId?: string,
  ): Promise<string> {
    if (!isValidHandle(handle)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Handles are 3 to 30 lowercase letters, numbers, hyphens, or underscores, starting and ending with a letter or number.',
      );
    }
    if (!(await this.db.artists.isHandleAvailable(handle, artistId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'That handle is taken.',
      );
    }
    return handle;
  }

  private generateHandle(name: string): Promise<string> {
    return firstAvailable(
      toHandle(name) || 'artist',
      HANDLE_MAX_LENGTH,
      (candidate) => this.db.artists.isHandleAvailable(candidate),
    );
  }
}
