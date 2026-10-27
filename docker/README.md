# Local development

Run Next.js and Convex on your computer, with Typesense, Ollama, and Laya in
Docker Desktop (Linux containers). Install Bun and a Node.js version supported
by Convex for Node actions.

The development stack is a standalone Compose file. It uses the `offerwell-dev`
project, private named volumes, localhost ports, and `docker/.env.dev`. It has no
Cloudflare tunnel or Open WebUI. The production `docker-compose.yml` is unchanged.
Do not combine the two Compose files with multiple `-f` options.

## Start services

From `docker/`:

```sh
bun run check
bun run dev
bun run search-key
```

The runner creates `.env.dev` with random development credentials if absent.
Its development values take precedence over variables Bun loads from `.env`.
Startup automatically waits for Typesense and Ollama, downloads
`nomic-embed-text:v1.5` if missing, and imports
`typesense/collections/materiale.csv`. `bun run dev` waits for the import to finish
and fails if any row cannot be imported. The `typesense-seed` service runs once
per startup and then exits successfully; this is expected. Its state is stored
in the separate `typesense-seed-data` volume.

`search-key` prints JSON; copy its `value` into the client's
`NEXT_PUBLIC_TYPESENSE_SEARCH_KEY`. Run it once and keep that key. Never use the
admin key as a public search key.

Laya builds an image with CPU-only PyTorch and downloads model weights on first
startup; this can take several minutes and needs disk space and RAM. Dependencies
are cached in the image rather than reinstalled on every restart, using
[PyTorch's CPU wheel index](https://pytorch.org/get-started/previous-versions/). Docker
reporting a container as running does not mean the model is ready. Inspect
`bun run logs` for errors and readiness. The Hugging Face cache persists.

| Service | Host URL | Container URL |
| --- | --- | --- |
| Typesense | http://127.0.0.1:8108 | http://typesense:8108 |
| Ollama | http://127.0.0.1:11435 | http://ollama:11434 |
| Laya | http://127.0.0.1:8081 | http://laya:8000 |

If a host port is occupied, change its `*_DEV_PORT` in `.env.dev` and the
corresponding client, importer, and Convex settings. Container ports remain the
same. Use `bun run status`, `bun run logs`, and `bun run down` to manage the
stack. `down` preserves all local data. The runner also works from the repository
root: `bun run docker/dev.ts`, `bun run docker/dev.ts model`, etc.

## Configure the client

Merge [client/.env.example](../client/.env.example) into `client/.env.local`,
preserving any unrelated settings. Set:

```dotenv
NEXT_PUBLIC_TYPESENSE_HOST=127.0.0.1
NEXT_PUBLIC_TYPESENSE_PORT=8108
NEXT_PUBLIC_TYPESENSE_PROTOCOL=http
NEXT_PUBLIC_TYPESENSE_SEARCH_KEY=<value from bun run search-key>
TYPESENSE_API_KEY=<TYPESENSE_DEV_API_KEY from docker/.env.dev>
OLLAMA_BASE_URL=http://127.0.0.1:11435
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:v1.5
```

The Typesense host must be a hostname without a scheme or port. The private
admin key is used by Next.js API routes; the public search key is used by the
browser. Restart Next.js after editing public environment variables. Production
continues to default to Typesense HTTPS on port 443 when the new port and protocol
variables are absent. For production embeddings, leave `OLLAMA_BASE_URL` unset
to retain the existing Open WebUI connection.

## Use a local Convex deployment

A cloud Convex function cannot reach your computer's `127.0.0.1`. Select a local
deployment so offer matching uses the local services too. From `client/`:

```sh
bun install
bunx convex deployment select local
bunx convex dev
```

If there is no configured project yet, run
`bunx convex dev --configure --dev-deployment local` instead. Let the CLI update
`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` in
`.env.local`. Do not copy the production deployment URLs or deploy key. Keep
`convex dev` running while configuring the backend in another terminal.

Convex function environment variables belong to the deployment, not Next.js's
`.env.local`. In another terminal in `client/`, set:

Alternatively, after the local Convex backend is running, run `bun run setup:local`
from `docker/`. This configures the local deployment directly, sets the client and
importer environment files, creates a reusable search-only key, and generates
Convex Auth signing keys if missing. Existing environment files are backed up
before editing. The backend variables are saved in the ignored
`client/.env.convex.local`; this file does not contain the local Convex admin key.
Existing auth keys and unrelated variables are preserved. Set `GROQ_API_KEY`
separately if you need automatic spreadsheet analysis.
Add `--verify` to push the functions to that local backend and verify loading.
The helper also creates the `materiale` collection if missing, using the importer
schema, so the home page can query a fresh local instance. Existing collections
and documents are preserved. The Compose startup populates the CSV automatically.

For manual configuration, run these commands in `client/`:

```sh
bunx convex env set TYPESENSE_HOST 127.0.0.1
bunx convex env set TYPESENSE_PORT 8108
bunx convex env set TYPESENSE_PROTOCOL http
bunx convex env set TYPESENSE_SEARCH_KEY <local-search-only-key>
bunx convex env set TYPESAFE_BASE_URL http://127.0.0.1:8081
bunx convex env set TYPESAFE_API_KEY <LAYA_DEV_API_KEY-from-docker/.env.dev>
bunx convex env set SITE_URL http://localhost:3000
bunx convex env set GROQ_API_KEY <your-development-Groq-key>
```

Replace angle-bracket placeholders with actual values before running commands.
`GROQ_API_KEY` powers automatic spreadsheet analysis; manual mapping remains
available without it. `TYPESAFE_*` are the variable names read by the installed
SDK for Laya. Do not prefix these secrets with `NEXT_PUBLIC_`.

The new Convex deployment also needs its own Convex Auth `JWT_PRIVATE_KEY` and
`JWKS`. Run `bunx @convex-dev/auth` in `client/` and follow its setup for the
selected local deployment. Set its site URL to `http://localhost:3000`.
Local users and application data are separate from production; create a local
account. The [Convex local deployment guide](https://docs.convex.dev/cli/local-deployments)
describes deployment selection and lifecycle.

After this first-time setup, stop the standalone `convex dev` process and run
`bun run dev` in `client/` to start both Convex and Next.js. Open
http://localhost:3000.

## Populate local search data

The development Compose file includes a `typesense-seed` service. No separate
import command or `typesense/.env.local` is needed for automatic initialization.
The service only connects to the internal development Typesense and Ollama
services, using the development admin key.

The CSV is mounted read-only, and descriptions use the same normalization as the
manual importer. Stable source IDs and a completion marker prevent duplicate
imports on restarts. If a previous import failed, startup retries missing rows.
Existing records are never overwritten or deleted: prices edited through the
application and newly added catalog materials are preserved. Changing the CSV
adds new source rows; it does not reset prices on existing rows or remove them.
Recreating the collection or removing its data volume triggers initialization
again even if the completion marker remains.

To inspect the import from `docker/`:

```sh
docker compose --project-name offerwell-dev --env-file .env.dev -f docker-compose.dev.yml logs typesense-seed
```

The standalone `bun run upload` command in `typesense/` remains available for
intentional full replacements. It **deletes and recreates** `materiale` at the
host configured in `typesense/.env.local`; it is not used during startup.
Typesense reaches Ollama through `http://ollama:11434` inside the Compose network.

## Production

On the production server, keep using `docker compose up -d` with
`docker/.env`. Its variables are `TYPESENSE_API_KEY`, `LAYA_API_KEY`, and
`CLOUDFLARE_TUNNEL_TOKEN` (the old example incorrectly called this `TUNNEL_TOKEN`).
Development credentials and volumes are independent of these.
