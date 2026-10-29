# Offerwell

## Prerequisite

* .env.local (See: [.env.example](./.env.example))
* [bun](https://bun.com/)\

## Install modules

```sh
bun install
```

## Local development

Follow the [local Docker and Convex setup](../docker/README.md) to start the
services, configure `.env.local`, and initialize local search and authentication.
Then run `bun run dev` here and open http://localhost:3000.

## Vercel deployment

Set the Vercel project's Root Directory to `client`. `vercel.json` runs
`npx convex deploy --cmd "npm run build" --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`
to build Next.js against the selected backend and deploy the Convex functions,
schema, and indexes. A failed build or Convex deploy fails the Vercel build.

In Vercel Settings > Environment Variables, set `CONVEX_DEPLOY_KEY`:

* **Production:** generate a production deploy key in the production deployment's
  Convex Settings > General, with the `deployment:deploy` permission.
* **Preview:** generate a separate preview deploy key in Convex project settings.
  Each branch gets a separate backend and data; do not use the production key here.

`NEXT_PUBLIC_CONVEX_URL` is supplied automatically to the Next.js build. Do not
copy the local `CONVEX_DEPLOYMENT` or localhost Convex URLs into Vercel.

Configure backend secrets separately in Convex Dashboard > Settings > Environment
Variables for the target deployment (and project defaults for new previews):

* `JWT_PRIVATE_KEY` and matching `JWKS` for Convex Auth; initialize these once per
  deployment, preserving existing keys.
* `SITE_URL`: the frontend's public HTTPS URL for auth redirects.
* `GROQ_API_KEY`: automatic Excel analysis.
* `TYPESAFE_API_KEY` and `TYPESAFE_BASE_URL`: AI material matching/pricing.
* `TYPESENSE_SEARCH_KEY`: search-only key used by Convex functions;
  `TYPESENSE_HOST`, `TYPESENSE_PORT`, and `TYPESENSE_PROTOCOL` override their defaults.

`CONVEX_SITE_URL` is provided by Convex Cloud itself. Vercel variables are not
automatically copied into the Convex backend.

The existing frontend/server integrations still need their Vercel variables:
`NEXT_PUBLIC_TYPESENSE_HOST`, `NEXT_PUBLIC_TYPESENSE_PORT`,
`NEXT_PUBLIC_TYPESENSE_PROTOCOL`, `NEXT_PUBLIC_TYPESENSE_SEARCH_KEY`, and
server-only `TYPESENSE_API_KEY`. For embeddings, configure `OPEN_WEBUI_BASE_URL`
and `OPEN_WEBUI_API_KEY`, or a reachable `OLLAMA_BASE_URL` and optional
`OLLAMA_EMBEDDING_MODEL`. Local Docker addresses are not reachable from Vercel.

See the [official Convex/Vercel deployment guide](https://docs.convex.dev/production/hosting/vercel).
