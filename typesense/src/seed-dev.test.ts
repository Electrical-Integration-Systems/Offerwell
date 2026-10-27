import { afterAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { developmentSeedDocuments, seedDevelopmentCatalog } from "./seed-dev";
import type { Material } from "./types";

const materials: Material[] = [
  { descriere: "Cablu", pretAchizitie: 1, pretVanzare: 2, manopera: 0.5 },
  { descriere: "Cablu", pretAchizitie: 3, pretVanzare: 4, manopera: 1 },
  { descriere: "Tub", pretAchizitie: 5, pretVanzare: 6, manopera: 2 },
];
const directories: string[] = [];
afterAll(async () => {
  for (const directory of directories) {
    for (const name of ["seed.json", "seed.json.tmp"]) await unlink(join(directory, name)).catch(() => {});
    await rmdir(directory);
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "offerwell-seed-"));
  directories.push(directory);
  const documents = new Map<string, Material & { id: string }>();
  const requests: { url: string; method: string }[] = [];
  let createdAt = 1;
  let exists = false;
  let failDescription: string | undefined;
  let hasModel = true;
  let healthFailures = 0;
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    requests.push({ url, method: init?.method ?? "GET" });
    if (url.endsWith("/health")) return healthFailures-- > 0 ? new Response("Starting", { status: 503 }) : Response.json({ ok: true });
    if (url.endsWith("/api/tags")) return Response.json({ models: hasModel ? [{ name: "nomic-embed-text:v1.5" }] : [] });
    if (url.endsWith("/api/pull")) { hasModel = true; return Response.json({ status: "success" }); }
    if (url.endsWith("/collections/materiale")) return exists
      ? Response.json({ created_at: createdAt, num_documents: documents.size }) : new Response("Not found", { status: 404 });
    if (url.endsWith("/collections")) { exists = true; return Response.json({ created_at: createdAt, num_documents: 0 }); }
    if (url.includes("/documents/import?action=create")) {
      const results = (init!.body as string).split("\n").map((line) => {
        const document = JSON.parse(line) as Material & { id: string };
        if (documents.has(document.id)) return { success: false, code: 409 };
        if (document.descriere === failDescription) return { success: false, code: 400, error: "Embedding failed" };
        documents.set(document.id, document);
        return { success: true };
      });
      return new Response(results.map((result) => JSON.stringify(result)).join("\n"));
    }
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;
  const statePath = join(directory, "seed.json");
  const run = (rows = materials) => seedDevelopmentCatalog(rows, { apiKey: "dev-key", statePath, fetcher, sleep: async () => {} });
  return { documents, requests, run, statePath,
    fail: (description?: string) => { failDescription = description; },
    missingModel: () => { hasModel = false; },
    starting: () => { healthFailures = 2; },
    recreate: () => { exists = false; createdAt++; documents.clear(); },
  };
}

test("source IDs survive price edits and inserted rows while preserving duplicate descriptions", () => {
  const original = developmentSeedDocuments(materials);
  expect(new Set(original.map((document) => document.id)).size).toBe(3);
  const changed = developmentSeedDocuments([{ ...materials[2]!, descriere: "Nou" }, ...materials.map((row) => ({ ...row, pretAchizitie: 99 }))]);
  expect(changed.slice(1).map((document) => document.id)).toEqual(original.map((document) => document.id));
});

test("fresh development collections wait for readiness, install the model, and import every source row", async () => {
  const state = await fixture();
  state.starting();
  state.missingModel();
  expect(await state.run()).toEqual({ imported: 3, existing: 0, skipped: false });
  expect(state.documents.size).toBe(3);
  expect(state.requests.some(({ url }) => url.endsWith("/api/pull"))).toBe(true);
  expect(JSON.parse(await readFile(state.statePath, "utf8"))).toHaveProperty("datasetHash");
});

test("normal restarts do not reimport or overwrite prices edited through the app", async () => {
  const state = await fixture();
  await state.run();
  const id = developmentSeedDocuments(materials)[0]!.id;
  state.documents.get(id)!.pretAchizitie = 777;
  state.requests.length = 0;
  expect((await state.run()).skipped).toBe(true);
  expect(state.documents.get(id)!.pretAchizitie).toBe(777);
  expect(state.requests.some(({ url }) => url.includes("/documents/import"))).toBe(false);
});

test("partial failures are retried without duplicates and without marking an incomplete import successful", async () => {
  const state = await fixture();
  state.fail("Tub");
  await expect(state.run()).rejects.toThrow("Embedding failed");
  await expect(readFile(state.statePath, "utf8")).rejects.toThrow();
  state.fail();
  expect(await state.run()).toEqual({ imported: 1, existing: 2, skipped: false });
  expect(state.documents.size).toBe(3);
});

test("changed CSV files add new rows while preserving existing catalog prices", async () => {
  const state = await fixture();
  await state.run();
  const id = developmentSeedDocuments(materials)[0]!.id;
  state.documents.get(id)!.pretVanzare = 999;
  expect(await state.run([...materials, { ...materials[2]!, descriere: "Material nou" }])).toEqual({ imported: 1, existing: 3, skipped: false });
  expect(state.documents.size).toBe(4);
  expect(state.documents.get(id)!.pretVanzare).toBe(999);
});

test("recreated collections are populated even when a previous completion marker exists", async () => {
  const state = await fixture();
  await state.run();
  state.recreate();
  expect(await state.run()).toEqual({ imported: 3, existing: 0, skipped: false });
});
