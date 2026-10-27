import { generateKeyPairSync } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
import materialSchema from "../typesense/src/schema";

const root = join(import.meta.dir, "..");
const clientDir = join(root, "client");
const selectorPath = join(clientDir, ".env.convex-selector.local");
const backendEnvPath = join(clientDir, ".env.convex.local");

function serialize(values: Record<string, string>) {
  return Object.entries(values).map(([name, value]) => {
    if (value.includes("'") || /[\r\n]/.test(value)) throw new Error(`Unsupported dotenv value for ${name}.`);
    return `${name}='${value}'`;
  }).join("\n") + "\n";
}

async function mergeEnv(path: string, values: Record<string, string>) {
  const file = Bun.file(path);
  const original = await file.exists() ? await file.text() : "";
  if (original && !(await Bun.file(`${path}.before-local-setup`).exists())) {
    await Bun.write(`${path}.before-local-setup`, original);
  }
  const names = new Set(Object.keys(values));
  const remaining = original.split(/\r?\n/).filter((line) => {
    const name = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/)?.[1];
    return !name || !names.has(name);
  }).join("\n").trimEnd();
  await Bun.write(path, `${remaining}${remaining ? "\n\n" : ""}${serialize(values)}`);
}

async function convex(args: string[]) {
  const child = Bun.spawn([process.execPath, join(clientDir, "node_modules/convex/bin/main.js"),
    ...args, "--env-file", selectorPath], {
    cwd: clientDir, stdout: "pipe", stderr: "inherit",
    // Explicit selector excludes inherited cloud deployment credentials.
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("CONVEX_"))),
  });
  const output = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error(`Local Convex ${args[0]} failed.`);
  return output;
}

async function main() {
  const config = await Bun.file(join(clientDir, ".convex/local/default/config.json")).json();
  if (!Number.isInteger(config.ports?.cloud) || !config.adminKey) {
    throw new Error("Select and start a local Convex deployment before running setup.");
  }
  const convexURL = `http://127.0.0.1:${config.ports.cloud}`;
  await Bun.write(selectorPath, serialize({
    CONVEX_SELF_HOSTED_URL: convexURL,
    CONVEX_SELF_HOSTED_ADMIN_KEY: config.adminKey,
  }));
  const existing = parseEnv(await convex(["env", "list"]));
  const dockerPath = join(import.meta.dir, ".env.dev");
  const dockerEnv = parseEnv(await Bun.file(dockerPath).text());
  if (!dockerEnv.TYPESENSE_DEV_API_KEY || !dockerEnv.LAYA_DEV_API_KEY) {
    throw new Error("Run bun run dev in docker/ first to generate the Docker development credentials.");
  }
  const typesensePort = dockerEnv.TYPESENSE_DEV_PORT || "8108";
  const typesenseURL = `http://127.0.0.1:${typesensePort}`;
  const adminHeaders = { "X-TYPESENSE-API-KEY": dockerEnv.TYPESENSE_DEV_API_KEY };
  const collectionResponse = await fetch(`${typesenseURL}/collections/materiale`, { headers: adminHeaders });
  if (collectionResponse.status === 404) {
    const created = await fetch(`${typesenseURL}/collections`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(materialSchema),
    });
    if (!created.ok) throw new Error(`Could not initialize the local material collection (HTTP ${created.status}): ${await created.text()}`);
    console.log("Initialized the local materiale collection. Existing collections are preserved.");
  } else if (!collectionResponse.ok) {
    throw new Error(`Could not check the local material collection (HTTP ${collectionResponse.status}).`);
  }
  let searchKey = dockerEnv.TYPESENSE_DEV_SEARCH_KEY;
  if (!searchKey) {
    const response = await fetch(`http://127.0.0.1:${typesensePort}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TYPESENSE-API-KEY": dockerEnv.TYPESENSE_DEV_API_KEY },
      body: JSON.stringify({ description: "Local development search", actions: ["documents:search"], collections: ["materiale"] }),
    });
    if (!response.ok) throw new Error(`Local Typesense key creation failed: HTTP ${response.status}`);
    const result = await response.json() as { value?: string };
    searchKey = result.value;
    if (!searchKey) throw new Error("Typesense returned no search key.");
    await mergeEnv(dockerPath, { TYPESENSE_DEV_SEARCH_KEY: searchKey });
  }
  const backend: Record<string, string> = {
    TYPESENSE_HOST: "127.0.0.1",
    TYPESENSE_PORT: typesensePort,
    TYPESENSE_PROTOCOL: "http",
    TYPESENSE_SEARCH_KEY: searchKey,
    TYPESAFE_BASE_URL: `http://127.0.0.1:${dockerEnv.LAYA_DEV_PORT || "8081"}`,
    TYPESAFE_API_KEY: dockerEnv.LAYA_DEV_API_KEY,
    SITE_URL: "http://localhost:3000",
  };
  if (!existing.JWT_PRIVATE_KEY || !existing.JWKS) {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    backend.JWT_PRIVATE_KEY = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString().trimEnd().replace(/\n/g, " ");
    backend.JWKS = JSON.stringify({ keys: [{ use: "sig", ...keys.publicKey.export({ format: "jwk" }) }] });
  }
  const clientEnvPath = join(clientDir, ".env.local");
  const clientEnv = parseEnv(await Bun.file(clientEnvPath).text());
  if (!existing.GROQ_API_KEY && clientEnv.GROQ_API_KEY) backend.GROQ_API_KEY = clientEnv.GROQ_API_KEY;
  await Bun.write(backendEnvPath, serialize(backend));
  await convex(["env", "set", "--force", "--from-file", backendEnvPath]);
  await mergeEnv(clientEnvPath, {
    NEXT_PUBLIC_CONVEX_URL: convexURL,
    NEXT_PUBLIC_CONVEX_SITE_URL: `http://127.0.0.1:${config.ports.site}`,
    NEXT_PUBLIC_TYPESENSE_HOST: "127.0.0.1",
    NEXT_PUBLIC_TYPESENSE_PORT: typesensePort,
    NEXT_PUBLIC_TYPESENSE_PROTOCOL: "http",
    NEXT_PUBLIC_TYPESENSE_SEARCH_KEY: searchKey,
    TYPESENSE_API_KEY: dockerEnv.TYPESENSE_DEV_API_KEY,
    OLLAMA_BASE_URL: `http://127.0.0.1:${dockerEnv.OLLAMA_DEV_PORT || "11435"}`,
    OLLAMA_EMBEDDING_MODEL: "nomic-embed-text:v1.5",
  });
  await mergeEnv(join(root, "typesense/.env.local"), {
    TYPESENSE_HOST: "127.0.0.1", TYPESENSE_PORT: typesensePort,
    TYPESENSE_PROTOCOL: "http", TYPESENSE_API_KEY: dockerEnv.TYPESENSE_DEV_API_KEY,
  });
  const applied = parseEnv(await convex(["env", "list"]));
  for (const [name, value] of Object.entries(backend)) {
    if (applied[name] !== value) throw new Error(`Local Convex did not retain ${name}.`);
  }
  if (process.argv.includes("--verify")) {
    // The selector contains only the existing backend's localhost URL and key.
    // Unlike `dev`, this reuses it without rewriting deployment selection.
    await convex(["deploy", "--yes"]);
  }
  console.log("Configured and verified local Convex, client/.env.local, and typesense/.env.local. Secrets were not printed.");
  if (!applied.GROQ_API_KEY) console.log("GROQ_API_KEY is not available locally; automatic spreadsheet analysis needs your development Groq key. Manual mapping is available.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await unlink(selectorPath).catch(() => {});
});
