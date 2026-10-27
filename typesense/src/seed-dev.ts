import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadMaterialsFromCSV } from "./csv";
import schema from "./schema";
import type { Material } from "./types";

const typesenseURL = "http://typesense:8108";
const ollamaURL = "http://ollama:11434";
const model = "nomic-embed-text:v1.5";
type SeedState = { datasetHash: string; collectionCreatedAt: number };
type Collection = { created_at: number; num_documents: number };
type ImportResult = { success: boolean; code?: number; error?: string };

export function developmentSeedDocuments(materials: Material[]) {
  const occurrences = new Map<string, number>();
  return materials.map((material) => {
    const occurrence = occurrences.get(material.descriere) ?? 0;
    occurrences.set(material.descriere, occurrence + 1);
    return { ...material,
      id: `dev-csv-${createHash("sha256").update(JSON.stringify([material.descriere, occurrence])).digest("hex")}`,
    };
  });
}

export async function seedDevelopmentCatalog(materials: Material[], options: {
  apiKey: string; statePath: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<unknown>;
}) {
  if (!options.apiKey) throw new Error("TYPESENSE_DEV_API_KEY is required for development seeding.");
  if (!materials.length) throw new Error("The development CSV contains no materials.");
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? Bun.sleep;
  const headers = { "X-TYPESENSE-API-KEY": options.apiKey };
  const documents = developmentSeedDocuments(materials);
  const datasetHash = createHash("sha256").update(JSON.stringify(documents)).digest("hex");

  async function waitFor(url: string) {
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) return;
      } catch { /* Services may still be starting. */ }
      await sleep(2000);
    }
    throw new Error(`Development service did not become ready: ${url}`);
  }

  console.log("Waiting for development Typesense and Ollama...");
  await Promise.all([waitFor(`${typesenseURL}/health`), waitFor(`${ollamaURL}/api/tags`)]);
  let state: SeedState | undefined;
  try {
    state = JSON.parse(await readFile(options.statePath, "utf8")) as SeedState;
  } catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetcher(`${typesenseURL}/collections/materiale`, { headers });
  if (!response.ok && response.status !== 404) throw new Error(`Checking the development collection failed: HTTP ${response.status}`);
  let collection = response.ok ? await response.json() as Collection : undefined;
  if (collection && collection.num_documents > 0 && state?.datasetHash === datasetHash && state.collectionCreatedAt === collection.created_at) {
    console.log(`Development CSV already initialized (${materials.length} source rows). Existing catalog changes are preserved.`);
    return { imported: 0, existing: materials.length, skipped: true };
  }

  const tagsResponse = await fetcher(`${ollamaURL}/api/tags`);
  if (!tagsResponse.ok) throw new Error(`Checking Ollama models failed: HTTP ${tagsResponse.status}`);
  const tags = await tagsResponse.json() as { models: { name: string }[] };
  if (!tags.models.some((entry) => entry.name === model)) {
    console.log(`Downloading development embedding model ${model}...`);
    const pulled = await fetcher(`${ollamaURL}/api/pull`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false }), signal: AbortSignal.timeout(600_000),
    });
    const result = await pulled.json() as { status?: string; error?: string };
    if (!pulled.ok || result.error || result.status !== "success") throw new Error(`Ollama model download failed: ${result.error ?? pulled.status}`);
  }
  if (!collection) {
    const created = await fetcher(`${typesenseURL}/collections`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(schema),
      signal: AbortSignal.timeout(120_000),
    });
    if (!created.ok) throw new Error(`Creating the development collection failed: HTTP ${created.status}`);
    collection = await created.json() as Collection;
  }

  let imported = 0;
  let existing = 0;
  for (let offset = 0; offset < documents.length; offset += 25) {
    const batch = documents.slice(offset, offset + 25);
    const importedResponse = await fetcher(`${typesenseURL}/collections/materiale/documents/import?action=create`, {
      method: "POST", headers: { ...headers, "Content-Type": "text/plain" },
      body: batch.map((document) => JSON.stringify(document)).join("\n"), signal: AbortSignal.timeout(120_000),
    });
    if (!importedResponse.ok) throw new Error(`Importing the development CSV failed: HTTP ${importedResponse.status}`);
    const results = (await importedResponse.text()).trim().split("\n").map((line) => JSON.parse(line) as ImportResult);
    if (results.length !== batch.length) throw new Error("Typesense returned an incomplete development import response.");
    for (const result of results) {
      if (result.success) imported++;
      // Create-only imports keep prices edited in the app and safely retry
      // partially completed imports without duplicating source rows.
      else if (result.code === 409) existing++;
      else throw new Error(`Development material import failed: ${result.error ?? result.code}`);
    }
    console.log(`Development CSV: ${Math.min(offset + 25, documents.length)}/${documents.length} rows processed.`);
  }
  await mkdir(dirname(options.statePath), { recursive: true });
  await writeFile(`${options.statePath}.tmp`, JSON.stringify({ datasetHash, collectionCreatedAt: collection.created_at } satisfies SeedState));
  await rename(`${options.statePath}.tmp`, options.statePath);
  console.log(`Development catalog ready: ${imported} imported, ${existing} existing materials preserved.`);
  return { imported, existing, skipped: false };
}

if (import.meta.main) {
  try {
    if (process.env.OFFERWELL_DEV_SEED !== "true") throw new Error("Run the development seed through docker/docker-compose.dev.yml.");
    const materials = await loadMaterialsFromCSV(resolve(import.meta.dir, "../collections/materiale.csv"));
    await seedDevelopmentCatalog(materials, { apiKey: process.env.TYPESENSE_DEV_API_KEY ?? "", statePath: "/state/materiale.json" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
