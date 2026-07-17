# Internet Music Exchange

## Getting Started

```sh
nvm use          # Node 24 (from .nvmrc)
pnpm install
```

Run the apps (in separate terminals):

```sh
pnpm nx serve api      # Hono API on http://localhost:3000
pnpm nx serve web      # Web app on http://localhost:4200
pnpm nx serve mobile   # Mobile app in the browser on http://localhost:4201
```

Both client dev servers proxy `/api/*` to the Hono server, so clients use relative URLs.

## Mobile (Capacitor)

Mobile UI work happens in the browser via `pnpm nx serve mobile`. To run inside the native shells:

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

```sh
pnpm nx g @nx/angular:library libs/client/feature-storefront   # shared client lib
pnpm nx g @nx/js:library libs/shared/util-currency             # isomorphic lib
pnpm nx list                                                   # see installed plugins
```
