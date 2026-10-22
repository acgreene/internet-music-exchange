/**
 * Fill the local database with a large demo world: thousands of listeners,
 * a couple hundred artists with releases, merch, and designs, what everyone
 * bought and said, the money side, and a moderation queue. Its files go to
 * the R2 bucket under `demo/`.
 *
 * Every demo row's id starts with `de30`, so running it again replaces the
 * demo without touching anything else, and `--clean` removes it.
 *
 *   pnpm db:seed-demo                  seed, replacing any earlier demo
 *   pnpm db:seed-demo --owner=<name>   give that user a library, admin
 *                                      rights, and a demo artist to manage
 *   pnpm db:seed-demo --skip-files     rewrite the rows only, reusing the
 *                                      files an earlier run stored
 *   pnpm db:seed-demo --clean          remove the demo and its files
 */
import { statSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@ime/env';
import * as schema from '../../libs/api/db/src/lib/schema';
import { makeClips } from './audio';
import { DEMO_ID_PREFIX } from './random';
import { DEMO_PREFIX, DemoStorage, inParallel } from './storage';
import { buildWorld, type DemoWorld } from './world';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? 'true'] as const;
  }),
);

/** Only ever a database on this machine. */
function requireLocalDatabase(url: string): void {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(
      `Refusing to seed ${host}: the demo seed only runs against a local database.`,
    );
  }
}

const like = `${DEMO_ID_PREFIX}%`;

/** Remove every demo row, children before parents. */
async function clean(
  db: ReturnType<typeof drizzle<typeof schema>>,
  months: string[],
): Promise<void> {
  const statements = [
    sql`delete from reports where id::text like ${like} or target_id::text like ${like} or reporter_user_id::text like ${like}`,
    sql`delete from moderation_actions where id::text like ${like} or target_id::text like ${like}`,
    sql`delete from copyright_contests where id::text like ${like} or release_id::text like ${like}`,
    sql`delete from release_designs where release_id::text like ${like}`,
    sql`delete from release_design_images where id::text like ${like} or release_id::text like ${like}`,
    sql`delete from design_licenses where design_id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from design_versions where id::text like ${like} or design_id::text like ${like}`,
    sql`delete from designs where id::text like ${like} or designer_user_id::text like ${like}`,
    sql`delete from reserve_entries where id::text like ${like} or contribution_id::text like ${like}`,
    sql`delete from contributions where id::text like ${like} or user_id::text like ${like}`,
    sql`delete from balance_entries where id::text like ${like} or user_id::text like ${like}`,
    sql`delete from statements where id::text like ${like} or user_id::text like ${like}`,
    sql`delete from monthly_usage where id::text like ${like} or artist_id::text like ${like} or designer_user_id::text like ${like}`,
    sql`delete from platform_costs where id::text like ${like}`,
    sql`delete from billing_periods where month in (select value::date from jsonb_array_elements_text(${JSON.stringify(months)}::jsonb)) and not exists (select 1 from statements s where s.month = billing_periods.month) and not exists (select 1 from platform_costs c where c.month = billing_periods.month)`,
    sql`delete from cost_share_offers where artist_id::text like ${like} or user_id::text like ${like}`,
    sql`delete from cost_shares where artist_id::text like ${like} or user_id::text like ${like}`,
    sql`delete from seller_billing where user_id::text like ${like}`,
    sql`delete from payout_accounts where id::text like ${like} or artist_id::text like ${like} or designer_user_id::text like ${like}`,
    sql`delete from fulfillments where artist_order_id::text like ${like}`,
    sql`delete from entitlements where release_id::text like ${like} or user_id::text like ${like} or order_item_id::text like ${like}`,
    sql`delete from order_items where id::text like ${like} or artist_order_id::text like ${like}`,
    sql`delete from artist_orders where id::text like ${like} or order_id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from orders where id::text like ${like} or user_id::text like ${like}`,
    sql`delete from release_comments where id::text like ${like} or release_id::text like ${like} or user_id::text like ${like}`,
    sql`delete from artist_followers where artist_id::text like ${like} or user_id::text like ${like}`,
    sql`delete from product_shipping_rates where id::text like ${like} or product_id::text like ${like}`,
    sql`delete from product_images where id::text like ${like} or product_id::text like ${like}`,
    sql`delete from product_variants where id::text like ${like} or product_id::text like ${like}`,
    sql`delete from products where id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from release_assets where id::text like ${like} or release_id::text like ${like}`,
    sql`delete from release_pricing where release_id::text like ${like}`,
    sql`delete from release_tracks where release_id::text like ${like}`,
    sql`delete from track_audio_files where id::text like ${like} or track_id::text like ${like}`,
    sql`delete from tracks where id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from releases where id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from artist_links where id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from artist_images where id::text like ${like} or artist_id::text like ${like}`,
    sql`delete from artist_managers where artist_id::text like ${like} or user_id::text like ${like}`,
    sql`delete from artists where id::text like ${like}`,
    sql`delete from platform_admins where user_id::text like ${like}`,
    sql`delete from auth.users where id::text like ${like}`,
  ];
  await db.transaction(async (tx) => {
    for (const statement of statements) await tx.execute(statement);
  });
}

/** Insert rows in chunks small enough for Postgres's parameter limit. */
async function insertAll<T extends Record<string, unknown>>(
  tx: Parameters<
    Parameters<ReturnType<typeof drizzle<typeof schema>>['transaction']>[0]
  >[0],
  table: Parameters<typeof tx.insert>[0],
  rows: T[],
): Promise<void> {
  if (!rows.length) return;
  const columns = Math.max(
    ...rows.slice(0, 50).map((row) => Object.keys(row).length),
  );
  const size = Math.max(1, Math.floor(30000 / columns));
  for (let i = 0; i < rows.length; i += size) {
    await tx.insert(table).values(rows.slice(i, i + size) as never);
  }
}

async function insertWorld(
  db: ReturnType<typeof drizzle<typeof schema>>,
  world: DemoWorld,
): Promise<void> {
  const { rows, users } = world;
  await db.transaction(async (tx) => {
    // accounts: an auth user each, whose profile a trigger creates
    for (let i = 0; i < users.length; i += 1000) {
      const batch = users.slice(i, i + 1000);
      // one JSON parameter, since drizzle spreads arrays into lists
      const records = JSON.stringify(
        batch.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          username: u.username,
          created_at: u.createdAt.toISOString(),
        })),
      );
      await tx.execute(sql`
        insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change)
        select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email, '',
          v.created_at, '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('name', v.name), v.created_at, v.created_at, '', '', '', ''
        from jsonb_to_recordset(${records}::jsonb)
          as v(id uuid, email text, name text, username text, created_at timestamptz)`);
      await tx.execute(sql`
        update users set username = v.username, name = v.name, created_at = v.created_at
        from jsonb_to_recordset(${records}::jsonb)
          as v(id uuid, email text, name text, username text, created_at timestamptz)
        where users.id = v.id`);
    }
    await tx.execute(
      sql`update users set suspended_at = now() - interval '14 days' where id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(world.suspendedUserIds)}::jsonb))`,
    );

    const order: [
      Parameters<typeof tx.insert>[0],
      Record<string, unknown>[],
    ][] = [
      [schema.artists, rows.artists],
      [schema.artistManagers, rows.artistManagers],
      [schema.artistImages, rows.artistImages],
      [schema.artistLinks, rows.artistLinks],
      [schema.payoutAccounts, rows.payoutAccounts],
      [schema.releases, rows.releases],
      [schema.releasePricing, rows.releasePricing],
      [schema.tracks, rows.tracks],
      [schema.releaseTracks, rows.releaseTracks],
      [schema.trackAudioFiles, rows.trackAudioFiles],
      [schema.releaseAssets, rows.releaseAssets],
      [schema.products, rows.products],
      [schema.productVariants, rows.productVariants],
      [schema.productImages, rows.productImages],
      [schema.productShippingRates, rows.productShippingRates],
      [schema.designs, rows.designs],
      [schema.designVersions, rows.designVersions],
      [schema.designLicenses, rows.designLicenses],
      [schema.releaseDesignImages, rows.releaseDesignImages],
      [schema.releaseDesigns, rows.releaseDesigns],
      [schema.artistFollowers, rows.artistFollowers],
      [schema.releaseComments, rows.releaseComments],
      [schema.orders, rows.orders],
      [schema.artistOrders, rows.artistOrders],
      [schema.orderItems, rows.orderItems],
      [schema.entitlements, rows.entitlements],
      [schema.fulfillments, rows.fulfillments],
      [schema.sellerBilling, rows.sellerBilling],
      [schema.costShares, rows.costShares],
      [schema.billingPeriods, rows.billingPeriods],
      [schema.platformCosts, rows.platformCosts],
      [schema.statements, rows.statements],
      [schema.balanceEntries, rows.balanceEntries],
      [schema.monthlyUsage, rows.monthlyUsage],
      [schema.contributions, rows.contributions],
      [schema.reserveEntries, rows.reserveEntries],
      [schema.reports, rows.reports],
      [schema.moderationActions, rows.moderationActions],
      [schema.copyrightContests, rows.copyrightContests],
    ];
    for (const [table, tableRows] of order)
      await insertAll(tx, table, tableRows);
  });
}

async function main(): Promise<void> {
  requireLocalDatabase(env.DATABASE_URL);
  const client = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 4,
    onnotice: () => undefined,
  });
  const db = drizzle(client, { schema });
  const storage = new DemoStorage();
  const now = new Date();

  try {
    const ownerName = args.get('owner');
    const [owner] = ownerName
      ? await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            username: schema.users.username,
          })
          .from(schema.users)
          .where(sql`${schema.users.username} = ${ownerName}`)
      : [];
    if (ownerName && !owner) throw new Error(`No user is named ${ownerName}.`);

    // the months this seed writes, so cleaning can remove their periods
    const months = Array.from({ length: 7 }, (_, i) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i - 6, 1))
        .toISOString()
        .slice(0, 10),
    );

    console.log('Removing any earlier demo data…');
    await clean(db, months);
    if (args.has('clean')) {
      const removed = await storage.deleteAll();
      console.log(
        `Removed the demo. Deleted ${removed} files under ${DEMO_PREFIX}.`,
      );
      return;
    }

    // the world is the same on every run, so its files can be reused
    const skipFiles = args.has('skip-files');
    console.log('Making audio clips…');
    const clips = makeClips();
    if (!skipFiles)
      await inParallel(
        clips.map((file, index) => ({ file, index })),
        8,
        ({ file, index }) =>
          storage.put(
            `${DEMO_PREFIX}audio/clip-${index}.mp3`,
            readFileSync(file),
            'audio/mpeg',
          ),
        'clips',
      );

    console.log('Building the demo world…');
    const world = buildWorld({
      owner: owner
        ? { id: owner.id, name: owner.name ?? owner.username ?? 'Owner' }
        : null,
      bucket: storage.bucket,
      clipSizes: clips.map((file) => statSync(file).size),
      now,
    });

    if (skipFiles) console.log('Reusing the stored files.');
    else
      console.log(
        `Storing ${world.files.length} files in ${storage.bucket}/${DEMO_PREFIX}…`,
      );
    if (!skipFiles)
      await inParallel(
        world.files,
        32,
        (file) =>
          'copyOf' in file
            ? storage.copy(file.copyOf, file.key)
            : storage.put(file.key, file.body, file.contentType),
        'files',
      );

    console.log('Writing the database…');
    await insertWorld(db, world);
    if (owner) {
      await db
        .insert(schema.platformAdmins)
        .values({ userId: owner.id })
        .onConflictDoNothing();
    }

    console.log('\nDone:');
    console.table(world.summary);
    if (owner && world.ownerArtist) {
      console.log(
        `${ownerName} is an admin and also manages the demo artist "${world.ownerArtist.name}".`,
      );
    }
  } finally {
    await client.end();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
