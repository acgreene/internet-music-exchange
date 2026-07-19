# db

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test db` to execute the unit tests via [Vitest](https://vitest.dev/).

## Migrations

Tables live under `src/lib/tables/` and are re-exported from
`src/lib/schema.ts`, which is what drizzle-kit diffs and what `DatabaseService`
passes to `drizzle()`.

After changing a table:

```sh
pnpm db:generate --name=add_playlists_table   # please pass --name otherwise drizzle-kit will invent a random name
pnpm db:migrate
```

To write SQL that drizzle-kit cannot generate — triggers, functions, policies,
or anything touching schemas internal to supabase, create an empty, journaled
migration and fill it in:

```sh
pnpm db:generate --custom --name=auth_user_trigger
```

Renaming an already-applied migration is safe: the `drizzle.__drizzle_migrations`
table tracks a hash of the file *contents*, not the filename. Rename the `.sql`
file and update its `tag` in `meta/_journal.json`.

Also never run `drizzle-kit push`! It reconciles the database directly against
`schema.ts` and will drop hand-written triggers and RLS policies it has no
knowledge of.
