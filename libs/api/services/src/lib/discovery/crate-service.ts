import {
  type CrateItem as CrateItemRow,
  type CrateSummary,
  DatabaseRepository,
  type ShelfRelease,
} from '@ime/db';
import {
  ApiError,
  ApiErrorKind,
  type BuiltCrate,
  type CrateCard,
  type CrateItem,
  type CratePage,
  type CrateVisibility,
  genreName,
  HttpStatus,
  isGenreId,
  type MyCrate,
  normalizeTag,
  type RelatedCrates,
} from '@ime/models';
import { AccessService } from '../access/access-service';
import { CloudStorageService } from '../storage';
import { CatalogCards } from './catalog-cards';
import { dailyRank } from './daily-rank';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX_LENGTH = 80;
const NOTE_MAX_LENGTH = 500;
const LINE_MAX_LENGTH = 280;
const MAX_RECORDS = 200;
const MAX_CRATES = 100;
const MOSAIC_SIZE = 4;
const BUILT_SIZE = 24;
/** How many seeds a crate of the day starts from. */
const DAILY_SEEDS = 3;
/** A built crate holds at most this many records by one artist. */
const PER_ARTIST = 2;
/** How far the most saved crates go. */
const MOST_SAVED = 100;
/** How many crates a crate's page leads to in each list. */
const RELATED = 6;
/** The most genres a crate is said to be. */
const CRATE_GENRES = 3;

export interface CrateInput {
  name?: string;
  note?: string | null;
  visibility?: CrateVisibility;
}

/**
 * Crates: lists of releases people put together, like boxes of records at a
 * store, saving other people's, and following the people who make them. A
 * crate's genres are read from its records. Also the crates IME builds by
 * fixed rules: by sound, from records someone loves, and from their library
 * for the day. Never by AI.
 */
export class CrateService {
  private readonly cards: CatalogCards;

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    storage: CloudStorageService = new CloudStorageService(),
    private readonly access: AccessService = new AccessService(db),
  ) {
    this.cards = new CatalogCards(db, storage);
  }

  /**
   * Make a crate, optionally starting it with some releases.
   *
   * @throws ApiError 400 for a bad name or note, 403 when suspended, 409 at
   * the limit of crates.
   */
  public async create(
    userId: string,
    input: CrateInput & { releaseIds?: string[] },
  ): Promise<CrateCard> {
    await this.access.requireActiveUser(userId);
    const owned = await this.db.crates.listByOwner(userId);
    if (owned.length >= MAX_CRATES) {
      throw this.error(
        HttpStatus.Conflict,
        `You can keep up to ${MAX_CRATES} crates.`,
      );
    }
    const crate = await this.db.crates.create({
      ownerUserId: userId,
      name: this.validName(input.name ?? ''),
      note: this.validNote(input.note),
      visibility: input.visibility ?? 'private',
    });
    const onSale = await this.db.shelves.listOnSaleByIds(
      (input.releaseIds ?? []).slice(0, MAX_RECORDS),
    );
    const available = new Set(onSale.map((release) => release.id));
    for (const releaseId of input.releaseIds ?? []) {
      if (available.has(releaseId)) {
        await this.db.crates.addRelease(crate.id, releaseId, null);
      }
    }
    return this.card((await this.db.crates.getById(crate.id)) as CrateSummary);
  }

  /**
   * Rename a crate, change its note, or make it public or private.
   *
   * @throws ApiError 404 unless the user made it.
   */
  public async update(
    userId: string,
    crateId: string,
    input: CrateInput,
  ): Promise<CrateCard> {
    await this.requireOwn(userId, crateId);
    await this.db.crates.updateById(crateId, {
      name: input.name === undefined ? undefined : this.validName(input.name),
      note: input.note === undefined ? undefined : this.validNote(input.note),
      visibility: input.visibility,
    });
    return this.card((await this.db.crates.getById(crateId)) as CrateSummary);
  }

  public async delete(userId: string, crateId: string): Promise<void> {
    await this.requireOwn(userId, crateId);
    await this.db.crates.deleteById(crateId);
  }

  /**
   * Put a release at the end of a crate. Adding one already there changes
   * nothing.
   *
   * @throws ApiError 404 unless the user made the crate and the release is
   * on sale, 409 when the crate is full.
   */
  public async addRelease(
    userId: string,
    crateId: string,
    releaseId: string,
    note?: string | null,
  ): Promise<void> {
    const crate = await this.requireOwn(userId, crateId);
    if (crate.itemCount >= MAX_RECORDS) {
      throw this.error(
        HttpStatus.Conflict,
        `A crate holds up to ${MAX_RECORDS} records.`,
      );
    }
    const [release] = await this.db.shelves.listOnSaleByIds([releaseId]);
    if (!release) throw this.error(HttpStatus.NotFound, 'Release not found.');
    await this.db.crates.addRelease(crateId, releaseId, this.validLine(note));
  }

  public async setReleaseNote(
    userId: string,
    crateId: string,
    releaseId: string,
    note: string | null,
  ): Promise<void> {
    await this.requireOwn(userId, crateId);
    await this.db.crates.setReleaseNote(
      crateId,
      releaseId,
      this.validLine(note),
    );
  }

  public async removeRelease(
    userId: string,
    crateId: string,
    releaseId: string,
  ): Promise<void> {
    await this.requireOwn(userId, crateId);
    const items = await this.db.crates.listItems(crateId);
    await this.db.crates.reorder(
      crateId,
      items.map((item) => item.id).filter((id) => id !== releaseId),
    );
  }

  /**
   * Put a crate's releases in a new order. Releases left out keep their
   * place at the end.
   */
  public async reorder(
    userId: string,
    crateId: string,
    releaseIds: string[],
  ): Promise<void> {
    await this.requireOwn(userId, crateId);
    const current = (await this.db.crates.listItems(crateId)).map((i) => i.id);
    const chosen = releaseIds.filter((id) => current.includes(id));
    await this.db.crates.reorder(crateId, [
      ...new Set([...chosen, ...current]),
    ]);
  }

  /**
   * A crate's page. Its maker sees it whole; others see a public crate's
   * releases that are still on sale.
   *
   * @throws ApiError 404 unless it is public or the viewer's own.
   */
  public async get(crateId: string, viewerId?: string): Promise<CratePage> {
    const crate = UUID.test(crateId)
      ? await this.db.crates.getById(crateId)
      : null;
    const mine = !!crate && crate.ownerUserId === viewerId;
    const owner = crate && (await this.db.users.getById(crate.ownerUserId));
    if (
      !crate ||
      !owner ||
      (!mine && (crate.visibility !== 'public' || owner.suspendedAt))
    ) {
      throw this.error(HttpStatus.NotFound, 'Crate not found.');
    }

    const [rows, artists, designs, followers, following, saved, genres] =
      await Promise.all([
        this.db.crates.listItems(crateId),
        this.db.artists.listManagedArtists(owner.id),
        this.db.designs.listByDesigner(owner.id),
        this.db.crates.countUserFollowers(owner.id),
        viewerId && !mine
          ? this.db.crates.isFollowingUser(viewerId, owner.id)
          : false,
        viewerId && !mine ? this.db.crates.isSaved(viewerId, crateId) : false,
        this.genresOf([crate]),
      ]);
    return {
      crate: await this.card(crate),
      maker: {
        id: owner.id,
        username: owner.username,
        name: owner.name,
        artists: artists
          .filter((artist) => !artist.suspendedAt)
          .map(({ name, handle }) => ({ name, handle })),
        designer: designs.some((design) => design.status === 'published'),
        followers,
      },
      items: await this.items(
        mine ? rows : rows.filter((row) => row.available),
      ),
      isMine: mine,
      followingMaker: following,
      saved,
      genres: genres.get(crate.id) ?? [],
    };
  }

  /**
   * Save someone's public crate. Saving it again changes nothing.
   *
   * @throws ApiError 400 for one's own crate, 403 for someone suspended,
   * 404 for no such public crate.
   */
  public async save(userId: string, crateId: string): Promise<void> {
    await this.access.requireActiveUser(userId);
    const crate = await this.requirePublic(crateId);
    if (crate.ownerUserId === userId) {
      throw this.error(HttpStatus.BadRequest, 'This crate is already yours.');
    }
    await this.db.crates.save(userId, crateId);
  }

  public async unsave(userId: string, crateId: string): Promise<void> {
    if (UUID.test(crateId)) await this.db.crates.unsave(userId, crateId);
  }

  /** Public crates, the most saved first, as far as the hundredth. */
  public async listMostSaved(limit = 24, offset = 0): Promise<CrateCard[]> {
    const end = Math.min(offset + limit, MOST_SAVED);
    if (end <= offset) return [];
    return this.cardsFor(
      await this.db.crates.listMostSaved(end - offset, offset),
    );
  }

  /**
   * Public crates in a genre, the most saved first.
   *
   * @throws ApiError 400 for a genre not on IME's list.
   */
  public async listInGenre(
    genre: string,
    limit?: number,
    offset?: number,
  ): Promise<CrateCard[]> {
    if (!isGenreId(genre)) {
      throw this.error(HttpStatus.BadRequest, 'Pick a genre from the list.');
    }
    return this.cardsFor(
      await this.db.crates.listPublicInGenre(genre, limit, offset),
    );
  }

  /**
   * Where a crate leads: more public crates by its maker, and public crates
   * holding its records.
   *
   * @throws ApiError 404 for no such public crate.
   */
  public async related(crateId: string): Promise<RelatedCrates> {
    const crate = await this.requirePublic(crateId);
    const [byMaker, items] = await Promise.all([
      this.db.crates.listByOwner(crate.ownerUserId, 'public'),
      this.db.crates.listItems(crateId),
    ]);
    const withRecords = await this.db.crates.listPublicHoldingAny(
      items.filter((item) => item.available).map((item) => item.id),
      crateId,
      RELATED,
    );
    return {
      byMaker: await this.cardsFor(
        byMaker
          .filter((other) => other.id !== crateId && other.itemCount > 0)
          .slice(0, RELATED),
      ),
      withRecords: await this.cardsFor(
        withRecords.filter((other) => other.ownerUserId !== crate.ownerUserId),
      ),
    };
  }

  /**
   * The user's own crates, and which already hold a release, for adding it.
   */
  public async listMine(
    userId: string,
    releaseId?: string,
  ): Promise<MyCrate[]> {
    const [crates, holding] = await Promise.all([
      this.db.crates.listByOwner(userId),
      releaseId
        ? this.db.crates.listOwnerCratesHolding(userId, releaseId)
        : ([] as string[]),
    ]);
    const cards = await this.cardsFor(crates);
    return cards.map((card) => ({
      ...card,
      holdsRelease: holding.includes(card.id),
    }));
  }

  /** Public crates, the most recently changed first. */
  public async listPublic(
    limit?: number,
    offset?: number,
  ): Promise<CrateCard[]> {
    return this.cardsFor(await this.db.crates.listPublic(limit, offset));
  }

  /** Public crates holding a release. */
  public async listHolding(
    releaseId: string,
    limit?: number,
  ): Promise<CrateCard[]> {
    return this.cardsFor(
      await this.db.crates.listPublicHolding(releaseId, limit),
    );
  }

  /** Someone's public crates, by username. */
  public async listByUsername(username: string): Promise<CrateCard[]> {
    const user = await this.db.users.getByUsername(username);
    if (!user || user.suspendedAt) return [];
    const crates = await this.db.crates.listByOwner(user.id, 'public');
    return this.cardsFor(crates.filter((crate) => crate.itemCount > 0));
  }

  /** New public crates by the people a listener follows. */
  public async listFromFollowed(userId: string): Promise<CrateCard[]> {
    return this.cardsFor(await this.db.crates.listPublicFromFollowed(userId));
  }

  /** Public crates by name, for search. */
  public async search(text: string, limit: number): Promise<CrateCard[]> {
    return this.cardsFor(await this.db.crates.searchPublic(text, limit));
  }

  /**
   * Follow someone whose crates you like. Following them again changes
   * nothing.
   *
   * @throws ApiError 400 for following yourself, 404 for no such person.
   */
  public async followMaker(userId: string, makerId: string): Promise<void> {
    if (userId === makerId) {
      throw this.error(HttpStatus.BadRequest, 'You cannot follow yourself.');
    }
    const maker = UUID.test(makerId)
      ? await this.db.users.getById(makerId)
      : null;
    if (!maker || maker.suspendedAt) {
      throw this.error(HttpStatus.NotFound, 'Person not found.');
    }
    await this.db.crates.followUser(userId, makerId);
  }

  public async unfollowMaker(userId: string, makerId: string): Promise<void> {
    await this.db.crates.unfollowUser(userId, makerId);
  }

  /**
   * A crate of one genre or one tag, the most kept first.
   *
   * @throws ApiError 400 unless given a genre on IME's list or a tag.
   */
  public async bySound(genre?: string, tag?: string): Promise<BuiltCrate> {
    const cleanTag = tag ? normalizeTag(tag) : null;
    if (!(genre && isGenreId(genre)) && !cleanTag) {
      throw this.error(HttpStatus.BadRequest, 'Choose a genre or a tag.');
    }
    const rows = await this.db.search.searchReleases(
      {
        words: [],
        genres: genre && isGenreId(genre) ? [genre] : [],
        tags: cleanTag && !genre ? [cleanTag] : undefined,
      },
      'most-kept',
      BUILT_SIZE * 2,
      0,
    );
    const name = genre && isGenreId(genre) ? genreName(genre) : `“${cleanTag}”`;
    return {
      name,
      reason: `Releases ${genre ? 'in' : 'tagged'} ${name}, the most kept first, at most ${PER_ARTIST} per artist.`,
      items: await this.items(spread(rows).slice(0, BUILT_SIZE)),
    };
  }

  /**
   * A crate built from a few records someone loves: what the people who
   * kept them also kept, the public crates they sit in, and releases that
   * share their genres and tags. Leaves out the seeds themselves.
   */
  public async fromRecords(
    releaseIds: string[],
    exclude: Set<string> = new Set(),
  ): Promise<BuiltCrate> {
    const seeds = await this.db.shelves.listOnSaleByIds(releaseIds);
    if (seeds.length === 0) {
      throw this.error(
        HttpStatus.BadRequest,
        'Pick records on IME to start from.',
      );
    }
    const seedIds = seeds.map((seed) => seed.id);
    const seedSounds = await this.db.releases.listSounds(seedIds);
    const genres = [...new Set(seedSounds.flatMap((s) => s.genres))];
    const tags = [...new Set(seedSounds.flatMap((s) => s.tags))];

    const [kept, crated, alike] = await Promise.all([
      this.db.crates.scoreKeptAlongside(seedIds, 100),
      this.db.crates.scoreCratedAlongside(seedIds, 100),
      this.db.shelves.listSoundAlike(genres, tags, 200),
    ]);

    // fixed weights: shared keepers count most, then shared crates, then sound
    const scores = new Map<string, number>();
    const add = (id: string, points: number) =>
      scores.set(id, (scores.get(id) ?? 0) + points);
    kept.forEach((row) => add(row.releaseId, row.score * 3));
    crated.forEach((row) => add(row.releaseId, row.score * 2));
    for (const release of alike) {
      const shared =
        release.genres.filter((g) => genres.includes(g)).length +
        release.tags.filter((t) => tags.includes(t)).length;
      add(release.id, shared);
    }
    for (const id of [...seedIds, ...exclude]) scores.delete(id);

    const ranked = [...scores]
      .sort((a, b) => b[1] - a[1])
      .slice(0, BUILT_SIZE * 3)
      .map(([id]) => id);
    const rows = await this.db.shelves.listOnSaleByIds(ranked);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = ranked.flatMap((id) => byId.get(id) ?? []);

    return {
      name:
        seeds.length === 1
          ? `Built from ${seeds[0].title}`
          : `Built from ${seeds.length} records`,
      reason: `From ${titles(seeds)}: what their keepers also kept, the crates they sit in, and their sound.`,
      items: await this.items(spread(ordered).slice(0, BUILT_SIZE)),
    };
  }

  /**
   * Today's crate from a listener's library: a few of their records picked
   * by the date, built on like records they love, leaving out what they
   * already own. Null until they own something.
   */
  public async ofTheDay(
    userId: string,
    now: Date = new Date(),
  ): Promise<BuiltCrate | null> {
    const library = await this.db.entitlements.listLibrary(userId, 500);
    if (library.length === 0) return null;
    const day = now.toISOString().slice(0, 10);
    const seeds = [...library]
      .sort((a, b) => dailyRank(day, a.releaseId) - dailyRank(day, b.releaseId))
      .slice(0, DAILY_SEEDS);
    const built = await this.fromRecords(
      seeds.map((seed) => seed.releaseId),
      new Set(library.map((item) => item.releaseId)),
    );
    return {
      ...built,
      name: 'Crate of the day',
      reason: `Built from ${titles(seeds)} in your library. A new one tomorrow.`,
    };
  }

  private async requireOwn(
    userId: string,
    crateId: string,
  ): Promise<CrateSummary> {
    const crate = UUID.test(crateId)
      ? await this.db.crates.getById(crateId)
      : null;
    if (!crate || crate.ownerUserId !== userId) {
      throw this.error(HttpStatus.NotFound, 'Crate not found.');
    }
    await this.access.requireActiveUser(userId);
    return crate;
  }

  private async items(
    rows: (ShelfRelease | CrateItemRow)[],
  ): Promise<CrateItem[]> {
    const cards = await this.cards.releases(rows);
    return cards.map((card, i) => {
      const row = rows[i];
      return {
        release: card.release,
        pricing: card.pricing,
        note: 'note' in row ? row.note : null,
        available: 'available' in row ? row.available : true,
      };
    });
  }

  /** A public crate from a maker in good standing. */
  private async requirePublic(crateId: string): Promise<CrateSummary> {
    const crate = UUID.test(crateId)
      ? await this.db.crates.getById(crateId)
      : null;
    const owner = crate && (await this.db.users.getById(crate.ownerUserId));
    if (
      !crate ||
      crate.visibility !== 'public' ||
      !owner ||
      owner.suspendedAt
    ) {
      throw this.error(HttpStatus.NotFound, 'Crate not found.');
    }
    return crate;
  }

  /** Each crate's genres: those a third or more of its records carry. */
  private async genresOf(
    crates: CrateSummary[],
  ): Promise<Map<string, string[]>> {
    const counts = await this.db.crates.countGenres(crates.map((c) => c.id));
    const sizes = new Map(crates.map((crate) => [crate.id, crate.itemCount]));
    const genres = new Map<string, string[]>();
    for (const { crateId, genre, count } of [...counts].sort(
      (a, b) => b.count - a.count,
    )) {
      const list = genres.get(crateId) ?? [];
      if (
        count * 3 >= (sizes.get(crateId) ?? 0) &&
        list.length < CRATE_GENRES
      ) {
        genres.set(crateId, [...list, genre]);
      }
    }
    return genres;
  }

  private async card(crate: CrateSummary): Promise<CrateCard> {
    return (await this.cardsFor([crate]))[0];
  }

  private async cardsFor(crates: CrateSummary[]): Promise<CrateCard[]> {
    const firsts = await this.db.crates.listFirstReleaseIds(
      crates.map((crate) => crate.id),
      MOSAIC_SIZE,
    );
    const covers = await this.cards.coverUrls([
      ...new Set(firsts.map((row) => row.releaseId)),
    ]);
    return crates.map((crate) => ({
      id: crate.id,
      name: crate.name,
      note: crate.note,
      visibility: crate.visibility,
      makerUsername: crate.ownerUsername,
      itemCount: crate.itemCount,
      saves: crate.saves,
      coverUrls: firsts
        .filter((row) => row.crateId === crate.id)
        .flatMap((row) => covers.get(row.releaseId) ?? []),
      updatedAt: crate.updatedAt,
    }));
  }

  private validName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > NAME_MAX_LENGTH) {
      throw this.error(
        HttpStatus.BadRequest,
        `Give the crate a name of up to ${NAME_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private validNote(note: string | null | undefined): string | null {
    const trimmed = note?.trim() || null;
    if (trimmed && trimmed.length > NOTE_MAX_LENGTH) {
      throw this.error(
        HttpStatus.BadRequest,
        `Notes are at most ${NOTE_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private validLine(line: string | null | undefined): string | null {
    const trimmed = line?.trim() || null;
    if (trimmed && trimmed.length > LINE_MAX_LENGTH) {
      throw this.error(
        HttpStatus.BadRequest,
        `Say why in up to ${LINE_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private error(status: HttpStatus, message: string): ApiError {
    return new ApiError(ApiErrorKind.Http, status, message);
  }
}

/** Keep a built crate varied: at most a couple of records per artist. */
function spread<T extends { artistId: string }>(rows: T[]): T[] {
  const perArtist = new Map<string, number>();
  return rows.filter((row) => {
    const seen = perArtist.get(row.artistId) ?? 0;
    perArtist.set(row.artistId, seen + 1);
    return seen < PER_ARTIST;
  });
}

function titles(records: { title: string }[]): string {
  const names = records.map((record) => record.title);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
