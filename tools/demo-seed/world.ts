import type * as schema from '../../libs/api/db/src/lib/schema';
import type { StatementLine } from '../../libs/api/db/src/lib/tables/statements';
import {
  avatarArt,
  coverArt,
  headerArt,
  MERCH_COLORS,
  merchArt,
  slotArt,
} from './art';
import { bundleHtml, DESIGN_TEMPLATES, SLOT_TEXT } from './designs';
import { demoId, Random } from './random';
import { DEMO_PREFIX } from './storage';
import { type Scene, SCENES, slugify, words } from './words';

type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];

/** A demo user, before it becomes an auth account and a profile. */
export interface DemoUser {
  id: string;
  email: string;
  username: string;
  name: string | null;
  createdAt: Date;
}

/** A file to store: written from text, or copied from another object. */
export type DemoFile =
  | { key: string; body: string; contentType: string }
  | { key: string; copyOf: string };

export interface WorldOptions {
  /** The real user who gets a library, admin rights, and a demo artist. */
  owner: { id: string; name: string } | null;
  bucket: string;
  /** Size of each source clip in `demo/audio/`, by index. */
  clipSizes: number[];
  now: Date;
}

const LISTENERS = 3000;
const SELLERS = 180;
const DESIGNERS = 10;
const ARTISTS = 200;
const CLOSED_MONTHS = 6;

const DAY = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const bytes = (text: string) => Buffer.byteLength(text);
const later = (date: Date, maxDays: number, random: Random, now: Date) =>
  new Date(
    Math.min(now.getTime(), date.getTime() + random.next() * maxDays * DAY),
  );

/** The first day of the month `offset` months from `now`'s month. */
function monthStart(now: Date, offset: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
}

/**
 * The whole demo world, built the same way on every run from a fixed seed:
 * accounts, artists and their catalogs, merch, designs, what listeners
 * bought and said, the money side, and a moderation queue.
 */
export function buildWorld(options: WorldOptions) {
  const random = new Random(20261022);
  // their own sources, so adding sound and places leaves the rest as it was
  const sound = new Random(5010);
  const places = new Random(7311);

  /** A release's genres, tags, and sides, from its artist's scene. */
  const soundOf = (scene: Scene, kind: string, trackCount: number) => {
    const genres = sound.sample(scene.genres, sound.int(1, 3));
    const tags = sound.chance(0.2)
      ? []
      : sound.sample(scene.tags, sound.int(1, 4));
    const record = ['album', 'lp', 'compilation', 'soundtrack', 'remaster'];
    let sideStarts: number[] = [];
    if (record.includes(kind) && trackCount >= 6 && sound.chance(0.45)) {
      const sides = trackCount >= 12 && sound.chance(0.3) ? 4 : 2;
      sideStarts = Array.from(
        { length: sides - 1 },
        (_, i) => Math.round(((i + 1) * trackCount) / sides) + 1,
      );
    }
    return { genres, tags, sideStarts };
  };
  const { now, bucket, owner } = options;
  const files: DemoFile[] = [];
  const counters = new Map<string, number>();
  const next = (kind: Parameters<typeof demoId>[0]) => {
    const n = counters.get(kind) ?? 0;
    counters.set(kind, n + 1);
    return demoId(kind, n);
  };
  const svgFile = (key: string, body: string) => {
    files.push({ key, body, contentType: 'image/svg+xml' });
    return bytes(body);
  };

  const rows = {
    artists: [] as Row<typeof schema.artists>[],
    artistManagers: [] as Row<typeof schema.artistManagers>[],
    artistImages: [] as Row<typeof schema.artistImages>[],
    artistLinks: [] as Row<typeof schema.artistLinks>[],
    payoutAccounts: [] as Row<typeof schema.payoutAccounts>[],
    releases: [] as Row<typeof schema.releases>[],
    releasePricing: [] as Row<typeof schema.releasePricing>[],
    tracks: [] as Row<typeof schema.tracks>[],
    releaseTracks: [] as Row<typeof schema.releaseTracks>[],
    trackAudioFiles: [] as Row<typeof schema.trackAudioFiles>[],
    releaseAssets: [] as Row<typeof schema.releaseAssets>[],
    products: [] as Row<typeof schema.products>[],
    productVariants: [] as Row<typeof schema.productVariants>[],
    productImages: [] as Row<typeof schema.productImages>[],
    productShippingRates: [] as Row<typeof schema.productShippingRates>[],
    designs: [] as Row<typeof schema.designs>[],
    designVersions: [] as Row<typeof schema.designVersions>[],
    designLicenses: [] as Row<typeof schema.designLicenses>[],
    releaseDesignImages: [] as Row<typeof schema.releaseDesignImages>[],
    releaseDesigns: [] as Row<typeof schema.releaseDesigns>[],
    artistFollowers: [] as Row<typeof schema.artistFollowers>[],
    releaseComments: [] as Row<typeof schema.releaseComments>[],
    orders: [] as Row<typeof schema.orders>[],
    artistOrders: [] as Row<typeof schema.artistOrders>[],
    orderItems: [] as Row<typeof schema.orderItems>[],
    entitlements: [] as Row<typeof schema.entitlements>[],
    fulfillments: [] as Row<typeof schema.fulfillments>[],
    sellerBilling: [] as Row<typeof schema.sellerBilling>[],
    costShares: [] as Row<typeof schema.costShares>[],
    billingPeriods: [] as Row<typeof schema.billingPeriods>[],
    platformCosts: [] as Row<typeof schema.platformCosts>[],
    statements: [] as Row<typeof schema.statements>[],
    balanceEntries: [] as Row<typeof schema.balanceEntries>[],
    monthlyUsage: [] as Row<typeof schema.monthlyUsage>[],
    contributions: [] as Row<typeof schema.contributions>[],
    reserveEntries: [] as Row<typeof schema.reserveEntries>[],
    reports: [] as Row<typeof schema.reports>[],
    crates: [] as Row<typeof schema.crates>[],
    crateReleases: [] as Row<typeof schema.crateReleases>[],
    userFollowers: [] as Row<typeof schema.userFollowers>[],
    crateSaves: [] as Row<typeof schema.crateSaves>[],
    moderationActions: [] as Row<typeof schema.moderationActions>[],
    copyrightContests: [] as Row<typeof schema.copyrightContests>[],
  };

  // ---------------------------------------------------------------- people
  const usernames = new Set<string>();
  const uniqueName = (base: string) => {
    let name = slugify(base, 26);
    while (usernames.has(name))
      name = `${slugify(base, 22)}-${random.int(10, 9999)}`;
    usernames.add(name);
    return name;
  };
  const makeUser = (n: number, joinedAfter: Date): DemoUser => {
    const name = words.personName(random);
    const handleBase = random.weighted<() => string>([
      [() => name, 3],
      [() => `${name.split(' ')[0]}${random.int(1, 999)}`, 3],
      [() => `${random.pick(SCENES).label} ${name.split(' ')[1]}`, 1],
    ])();
    return {
      id: demoId('user', n),
      email: `demo-${n}@demo.ime.test`,
      username: uniqueName(handleBase),
      name: random.chance(0.8) ? name : null,
      createdAt: random.dateBetween(joinedAfter, now),
    };
  };
  const twoYearsAgo = new Date(now.getTime() - 900 * DAY);
  const listeners = Array.from({ length: LISTENERS }, (_, i) =>
    makeUser(i, twoYearsAgo),
  );
  const sellers = Array.from({ length: SELLERS }, (_, i) =>
    makeUser(LISTENERS + i, twoYearsAgo),
  );
  const designers = Array.from({ length: DESIGNERS }, (_, i) =>
    makeUser(LISTENERS + SELLERS + i, twoYearsAgo),
  );
  const users = [...listeners, ...sellers, ...designers];

  // --------------------------------------------------------------- artists
  const handles = new Set<string>();
  interface DemoArtist {
    id: string;
    name: string;
    handle: string;
    currency: 'usd' | 'eur';
    joinedAt: Date;
    managers: string[];
    releases: DemoRelease[];
    products: DemoProduct[];
    sells: boolean;
    scene: Scene;
  }
  interface DemoRelease {
    id: string;
    artist: DemoArtist;
    title: string;
    status: 'draft' | 'published' | 'archived' | 'taken_down';
    publishedAt: Date | null;
    mode: 'free' | 'fixed' | 'name_your_price';
    minimum: number;
    suggested: number | null;
    trackIds: string[];
    trackCount: number;
  }
  interface DemoProduct {
    id: string;
    artist: DemoArtist;
    published: boolean;
    releaseId: string | null;
    includesDigital: boolean;
    variants: { id: string; price: number }[];
    domestic: number;
    international: number | null;
    createdAt: Date;
  }

  const artists: DemoArtist[] = [];
  for (let i = 0; i < ARTISTS; i++) {
    const name = words.artistName(random);
    let handle = slugify(name);
    while (handles.has(handle))
      handle = `${slugify(name, 25)}-${random.int(2, 999)}`;
    handles.add(handle);
    const creator = i < SELLERS ? sellers[i] : random.pick(sellers);
    const managers = [creator.id];
    if (random.chance(0.15)) {
      const other = random.pick(sellers).id;
      if (other !== creator.id) managers.push(other);
    }
    const joinedAt = new Date(
      Math.max(creator.createdAt.getTime(), twoYearsAgo.getTime()),
    );
    artists.push({
      id: demoId('artist', i),
      name,
      handle,
      currency: random.chance(0.1) ? 'eur' : 'usd',
      joinedAt,
      managers,
      releases: [],
      products: [],
      sells: false,
      scene: sound.pick(SCENES),
    });
  }
  // the order listeners discover artists in: a few are very popular
  const popularity = random.sample(artists, artists.length);
  const suspendedArtist = popularity[popularity.length - 3];

  for (const artist of artists) {
    rows.artists.push({
      id: artist.id,
      name: artist.name,
      handle: artist.handle,
      bio: random.chance(0.85) ? words.bio(random, artist.scene) : null,
      ...(places.chance(0.9)
        ? words.place(places)
        : { city: null, country: null }),
      createdAt: artist.joinedAt,
      suspendedAt:
        artist === suspendedArtist ? new Date(now.getTime() - 9 * DAY) : null,
    });
    artist.managers.forEach((userId, index) => {
      rows.artistManagers.push({
        userId,
        artistId: artist.id,
        createdAt: artist.joinedAt,
      });
      rows.costShares.push({
        artistId: artist.id,
        userId,
        shareBasisPoints:
          artist.managers.length === 1 ? 10000 : index === 0 ? 6000 : 4000,
        createdAt: artist.joinedAt,
      });
    });
    if (random.chance(0.9)) {
      const key = `${DEMO_PREFIX}artists/${artist.id}/avatar.svg`;
      rows.artistImages.push({
        id: next('image'),
        artistId: artist.id,
        kind: 'avatar',
        bucket,
        objectKey: key,
        mimeType: 'image/svg+xml',
        byteSize: svgFile(key, avatarArt(random, artist.name)),
        createdAt: artist.joinedAt,
      });
    }
    if (random.chance(0.7)) {
      const key = `${DEMO_PREFIX}artists/${artist.id}/header.svg`;
      rows.artistImages.push({
        id: next('image'),
        artistId: artist.id,
        kind: 'header',
        bucket,
        objectKey: key,
        mimeType: 'image/svg+xml',
        byteSize: svgFile(key, headerArt(random)),
        createdAt: artist.joinedAt,
      });
    }
    const linkOptions = [
      ['Instagram', `https://instagram.com/${artist.handle}`],
      ['Website', `https://${artist.handle}.example.com`],
      ['YouTube', `https://youtube.com/@${artist.handle}`],
      ['Tour dates', `https://${artist.handle}.example.com/tour`],
    ] as const;
    random
      .sample(linkOptions, random.int(0, 3))
      .forEach(([label, url], position) =>
        rows.artistLinks.push({
          id: next('link'),
          artistId: artist.id,
          label,
          url,
          position,
        }),
      );
  }

  // -------------------------------------------------------------- releases
  const KINDS = [
    ['album', 30, 7, 12],
    ['ep', 25, 3, 6],
    ['single', 25, 1, 3],
    ['lp', 8, 7, 11],
    ['demo', 5, 3, 5],
    ['compilation', 3, 10, 14],
    ['soundtrack', 2, 8, 13],
    ['remaster', 2, 8, 12],
  ] as const;
  let clipIndex = 0;
  const releases: DemoRelease[] = [];

  for (const artist of artists) {
    const count = random.weighted([
      [0, 8],
      [1, 22],
      [2, 25],
      [3, 20],
      [4, 13],
      [5, 12],
    ] as const);
    const slugs = new Set<string>();
    for (let r = 0; r < count; r++) {
      const [kind, , minTracks, maxTracks] = random.weighted(
        KINDS.map((k) => [k, k[1]] as const),
      );
      let title = words.releaseTitle(random);
      let slug = slugify(title, 90);
      while (slugs.has(slug)) {
        title = words.releaseTitle(random);
        slug = slugify(title, 90);
      }
      slugs.add(slug);
      const createdAt = random.dateBetween(artist.joinedAt, now);
      const status = random.weighted([
        ['published', 92],
        ['draft', 4],
        ['archived', 4],
      ] as const);
      const publishedAt =
        status === 'draft' ? null : later(createdAt, 20, random, now);
      const mode = random.weighted([
        ['free', 18],
        ['name_your_price', 47],
        ['fixed', 35],
      ] as const);
      const small = kind === 'single' || kind === 'demo';
      const minimum =
        mode === 'free'
          ? 0
          : mode === 'fixed'
            ? small
              ? random.int(1, 3) * 100
              : random.int(5, 12) * 100
            : random.chance(0.6)
              ? 0
              : random.int(3, 7) * 100;
      const suggested =
        mode === 'name_your_price'
          ? Math.max(
              minimum,
              (small ? random.int(2, 4) : random.int(7, 12)) * 100,
            )
          : null;
      const trackCount = random.int(minTracks, maxTracks);
      const release: DemoRelease = {
        id: next('release'),
        artist,
        title,
        status,
        publishedAt,
        mode,
        minimum,
        suggested,
        trackIds: [],
        trackCount,
      };
      artist.releases.push(release);
      releases.push(release);
      if (mode !== 'free' && status === 'published') artist.sells = true;

      rows.releases.push({
        id: release.id,
        title,
        slug,
        artistId: artist.id,
        kind,
        status,
        releasedAt: iso(publishedAt ?? createdAt),
        createdAt,
        publishedAt,
        ...soundOf(artist.scene, kind, trackCount),
      });
      rows.releasePricing.push({
        releaseId: release.id,
        mode,
        currency: mode === 'free' ? null : artist.currency,
        minimumPrice: minimum,
        suggestedPrice: suggested,
        createdAt,
      });

      const coverKey = `${DEMO_PREFIX}releases/${release.id}/cover.svg`;
      rows.releaseAssets.push({
        id: next('asset'),
        releaseId: release.id,
        kind: 'cover',
        bucket,
        objectKey: coverKey,
        mimeType: 'image/svg+xml',
        byteSize: svgFile(coverKey, coverArt(random, title, artist.name)),
        requiresPurchase: false,
        position: 0,
        createdAt,
      });
      if (random.chance(0.2)) {
        const extras = random.sample(
          ['back_cover', 'photo', 'liner_notes'] as const,
          random.int(1, 3),
        );
        extras.forEach((extraKind, position) => {
          const key = `${DEMO_PREFIX}releases/${release.id}/${extraKind}.svg`;
          rows.releaseAssets.push({
            id: next('asset'),
            releaseId: release.id,
            kind: extraKind,
            title: {
              back_cover: 'Back cover',
              photo: 'Studio photo',
              liner_notes: 'Liner notes',
            }[extraKind],
            bucket,
            objectKey: key,
            mimeType: 'image/svg+xml',
            byteSize: svgFile(
              key,
              extraKind === 'back_cover'
                ? coverArt(random, '', '')
                : headerArt(random),
            ),
            requiresPurchase: extraKind !== 'back_cover' && random.chance(0.5),
            position: position + 1,
            createdAt,
          });
        });
      }

      const previews = new Set(
        random.sample(
          Array.from({ length: trackCount }, (_, i) => i + 1),
          trackCount > 2 ? 2 : 1,
        ),
      );
      for (let position = 1; position <= trackCount; position++) {
        const trackId = next('track');
        release.trackIds.push(trackId);
        rows.tracks.push({
          id: trackId,
          title: words.trackTitle(random),
          artistId: artist.id,
          durationMs: random.int(95, 400) * 1000 + random.int(0, 999),
          createdAt,
        });
        rows.releaseTracks.push({
          releaseId: release.id,
          trackId,
          position,
          isPreview: mode !== 'free' && previews.has(position),
        });
        if (options.clipSizes.length) {
          const clip = clipIndex++ % options.clipSizes.length;
          const key = `${DEMO_PREFIX}tracks/${trackId}.mp3`;
          files.push({ key, copyOf: `${DEMO_PREFIX}audio/clip-${clip}.mp3` });
          rows.trackAudioFiles.push({
            id: next('audio'),
            trackId,
            variant: 'original',
            format: 'mp3',
            bucket,
            objectKey: key,
            byteSize: options.clipSizes[clip],
            sampleRateHz: 44100,
            createdAt,
          });
        }
      }
    }
  }
  const published = releases.filter(
    (release) => release.status === 'published',
  );
  const byPopularity = [...published].sort(
    (a, b) => popularity.indexOf(a.artist) - popularity.indexOf(b.artist),
  );

  // ----------------------------------------------------------------- merch
  const PRODUCT_TYPES = [
    ['shirt', 30],
    ['vinyl', 20],
    ['cassette', 12],
    ['cd', 10],
    ['hoodie', 10],
    ['hat', 6],
    ['beanie', 6],
    ['sweatshirt', 3],
    ['other', 3],
  ] as const;
  const PRICE_RANGES: Record<string, [number, number]> = {
    vinyl: [22, 32],
    cassette: [8, 12],
    cd: [10, 15],
    shirt: [20, 28],
    hoodie: [40, 55],
    sweatshirt: [35, 45],
    hat: [22, 30],
    beanie: [18, 25],
    other: [5, 15],
  };
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

  for (const artist of artists) {
    if (!(artist.releases.length ? random.chance(0.55) : random.chance(0.1)))
      continue;
    const productCount = random.int(1, 5);
    for (let p = 0; p < productCount; p++) {
      const type = random.weighted(
        PRODUCT_TYPES.map(([t, w]) => [t, w] as const),
      );
      const format = type === 'vinyl' || type === 'cassette' || type === 'cd';
      const release = artist.releases.length
        ? random.pick(artist.releases)
        : null;
      if (format && !release) continue;
      const createdAt = random.dateBetween(artist.joinedAt, now);
      const status = random.weighted([
        ['published', 90],
        ['draft', 5],
        ['archived', 5],
      ] as const);
      const subject =
        release && (format || random.chance(0.5)) ? release.title : artist.name;
      const name = {
        vinyl: `${subject} LP`,
        cassette: `${subject} Cassette`,
        cd: `${subject} CD`,
        shirt: `${subject} Tee`,
        hoodie: `${subject} Hoodie`,
        sweatshirt: `${subject} Crewneck`,
        hat: `${artist.name} Dad Hat`,
        beanie: `${artist.name} Beanie`,
        other: random.pick([
          `${artist.name} Tote Bag`,
          `${artist.name} Sticker Pack`,
          `${subject} Zine`,
        ]),
      }[type];
      const product: DemoProduct = {
        id: next('product'),
        artist,
        published: status === 'published',
        releaseId: format ? release!.id : null,
        includesDigital: format && random.chance(0.8),
        variants: [],
        domestic: random.int(4, 8) * 100,
        international: random.chance(0.9) ? random.int(12, 25) * 100 : null,
        createdAt,
      };
      artist.products.push(product);
      if (product.published) artist.sells = true;

      const wearable = ['shirt', 'hoodie', 'sweatshirt'].includes(type);
      const colors =
        wearable && random.chance(0.4)
          ? random.sample(['Black', 'White', 'Navy', 'Sand'], 2)
          : null;
      const vinylColors =
        type === 'vinyl' && random.chance(0.4)
          ? ['Black', 'Clear', 'Splatter']
          : null;
      const option1Name = wearable ? 'Size' : vinylColors ? 'Color' : null;
      const option2Name = colors ? 'Color' : null;
      rows.products.push({
        id: product.id,
        artistId: artist.id,
        releaseId: product.releaseId,
        name,
        description: random.chance(0.7)
          ? format
            ? `${random.pick(['Limited pressing', 'Small run', 'First pressing', 'Hand-numbered edition'])}. Includes a download of the full album.`
            : random.pick([
                'Printed by a friend in our town.',
                'Soft, heavyweight cotton.',
                'Made in a small batch.',
              ])
          : null,
        type,
        status,
        currency: artist.currency,
        includesDigital: product.includesDigital,
        option1Name,
        option2Name,
        createdAt,
        updatedAt: createdAt,
      });

      const [low, high] = PRICE_RANGES[type];
      const base = random.int(low, high) * 100;
      const combos: [string | null, string | null][] = wearable
        ? sizes.flatMap((size) =>
            colors
              ? colors.map((c) => [size, c] as [string, string])
              : [[size, null] as [string, null]],
          )
        : vinylColors
          ? vinylColors.map((c) => [c, null])
          : [[null, null]];
      for (const [option1Value, option2Value] of combos) {
        const variantId = next('variant');
        const price =
          option1Value === 'XXL'
            ? base + 200
            : option1Value === 'Splatter'
              ? base + 500
              : base;
        product.variants.push({ id: variantId, price });
        rows.productVariants.push({
          id: variantId,
          productId: product.id,
          option1Value,
          option2Value,
          price,
          stock: random.chance(0.12) ? 0 : random.int(3, 150),
          sku: random.chance(0.5)
            ? `${artist.handle.slice(0, 6).toUpperCase()}-${type.slice(0, 3).toUpperCase()}-${random.int(100, 999)}`
            : null,
          createdAt,
          updatedAt: createdAt,
        });
      }

      const color = random.pick(MERCH_COLORS);
      const imageCount = random.int(1, 3);
      for (let position = 0; position < imageCount; position++) {
        const key = `${DEMO_PREFIX}products/${product.id}/${position}.svg`;
        rows.productImages.push({
          id: next('productImage'),
          productId: product.id,
          bucket,
          objectKey: key,
          byteSize: svgFile(
            key,
            merchArt(
              random,
              type,
              position === 0 ? '' : random.pick(['Front', 'Back', 'Detail']),
              position === 0 ? color : random.pick(MERCH_COLORS),
            ),
          ),
          altText: name,
          position,
          createdAt,
        });
      }
      rows.productShippingRates.push({
        id: next('shippingRate'),
        productId: product.id,
        destination: 'domestic',
        firstItemAmount: product.domestic,
        additionalItemAmount: random.int(1, 3) * 100,
      });
      if (product.international !== null) {
        rows.productShippingRates.push({
          id: next('shippingRate'),
          productId: product.id,
          destination: 'international',
          firstItemAmount: product.international,
          additionalItemAmount: random.int(3, 8) * 100,
        });
      }
    }
  }
  const publishedProducts = artists.flatMap((artist) =>
    artist.products.filter(
      (product) => product.published && artist !== suspendedArtist,
    ),
  );

  // payout accounts for everyone who sells something paid
  for (const artist of artists) {
    if (!artist.sells) continue;
    rows.payoutAccounts.push({
      id: next('payout'),
      artistId: artist.id,
      stripeAccountId: `acct_demo_${artist.id.slice(-8)}`,
      chargesEnabled: true,
      payoutsEnabled: random.chance(0.95),
      detailsSubmitted: true,
      defaultCurrency: artist.currency,
      createdAt: artist.joinedAt,
      updatedAt: artist.joinedAt,
    });
  }

  // --------------------------------------------------------------- designs
  // its own sequence, so reworking the designs leaves the rest of the world be
  const dressing = new Random(8118);
  interface DemoDesign {
    id: string;
    paid: boolean;
    price: number;
    versionIds: string[];
    template: (typeof DESIGN_TEMPLATES)[number];
  }
  const demoDesigns: DemoDesign[] = [];
  DESIGN_TEMPLATES.forEach((template, d) => {
    // seven designers share the ten, so a few have more than one
    const designer = designers[d % 7];
    const createdAt = dressing.dateBetween(designer.createdAt, now);
    const publishedAt = later(createdAt, 10, dressing, now);
    const { pricing } = template;
    const minimum =
      pricing.mode === 'fixed'
        ? pricing.price
        : pricing.mode === 'name_your_price'
          ? pricing.minimum
          : 0;
    const design: DemoDesign = {
      id: next('design'),
      paid: pricing.mode !== 'free',
      price: pricing.mode === 'name_your_price' ? pricing.suggested : minimum,
      versionIds: [],
      template,
    };
    demoDesigns.push(design);
    rows.designs.push({
      id: design.id,
      designerUserId: designer.id,
      name: template.name,
      description: template.description,
      surface: 'release',
      status: 'published',
      visibility: 'public',
      styles: template.styles,
      pricingMode: pricing.mode,
      currency: pricing.mode === 'free' ? null : 'usd',
      minimumPrice: minimum,
      suggestedPrice:
        pricing.mode === 'name_your_price' ? pricing.suggested : null,
      publishedAt,
      createdAt,
      updatedAt: publishedAt,
    });
    const versions = dressing.int(1, 2);
    for (let version = 1; version <= versions; version++) {
      const versionId = next('designVersion');
      design.versionIds.push(versionId);
      const key = `${DEMO_PREFIX}designs/${design.id}/v${version}.html`;
      const html = bundleHtml(template, version);
      files.push({ key, body: html, contentType: 'text/html; charset=utf-8' });
      rows.designVersions.push({
        id: versionId,
        designId: design.id,
        version,
        bucket,
        objectKey: key,
        byteSize: bytes(html),
        slots: template.slots,
        createdAt: later(createdAt, 60 * version, dressing, now),
      });
    }
    if (
      design.paid &&
      !rows.payoutAccounts.some(
        (account) => account.designerUserId === designer.id,
      )
    ) {
      rows.payoutAccounts.push({
        id: next('payout'),
        designerUserId: designer.id,
        stripeAccountId: `acct_demo_d${designer.id.slice(-7)}`,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        defaultCurrency: 'usd',
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  /**
   * A designed release has the things a design shows off: notes, credits,
   * words for some songs, a back cover, and a few photos.
   */
  const furnish = (release: DemoRelease) => {
    const row = rows.releases.find((r) => r.id === release.id);
    if (!row) return;
    row.description = words.linerNotes(dressing);
    row.credits = words.credits(dressing, release.artist.name);
    for (const trackId of release.trackIds) {
      const track = rows.tracks.find((t) => t.id === trackId);
      if (track && dressing.chance(0.5)) track.lyrics = words.lyrics(dressing);
    }
    const assets = rows.releaseAssets.filter((a) => a.releaseId === release.id);
    let position = Math.max(...assets.map((a) => a.position ?? 0)) + 1;
    const add = (kind: 'back_cover' | 'photo', title: string, body: string) => {
      const id = next('asset');
      const key = `${DEMO_PREFIX}releases/${release.id}/${kind}-${id.slice(-6)}.svg`;
      rows.releaseAssets.push({
        id,
        releaseId: release.id,
        kind,
        title,
        bucket,
        objectKey: key,
        mimeType: 'image/svg+xml',
        byteSize: svgFile(key, body),
        requiresPurchase: false,
        position: position++,
        createdAt: release.publishedAt ?? now,
      });
    };
    if (!assets.some((a) => a.kind === 'back_cover')) {
      add('back_cover', 'Back cover', coverArt(dressing, '', ''));
    }
    const photos = assets.filter((a) => a.kind === 'photo').length;
    for (let i = photos; i < 3; i++) {
      add('photo', words.photoTitle(dressing), headerArt(dressing));
    }
  };

  // artists license designs and dress some releases in them
  let licensePayment = 0;
  for (const artist of dressing.sample(
    artists.filter((a) => a.releases.length),
    45,
  )) {
    for (const design of dressing.sample(demoDesigns, dressing.int(1, 2))) {
      const grant = dressing.chance(0.1);
      const paid = design.paid && !grant;
      rows.designLicenses.push({
        designId: design.id,
        artistId: artist.id,
        source: grant ? 'grant' : paid ? 'purchase' : 'free',
        acquiredByUserId: grant ? null : artist.managers[0],
        amount: paid ? design.price : null,
        currency: paid ? 'usd' : null,
        stripePaymentIntentId: paid
          ? `pi_demo_license_${licensePayment++}`
          : null,
        createdAt: dressing.dateBetween(artist.joinedAt, now),
      });
      const release = artist.releases.find(
        (r) =>
          r.status === 'published' &&
          !rows.releaseDesigns.some((d) => d.releaseId === r.id),
      );
      if (!release || !dressing.chance(0.75)) continue;
      const customization: Record<string, string> = {};
      // most artists bring their own colors; the rest keep the design's
      const palette = dressing.chance(0.6)
        ? dressing.pick(design.template.palettes)
        : null;
      for (const slot of design.template.slots) {
        if (slot.kind === 'color') {
          if (palette) {
            customization[slot.name] =
              slot.name === 'primary' ? palette[0] : palette[1];
          }
        } else if (slot.kind === 'text') {
          customization[slot.name] = dressing.pick(
            SLOT_TEXT[slot.name] ?? [''],
          );
        } else {
          const imageId = next('designImage');
          const key = `${DEMO_PREFIX}release-designs/${release.id}/${imageId}.svg`;
          rows.releaseDesignImages.push({
            id: imageId,
            releaseId: release.id,
            bucket,
            objectKey: key,
            mimeType: 'image/svg+xml',
            byteSize: svgFile(key, slotArt(dressing)),
          });
          customization[slot.name] = imageId;
        }
      }
      rows.releaseDesigns.push({
        releaseId: release.id,
        designVersionId: design.versionIds[design.versionIds.length - 1],
        customization,
      });
      furnish(release);
    }
  }

  // ------------------------------------------------- follows and comments
  const follow = (userId: string, artist: DemoArtist, since: Date) =>
    rows.artistFollowers.push({
      userId,
      artistId: artist.id,
      createdAt: later(since, 400, random, now),
    });
  for (const listener of [...listeners, ...sellers]) {
    const count = random.weighted([
      [0, 15],
      [2, 25],
      [5, 25],
      [10, 20],
      [20, 10],
      [35, 5],
    ] as const);
    const chosen = new Set<DemoArtist>();
    for (let i = 0; i < count; i++)
      chosen.add(popularity[random.popular(popularity.length)]);
    for (const artist of chosen)
      follow(
        listener.id,
        artist,
        new Date(
          Math.max(listener.createdAt.getTime(), artist.joinedAt.getTime()),
        ),
      );
  }
  const commentIds: string[] = [];
  for (let i = 0; i < 2600; i++) {
    const release = byPopularity[random.popular(byPopularity.length, 1.4)];
    const author = random.pick(listeners);
    const createdAt = later(release.publishedAt!, 300, random, now);
    const id = next('comment');
    commentIds.push(id);
    rows.releaseComments.push({
      id,
      userId: author.id,
      releaseId: release.id,
      comment: words.comment(random),
      createdAt,
      updatedAt: random.chance(0.05)
        ? later(createdAt, 5, random, now)
        : createdAt,
    });
  }

  // ------------------------------------------------------------- purchases
  const owned = new Map<string, Set<string>>();
  const ownedBy = (userId: string) =>
    owned.get(userId) ?? owned.set(userId, new Set()).get(userId)!;
  let paymentIntent = 0;
  const entitle = (
    userId: string,
    releaseId: string,
    source: 'purchase' | 'free' | 'gift',
    createdAt: Date,
    orderItemId?: string,
  ) => {
    const set = ownedBy(userId);
    if (set.has(releaseId)) return false;
    set.add(releaseId);
    rows.entitlements.push({
      userId,
      releaseId,
      source,
      createdAt,
      orderItemId: orderItemId ?? null,
    });
    return true;
  };
  const priceFor = (release: DemoRelease) =>
    release.mode === 'fixed'
      ? release.minimum + (random.chance(0.15) ? random.int(1, 5) * 100 : 0)
      : Math.max(release.minimum, release.suggested ?? 0, 100) +
        (random.chance(0.2) ? random.int(1, 6) * 100 : 0);

  /** One checkout: digital releases and merch, one artist order each. */
  const checkout = (
    userId: string,
    name: string,
    picks: DemoRelease[],
    merch: {
      product: DemoProduct;
      variant: { id: string; price: number };
      quantity: number;
    }[],
    at: Date,
  ) => {
    const orderId = next('order');
    const byArtist = new Map<
      DemoArtist,
      { releases: DemoRelease[]; merch: typeof merch }
    >();
    for (const release of picks) {
      if (ownedBy(userId).has(release.id)) continue;
      (
        byArtist.get(release.artist) ??
        byArtist
          .set(release.artist, { releases: [], merch: [] })
          .get(release.artist)!
      ).releases.push(release);
    }
    for (const line of merch) {
      (
        byArtist.get(line.product.artist) ??
        byArtist
          .set(line.product.artist, { releases: [], merch: [] })
          .get(line.product.artist)!
      ).merch.push(line);
    }
    if (!byArtist.size) return;
    const address = merch.length ? words.address(random, name) : null;
    rows.orders.push({
      id: orderId,
      userId,
      shippingAddress: address,
      createdAt: at,
      updatedAt: at,
    });
    const international = address ? address.country !== 'US' : false;

    for (const [artist, lines] of byArtist) {
      const artistOrderId = next('artistOrder');
      const refunded = random.chance(0.02);
      let amount = 0;
      let shipping = 0;
      const items: Row<typeof schema.orderItems>[] = [];
      for (const release of lines.releases) {
        const unitPrice = priceFor(release);
        amount += unitPrice;
        items.push({
          id: next('orderItem'),
          artistOrderId,
          releaseId: release.id,
          quantity: 1,
          unitPrice,
          createdAt: at,
        });
      }
      lines.merch.forEach((line, index) => {
        amount += line.variant.price * line.quantity;
        const rate = international
          ? (line.product.international ?? line.product.domestic)
          : line.product.domestic;
        shipping +=
          index === 0 ? rate + (line.quantity - 1) * 200 : line.quantity * 200;
        items.push({
          id: next('orderItem'),
          artistOrderId,
          productVariantId: line.variant.id,
          quantity: line.quantity,
          unitPrice: line.variant.price,
          createdAt: at,
        });
      });
      rows.artistOrders.push({
        id: artistOrderId,
        orderId,
        artistId: artist.id,
        status: refunded ? 'refunded' : 'completed',
        amount: amount + shipping,
        shippingAmount: shipping,
        taxAmount: 0,
        currency: artist.currency,
        stripePaymentIntentId: `pi_demo_${paymentIntent++}`,
        refundedAt: refunded ? later(at, 10, random, now) : null,
        createdAt: at,
        updatedAt: at,
      });
      rows.orderItems.push(...items);
      if (!refunded) {
        for (const item of items) {
          if (item.releaseId)
            entitle(userId, item.releaseId, 'purchase', at, item.id);
        }
        lines.merch.forEach((line, index) => {
          if (line.product.includesDigital && line.product.releaseId) {
            entitle(
              userId,
              line.product.releaseId,
              'purchase',
              at,
              items[lines.releases.length + index].id,
            );
          }
        });
      }
      if (lines.merch.length) {
        const age = (now.getTime() - at.getTime()) / DAY;
        const status = refunded
          ? 'unfulfilled'
          : age < 4
            ? 'unfulfilled'
            : age < 12
              ? random.weighted([
                  ['shipped', 70],
                  ['unfulfilled', 30],
                ] as const)
              : random.weighted([
                  ['delivered', 75],
                  ['shipped', 25],
                ] as const);
        const shippedAt =
          status === 'unfulfilled' ? null : later(at, 4, random, now);
        rows.fulfillments.push({
          artistOrderId,
          status,
          carrier: shippedAt
            ? random.pick(['USPS', 'UPS', 'DHL', 'Royal Mail'])
            : null,
          trackingNumber: shippedAt
            ? `9400${random.int(100000000, 999999999)}${random.int(1000, 9999)}`
            : null,
          shippedAt,
          createdAt: at,
          updatedAt: shippedAt ?? at,
        });
      }
    }
  };

  const paidPublished = byPopularity.filter(
    (r) => r.mode !== 'free' && r.artist !== suspendedArtist,
  );
  const freePublished = byPopularity.filter(
    (r) => r.mode === 'free' && r.artist !== suspendedArtist,
  );
  const merchLine = () => {
    const product =
      publishedProducts[random.popular(publishedProducts.length, 1.3)];
    return {
      product,
      variant: random.pick(product.variants),
      quantity: random.chance(0.15) ? 2 : 1,
    };
  };

  for (const listener of listeners) {
    const checkouts = random.weighted([
      [0, 25],
      [1, 20],
      [2, 15],
      [4, 25],
      [9, 15],
    ] as const);
    for (let c = 0; c < checkouts; c++) {
      const picks = Array.from(
        {
          length: random.weighted([
            [1, 60],
            [2, 28],
            [3, 12],
          ] as const),
        },
        () => paidPublished[random.popular(paidPublished.length)],
      );
      const merch =
        random.chance(0.12) && publishedProducts.length ? [merchLine()] : [];
      const earliest = Math.max(
        listener.createdAt.getTime(),
        ...picks.map((r) => r.publishedAt!.getTime()),
      );
      checkout(
        listener.id,
        listener.name ?? listener.username,
        picks,
        merch,
        later(new Date(earliest), 500, random, now),
      );
    }
    const claims = random.weighted([
      [0, 30],
      [1, 25],
      [3, 25],
      [6, 15],
      [12, 5],
    ] as const);
    for (let c = 0; c < claims; c++) {
      const release = freePublished[random.popular(freePublished.length)];
      if (release)
        entitle(
          listener.id,
          release.id,
          'free',
          later(
            new Date(
              Math.max(
                listener.createdAt.getTime(),
                release.publishedAt!.getTime(),
              ),
            ),
            400,
            random,
            now,
          ),
        );
    }
    if (random.chance(0.04)) {
      const release = random.pick(paidPublished);
      entitle(
        listener.id,
        release.id,
        'gift',
        later(release.publishedAt!, 300, random, now),
      );
    }
  }

  // only people who own a release leave notes on it, so each comment goes to
  // one of its owners, from its own source to leave the rest as it was
  const noting = new Random(4404);
  const ownersOf = new Map<string, string[]>();
  for (const { userId, releaseId } of rows.entitlements) {
    ownersOf.set(releaseId, [...(ownersOf.get(releaseId) ?? []), userId]);
  }
  for (const comment of rows.releaseComments) {
    const owners = ownersOf.get(comment.releaseId) ?? [];
    if (owners.length && !owners.includes(comment.userId)) {
      comment.userId = noting.pick(owners);
    }
  }

  // ----------------------------------------------------------------- crates
  // their own source, so adding crates leaves the rest of the world as it was
  const crating = new Random(9001);
  const onShelves = releases.filter(
    (release) =>
      release.status === 'published' && release.artist !== suspendedArtist,
  );
  const crateMakers = [
    ...crating.sample(listeners, 60),
    ...crating.sample(sellers, 10),
  ];
  const makeCrate = (
    ownerUserId: string,
    since: Date,
    picks: DemoRelease[],
    name: string,
    visibility: 'public' | 'private',
  ) => {
    const id = next('crate');
    const createdAt = later(since, 300, crating, now);
    rows.crates.push({
      id,
      ownerUserId,
      name,
      note: crating.chance(0.5) ? words.crateNote(crating) : null,
      visibility,
      createdAt,
      updatedAt: createdAt,
    });
    picks.forEach((release, i) =>
      rows.crateReleases.push({
        crateId: id,
        releaseId: release.id,
        position: i + 1,
        note: crating.chance(0.3) ? words.crateLine(crating) : null,
        addedAt: createdAt,
      }),
    );
  };
  for (const maker of crateMakers) {
    // a crate leans toward one sound, with a few strays
    const scene = crating.pick(SCENES);
    const inScene = onShelves.filter(
      (release) => release.artist.scene === scene,
    );
    const picks = [
      ...new Set([
        ...crating.sample(inScene, crating.int(4, 10)),
        ...crating.sample(onShelves, crating.int(1, 4)),
      ]),
    ];
    makeCrate(
      maker.id,
      maker.createdAt,
      picks,
      words.crateName(crating, scene),
      crating.chance(0.85) ? 'public' : 'private',
    );
  }
  // some listeners follow the people whose crates they like
  for (const follower of crating.sample(listeners, 150)) {
    for (const maker of crating.sample(crateMakers, crating.int(1, 4))) {
      if (maker.id === follower.id) continue;
      rows.userFollowers.push({
        followerUserId: follower.id,
        followedUserId: maker.id,
        createdAt: later(follower.createdAt, 200, crating, now),
      });
    }
  }

  // ------------------------------------------------- the owner's own world
  let ownerArtist: DemoArtist | null = null;
  if (owner) {
    ownerArtist =
      popularity.find(
        (a) =>
          a.releases.length >= 4 &&
          a.products.length >= 2 &&
          a !== suspendedArtist,
      ) ?? popularity[0];
    rows.artistManagers.push({
      userId: owner.id,
      artistId: ownerArtist.id,
      createdAt: ownerArtist.joinedAt,
    });
    const since = new Date(now.getTime() - 400 * DAY);
    for (const artist of random.sample(popularity.slice(0, 120), 45))
      follow(owner.id, artist, since);
    for (let c = 0; c < 30; c++) {
      const picks = random.sample(
        paidPublished.slice(0, 200),
        random.int(1, 3),
      );
      const merch = c % 7 === 0 ? [merchLine()] : [];
      const earliest = Math.max(
        since.getTime(),
        ...picks.map((r) => r.publishedAt!.getTime()),
      );
      checkout(
        owner.id,
        owner.name,
        picks,
        merch,
        later(new Date(earliest), 300, random, now),
      );
    }
    for (const release of random.sample(freePublished, 40))
      entitle(
        owner.id,
        release.id,
        'free',
        later(release.publishedAt!, 200, random, now),
      );
    for (const release of random.sample(paidPublished.slice(200), 8))
      entitle(
        owner.id,
        release.id,
        'gift',
        later(release.publishedAt!, 200, random, now),
      );
    for (const releaseId of random.sample([...ownedBy(owner.id)], 6)) {
      const release = releases.find((r) => r.id === releaseId)!;
      rows.releaseComments.push({
        id: next('comment'),
        userId: owner.id,
        releaseId,
        comment: words.comment(random),
        createdAt: later(release.publishedAt!, 100, random, now),
      });
    }
  }

  // ---------------------------------------------------------------- money
  const months = Array.from({ length: CLOSED_MONTHS }, (_, i) =>
    monthStart(now, i - CLOSED_MONTHS),
  );
  const openMonth = monthStart(now, 0);
  const sellerIds = new Set([
    ...sellers.map((s) => s.id),
    ...designers.map((d) => d.id),
  ]);
  const lapsed = new Set(random.sample(sellers, 3).map((s) => s.id));
  const balance = new Map<string, number>();
  let topUp = 0;
  const topUpFor = (userId: string, amount: number, at: Date) => {
    const fee = Math.round(amount * 0.029) + 30;
    rows.balanceEntries.push({
      id: next('balance'),
      userId,
      kind: 'top_up',
      amount,
      cardFee: fee,
      stripePaymentIntentId: `pi_demo_topup_${topUp++}`,
      createdAt: at,
    });
    balance.set(userId, (balance.get(userId) ?? 0) + amount);
    return fee;
  };

  for (const userId of sellerIds) {
    const user = users.find((u) => u.id === userId)!;
    const auto = random.weighted([
      ['off', 60],
      ['monthly', 20],
      ['below_threshold', 20],
    ] as const);
    rows.sellerBilling.push({
      userId,
      stripeCustomerId: `cus_demo_${userId.slice(-8)}`,
      stripePaymentMethodId:
        lapsed.has(userId) && random.chance(0.5)
          ? null
          : `pm_demo_${userId.slice(-8)}`,
      alertThresholdAmount:
        auto === 'below_threshold' || random.chance(0.3)
          ? random.int(2, 5) * 100
          : null,
      autoTopUpMode: lapsed.has(userId) ? 'off' : auto,
      autoTopUpAmount:
        auto !== 'off' && !lapsed.has(userId) ? random.int(1, 3) * 500 : null,
      autoTopUpExtraAmount: 0,
      lapsedAt: lapsed.has(userId)
        ? new Date(now.getTime() - random.int(2, 10) * DAY)
        : null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    });
    topUpFor(
      userId,
      lapsed.has(userId) ? 300 : random.int(2, 5) * 500,
      user.createdAt,
    );
  }

  // a seller's artists and their usage: lossless masters and stream copies
  const managedBy = new Map<string, DemoArtist[]>();
  for (const artist of artists) {
    for (const userId of artist.managers)
      (managedBy.get(userId) ?? managedBy.set(userId, []).get(userId)!).push(
        artist,
      );
  }
  const usageOf = (artist: DemoArtist) => {
    const gb =
      artist.releases.reduce((sum, r) => sum + r.trackCount * 0.045, 0) +
      artist.products.length * 0.004;
    return { gb, requests: Math.round(gb * random.int(800, 4000)) };
  };

  let statementCount = 0;
  months.forEach((month, monthIndex) => {
    const monthEnd = monthStart(now, monthIndex - CLOSED_MONTHS + 1);
    const days = (monthEnd.getTime() - month.getTime()) / DAY;
    const growth = 1 + monthIndex * 0.12;
    const costs = {
      storage_and_delivery: Math.round(1600 * growth + random.int(0, 300)),
      hosting: 2500,
      database: 2500,
      other_services: random.int(1100, 1500),
      ownership_guarantee:
        monthIndex >= 2 ? random.int(10, 60) * (monthIndex - 1) : 0,
    };
    for (const [category, amount] of Object.entries(costs)) {
      if (!amount) continue;
      rows.platformCosts.push({
        id: next('cost'),
        month: iso(month),
        category: category as keyof typeof costs,
        description: {
          storage_and_delivery: 'Object storage and requests',
          hosting: 'App and API servers',
          database: 'Managed Postgres',
          other_services: 'Email, domain, and monitoring',
          ownership_guarantee: 'Files owned by listeners of departed sellers',
        }[category]!,
        amount,
        createdAt: monthEnd,
      });
    }
    const activeSellers = [...sellerIds].filter(
      (id) => users.find((u) => u.id === id)!.createdAt < monthEnd,
    );
    const shared =
      costs.hosting +
      costs.database +
      costs.other_services +
      costs.ownership_guarantee;
    const sharedEach = Math.round(shared / Math.max(1, activeSellers.length));
    const subsidyEach = Math.round(
      sharedEach * Math.max(0.15, 0.6 - monthIndex * 0.08),
    );
    rows.billingPeriods.push({
      month: iso(month),
      storageMicrodollarsPerGbMonth: 15000,
      requestMicrodollarsPerMillion: 360000,
      status: 'closed',
      sellerCount: activeSellers.length,
      sharedCostsTotal: shared,
      subsidyTotal: subsidyEach * activeSellers.length,
      closedAt: new Date(monthEnd.getTime() + 2 * DAY),
      createdAt: month,
    });
    for (const userId of activeSellers) {
      const lines: StatementLine[] = (managedBy.get(userId) ?? []).map(
        (artist) => {
          const usage = usageOf(artist);
          const share =
            artist.managers.length === 1
              ? 10000
              : artist.managers[0] === userId
                ? 6000
                : 4000;
          const amount = Math.round(
            ((usage.gb * 1.5 + (usage.requests / 1e6) * 36) * share) / 10000,
          );
          return {
            artistId: artist.id,
            designerUserId: null,
            name: artist.name,
            shareBasisPoints: share,
            storageByteDays: Math.round(usage.gb * 1e9 * days),
            requests: usage.requests,
            amount,
          };
        },
      );
      const usageAmount = lines.reduce((sum, line) => sum + line.amount, 0);
      const statementId = next('statement');
      let fees = 0;
      // keep balances above zero, except for the sellers who lapsed
      if ((balance.get(userId) ?? 0) < 200 && !lapsed.has(userId)) {
        fees = topUpFor(
          userId,
          random.int(2, 4) * 500,
          new Date(month.getTime() + random.int(1, 20) * DAY),
        );
      }
      const total = usageAmount + sharedEach - subsidyEach + fees;
      rows.statements.push({
        id: statementId,
        userId,
        month: iso(month),
        usageAmount,
        sharedAmount: sharedEach,
        subsidyAmount: subsidyEach,
        cardFeesAmount: fees,
        totalAmount: total,
        lines,
        createdAt: new Date(monthEnd.getTime() + 2 * DAY),
      });
      rows.balanceEntries.push({
        id: next('balance'),
        userId,
        kind: 'monthly_charge',
        amount: -total,
        statementId,
        createdAt: new Date(monthEnd.getTime() + 2 * DAY),
      });
      balance.set(userId, (balance.get(userId) ?? 0) - total);
      statementCount++;
    }
  });
  // this month, open and counting
  rows.billingPeriods.push({
    month: iso(openMonth),
    storageMicrodollarsPerGbMonth: 15000,
    requestMicrodollarsPerMillion: 360000,
    status: 'open',
    createdAt: openMonth,
  });
  const daysSoFar = Math.max(1, (now.getTime() - openMonth.getTime()) / DAY);
  for (const artist of artists) {
    const usage = usageOf(artist);
    if (!usage.gb) continue;
    rows.monthlyUsage.push({
      id: next('usage'),
      month: iso(openMonth),
      artistId: artist.id,
      storageByteDays: Math.round(usage.gb * 1e9 * daysSoFar),
      requests: Math.round((usage.requests * daysSoFar) / 30),
      updatedAt: now,
    });
  }

  // gifts on the donation page, and the reserve they fill
  let gift = 0;
  for (let i = 0; i < 260; i++) {
    const donor = random.pick(listeners);
    const destination = random.chance(0.75) ? 'platform' : 'developers';
    const monthly = random.chance(0.25);
    const createdAt = random.dateBetween(months[0], now);
    const id = next('contribution');
    rows.contributions.push({
      id,
      userId: random.chance(0.15) ? null : donor.id,
      isAnonymous: random.chance(0.3),
      destination,
      cadence: monthly ? 'monthly' : 'one_time',
      source: 'donation_page',
      amount: random.pick([300, 500, 500, 1000, 1000, 2000, 2500, 5000]),
      stripePaymentIntentId: `pi_demo_gift_${gift}`,
      stripeSubscriptionId: monthly ? `sub_demo_${gift}` : null,
      createdAt,
    });
    gift++;
    if (destination === 'platform') {
      rows.reserveEntries.push({
        id: next('reserve'),
        kind: 'donation',
        amount: rows.contributions[rows.contributions.length - 1].amount,
        contributionId: id,
        createdAt,
      });
    }
  }
  for (const month of months.slice(2)) {
    rows.reserveEntries.push({
      id: next('reserve'),
      kind: 'covered_costs',
      amount: -random.int(200, 900),
      month: iso(month),
      note: 'Steadied shares in a month with higher costs',
      createdAt: month,
    });
  }

  // ------------------------------------------------------------ moderation
  const adminId = owner?.id ?? null;
  const reporters = random.sample(listeners, 120);
  let reporterIndex = 0;
  const report = (
    targetType:
      'release' | 'comment' | 'artist' | 'user' | 'product' | 'design',
    targetId: string,
    reason: Row<typeof schema.reports>['reason'],
    status: 'open' | 'dismissed' | 'actioned' = 'open',
  ) => {
    const createdAt = new Date(
      now.getTime() - random.int(1, 30) * DAY - random.int(0, 86400) * 1000,
    );
    rows.reports.push({
      id: next('report'),
      reporterUserId: reporters[reporterIndex++ % reporters.length].id,
      targetType,
      targetId,
      reason,
      note: words.reportNote(random),
      status,
      resolvedByUserId: status === 'open' ? null : adminId,
      resolvedAt: status === 'open' ? null : later(createdAt, 3, random, now),
      createdAt,
    });
  };
  const act = (
    action: Row<typeof schema.moderationActions>['action'],
    targetType: Row<typeof schema.moderationActions>['targetType'],
    targetId: string,
    reason: Row<typeof schema.moderationActions>['reason'],
    note: string | null,
    daysAgo: number,
  ) =>
    rows.moderationActions.push({
      id: next('action'),
      adminUserId: adminId,
      action,
      targetType,
      targetId,
      reason,
      note,
      createdAt: new Date(now.getTime() - daysAgo * DAY),
    });

  // the open queue
  for (const release of random.sample(byPopularity.slice(20), 8)) {
    for (let r = 0; r < random.int(1, 3); r++)
      report(
        'release',
        release.id,
        random.weighted([
          ['copyright', 6],
          ['illegal_content', 1],
          ['spam', 2],
          ['other', 1],
        ] as const),
      );
  }
  for (const id of random.sample(commentIds, 7))
    report(
      'comment',
      id,
      random.weighted([
        ['hate_or_harassment', 3],
        ['spam', 3],
        ['other', 1],
      ] as const),
    );
  for (const artist of random.sample(popularity.slice(40), 3))
    report(
      'artist',
      artist.id,
      random.pick(['spam', 'copyright', 'other'] as const),
    );
  for (const user of random.sample(listeners, 3))
    report(
      'user',
      user.id,
      random.pick(['hate_or_harassment', 'spam'] as const),
    );
  if (publishedProducts.length)
    report('product', random.pick(publishedProducts).id, 'copyright');
  report('design', demoDesigns[0].id, 'harmful_design_code');
  const claimed = random.pick(byPopularity.slice(30, 120));
  rows.reports.push({
    id: next('report'),
    claimantName: 'Northbound Records',
    claimantEmail: 'legal@northbound.example.com',
    targetType: 'release',
    targetId: claimed.id,
    reason: 'copyright',
    note: 'Track 2 samples our catalog without a license.',
    status: 'open',
    createdAt: new Date(now.getTime() - 2 * DAY),
  });

  // history: dismissed reports
  for (const release of random.sample(byPopularity.slice(10), 6)) {
    report('release', release.id, 'spam', 'dismissed');
    act(
      'dismiss',
      'release',
      release.id,
      null,
      'Not spam; a normal release.',
      random.int(5, 60),
    );
  }
  // a copyright takedown the artist is contesting
  const contested = byPopularity[byPopularity.length - 5];
  contested.status = 'taken_down';
  report('release', contested.id, 'copyright', 'actioned');
  act(
    'take_down',
    'release',
    contested.id,
    'copyright',
    'The rights holder sent proof of ownership of two tracks.',
    6,
  );
  rows.copyrightContests.push({
    id: next('contest'),
    releaseId: contested.id,
    contestedByUserId: contested.artist.managers[0],
    statement:
      'Both tracks are originals. We have the session files and can share them.',
    createdAt: new Date(now.getTime() - 3 * DAY),
  });
  // a final takedown
  const removed = byPopularity[byPopularity.length - 9];
  removed.status = 'taken_down';
  report('release', removed.id, 'illegal_content', 'actioned');
  act('take_down', 'release', removed.id, 'illegal_content', null, 40);
  act('finalize_takedown', 'release', removed.id, null, null, 40);
  // the suspended artist, a suspended user, a deleted comment, a pulled product
  report('artist', suspendedArtist.id, 'copyright', 'actioned');
  act(
    'suspend',
    'artist',
    suspendedArtist.id,
    'copyright',
    "Repeated uploads of other artists' work.",
    9,
  );
  const suspendedUser = listeners[listeners.length - 7];
  report('user', suspendedUser.id, 'hate_or_harassment', 'actioned');
  act(
    'suspend',
    'user',
    suspendedUser.id,
    'hate_or_harassment',
    'Harassing artists in comments.',
    14,
  );
  act('take_down', 'comment', next('comment'), 'hate_or_harassment', null, 14);
  const pulled = publishedProducts[publishedProducts.length - 2];
  if (pulled) {
    pulled.published = false;
    report('product', pulled.id, 'copyright', 'actioned');
    act(
      'take_down',
      'product',
      pulled.id,
      'copyright',
      'Uses a band logo the artist does not own.',
      20,
    );
  }
  for (const row of rows.releases) {
    if (row.id === contested.id) row.status = 'taken_down';
    if (row.id === removed.id) {
      row.status = 'taken_down';
      row.takedownFinalAt = new Date(now.getTime() - 40 * DAY);
    }
  }
  for (const row of rows.products)
    if (pulled && row.id === pulled.id) row.status = 'taken_down';
  // a final takedown removes the release from every library
  rows.entitlements = rows.entitlements.filter(
    (row) => row.releaseId !== removed.id,
  );

  if (owner) {
    const owned = new Set(ownedBy(owner.id));
    const shelf = onShelves.filter((release) => owned.has(release.id));
    makeCrate(
      owner.id,
      new Date(now.getTime() - 120 * DAY),
      crating.sample(shelf, 8),
      'Records for the drive home',
      'public',
    );
    makeCrate(
      owner.id,
      new Date(now.getTime() - 30 * DAY),
      crating.sample(onShelves, 5),
      'To listen to',
      'private',
    );
    for (const maker of crating.sample(crateMakers, 5)) {
      rows.userFollowers.push({
        followerUserId: owner.id,
        followedUserId: maker.id,
        createdAt: new Date(now.getTime() - 20 * DAY),
      });
    }
  }

  // people save other people's public crates, a few crates far more than
  // the rest; their own source, so the rest of the world stays as it was
  const saving = new Random(6206);
  for (const crate of rows.crates) {
    if (crate.visibility !== 'public') continue;
    const count = Math.floor(80 * saving.next() ** 3);
    for (const saver of saving.sample(listeners, count)) {
      if (saver.id === crate.ownerUserId) continue;
      rows.crateSaves.push({
        userId: saver.id,
        crateId: crate.id as string,
        createdAt: later(crate.createdAt as Date, 200, saving, now),
      });
    }
  }
  if (owner) {
    const others = rows.crates.filter(
      (crate) =>
        crate.visibility === 'public' && crate.ownerUserId !== owner.id,
    );
    for (const crate of saving.sample(others, 4)) {
      rows.crateSaves.push({
        userId: owner.id,
        crateId: crate.id as string,
        createdAt: new Date(now.getTime() - 10 * DAY),
      });
    }
  }

  const suspendedUserIds = [suspendedUser.id];
  // every other designer takes requests for custom designs
  const commissionUserIds = designers
    .filter((_, i) => i % 2 === 0)
    .map((designer) => designer.id);

  return {
    users,
    suspendedUserIds,
    commissionUserIds,
    rows,
    files,
    ownerArtist: ownerArtist
      ? { id: ownerArtist.id, name: ownerArtist.name }
      : null,
    months: [...months, openMonth].map(iso),
    summary: {
      listeners: listeners.length,
      sellers: sellerIds.size,
      artists: artists.length,
      releases: releases.length,
      tracks: rows.tracks.length,
      products: rows.products.length,
      designs: rows.designs.length,
      follows: rows.artistFollowers.length,
      comments: rows.releaseComments.length,
      crateSaves: rows.crateSaves.length,
      orders: rows.orders.length,
      entitlements: rows.entitlements.length,
      statements: statementCount,
      openReports: rows.reports.filter((r) => r.status === 'open').length,
      ownerLibrary: owner ? ownedBy(owner.id).size : 0,
    },
  };
}

export type DemoWorld = ReturnType<typeof buildWorld>;
