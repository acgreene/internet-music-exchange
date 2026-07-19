# client-env

Validated environment variables for the client apps and libs.

```ts
import { clientEnv } from '@ime/client-env';

createClient(clientEnv.SUPABASE_URL, clientEnv.SUPABASE_ANON_KEY);
```

Browsers cannot read `.env` the way the API does, so the values are baked in at
build time: `tools/generate-client-env.mjs` reads the repo-root `.env` and
writes `src/lib/generated-env.ts`, which is gitignored and never committed.
`client-env.ts` validates that module on first import, so a missing or
malformed variable fails loudly instead of surfacing as a confusing runtime
error.

Nx runs the generator through the `client-env:generate-env` target, wired as a
dependency of the client build, serve, test, and lint targets. Run it directly
with `nx run client-env:generate-env` if you need the file without a build.

## Adding a variable

Add it to `clientEnvSchema` in `src/lib/client-env-schema.ts`, and to `.env`.
That's it — the generator imports that schema and bakes in whatever it names,
so the list lives in exactly one place.

## Why this is separate from `@ime/env`

Everything named in `clientEnvSchema` is compiled into the browser bundle and is
public. `@ime/env` holds the API's variables, including secrets like
`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`, which must never reach a client.

The two schemas are kept apart on purpose: sharing one would make it possible to
expose a secret by adding a single line, with nothing failing to catch it. The
cost is that a variable both sides need — currently just the Supabase URL and
publishable key — gets declared in both places. That duplication is the point.
