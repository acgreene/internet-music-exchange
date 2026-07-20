# Internet Music Exchange

## Getting Started

```sh
nvm use          # Node 24 (from .nvmrc)
pnpm install
```

Run the apps:

```sh
pnpm nx serve api      # API on http://localhost:3000
pnpm nx serve web      # Web app on http://localhost:4200
pnpm nx serve mobile   # Mobile app in the browser on http://localhost:4201
```

## Database

Postgres runs locally through Supabase. We manage the schema via Drizzle, the tables live in
`libs/api/db/src/lib/tables/`, and the migrations are at `libs/api/db/migrations/`.

### Local setup

Requires [Docker](https://www.docker.com) or [OrbStack](https://orbstack.dev).

```sh
supabase start              # local stack with Postgres on port 54332
supabase status             # prints your local keys
cp .env.example .env        # then paste the keys from the line above
pnpm db:migrate             # apply migrations to the local database
```

## Mobile

```sh
pnpm nx cap-sync mobile        # build the app and copy assets into ios/ and android/
pnpm nx cap-open-ios mobile    # open in Xcode (requires Xcode)
pnpm nx cap-open-android mobile # open in Android Studio (requires Android Studio)
```

## Common Commands

```sh
pnpm nx run-many -t build    # build every app
pnpm nx run-many -t test     # unit tests for every project
pnpm nx run-many -t lint     # lint every project (includes boundary rules)
pnpm nx e2e web-e2e          # Playwright end-to-end tests
pnpm nx graph                # visualize the project dependency graph
```

## Generating New Code

[Nx docs library generator reference](https://nx.dev/docs/technologies/typescript/generators#library)

```sh
pnpm nx g @nx/angular:library libs/client/feature-myfeature   # shared client lib
pnpm nx g @nx/js:library libs/shared/util-currency             # typescript lib
pnpm nx list                                                   # see installed plugins
```
