## Migrations

[Drizzle](https://orm.drizzle.team) generates tables, columns, constraints, indexes, and RLS policies.
Unfortunately, db functions and triggers need to be hand written-
see more about this in [this Github issue](https://github.com/drizzle-team/drizzle-orm/issues/843).

### Changing the schema

> [IMPORTANT]
> **Every new table should have at least one `pgPolicy()`.**
>
> A table with no policies has RLS disabled
> and is readable and writable by unauthenticated (anon) users. Declaring any policy enables RLS.

1. Edit or add a table in `libs/api/db/src/lib/tables/`.
2. Export it from `tables/index.ts` if it's new.
3. Generate and apply:
   ```sh
   pnpm db:generate --name=description_of_your_changes
   pnpm db:migrate
   ```

To write SQL for a change that has no drizzle schema diff at all
(i.e., functions or triggers that can't be defined via the drizzle sdk),
create an empty migration and fill it in:

```sh
pnpm db:generate --custom --name=some_function
```

**Note**: Don't run `drizzle-kit push`! It reconciles the database directly against                                                                                               
`schema.ts`, bypassing the migration files. So it creates RLS policies with                                                                                            
empty expressions (denying everything) and skips the hand written grants,                                                                                               
functions, and triggers. The result looks structurally correct and                                                                                             
denies every query.

### Pointing at production instead of local

Swap the four Supabase values in `.env` for the hosted ones, then restart
your dev servers. Switch back by restoring the local values.

### Applying migrations to production

1. Commit and merge your migration files first.
2. Point `DATABASE_URL` at the hosted database. Use the **direct connection**
   (port 5432), not the transaction pooler (6543), migrations need a session.
3. Apply and verify:
   ```sh
   pnpm db:migrate
   pnpm db:generate      # should report "No schema changes" if it worked
   ```
4. Restore your local `DATABASE_URL`.

### Everyday commands

```sh
pnpm db:studio                              # browse data
supabase status                             # local URLs and keys
supabase stop                               # shut the stack down
supabase db reset && pnpm db:migrate        # wipe and rebuild local db
```

`db reset` empties `auth.users` too, so local test logins need recreating.

## Running unit tests

Run `nx test db` to execute the unit tests via [Vitest](https://vitest.dev/).
