This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Offer Validation And Export

- Run `bunx convex dev` locally to publish the schema and queries before using the updated frontend. Production requires the corresponding Convex deployment before the frontend rollout.
- Matched materials live in `ofertaMateriale`, indexed by offer/row and offer/pending/row. Existing offers migrate their legacy matched-material array on first opening, in an authenticated, idempotent mutation. Saved validations and the offer revision are preserved.
- Offer detail queries return metadata, counts and the global total, never the extracted or matched arrays. Material pages use Convex `.paginate()` and `usePaginatedQuery`; the pending filter runs against the database index.
- HeroUI Pagination displays 20 rows per page. Cursors are discovered incrementally: navigating forward loads the next batch, while previously loaded pages remain cached. Page numbers do not imply a preloaded full result set.
- XLSX export edits the original worksheet XML inside the input ZIP, retaining existing cell style references, row/column dimensions, merged cells and other workbook parts. New price cells reuse adjacent row styles. The original input is never overwritten. Existing output files must be regenerated to benefit from the new exporter.
- Verification: `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run build`. The isolated browser harness is `bun tests/generare-ai-preview.mjs` and uses mocked services only.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
