import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parseEnv } from "node:util";

const directory = import.meta.dir;
const envPath = join(directory, ".env.dev");
const action = process.argv[2] ?? "up";
const actions = ["up", "down", "logs", "ps", "config", "model", "key"];

async function run(args: string[], capture = false) {
  // Bun may auto-load the production .env. Always use .env.dev for dev values,
  // including for Compose interpolation (shell variables otherwise win).
  const env = { ...process.env, ...(await Bun.file(envPath).exists() ? parseEnv(await Bun.file(envPath).text()) : {}) };
  const child = Bun.spawn(args, { cwd: directory, env, stdin: "inherit", stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  const output = capture ? await new Response(child.stdout).text() : "";
  const code = await child.exited;
  if (code !== 0) throw new Error(`${args.slice(0, 2).join(" ")} failed (exit ${code}).`);
  return output;
}

async function main() {
  if (!actions.includes(action)) throw new Error(`Usage: bun run dev.ts [${actions.join("|")}]`);
  if (!Bun.which("docker")) throw new Error("Docker is not installed or is not on PATH.");
  await run(["docker", "compose", "version"]);
  if (!(await Bun.file(envPath).exists())) {
    const template = await Bun.file(join(directory, ".env.dev.example")).text();
    await Bun.write(envPath, template
      .replace("<GENERATE_TYPESENSE_DEV_KEY>", randomBytes(32).toString("hex"))
      .replace("<GENERATE_LAYA_DEV_KEY>", randomBytes(32).toString("hex")));
    console.log("Created docker/.env.dev with separate development credentials.");
  }
  const compose = ["docker", "compose", "--project-name", "offerwell-dev", "--env-file", envPath,
    "-f", join(directory, "docker-compose.dev.yml")];
  if (action === "config") return run([...compose, "config", "--quiet"]);
  await run(["docker", "info", "--format", "{{.ServerVersion}}"]);
  if (action === "model") {
    return run([...compose, "exec", "ollama", "ollama", "pull", "nomic-embed-text:v1.5"]);
  }
  if (action === "key") {
    const env = parseEnv(await Bun.file(envPath).text());
    const response = await fetch(`http://127.0.0.1:${env.TYPESENSE_DEV_PORT || "8108"}/keys`, {
      method: "POST",
      headers: { "X-TYPESENSE-API-KEY": env.TYPESENSE_DEV_API_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Local browser search", actions: ["documents:search"], collections: ["materiale"] }),
    });
    if (!response.ok) throw new Error(`Could not create search key (HTTP ${response.status}). Check Typesense is ready and the development admin key matches.`);
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }
  const args = action === "up" ? ["up", "-d", "--build"] : action === "logs" ? ["logs", "--follow", "--tail", "100"] : [action];
  await run([...compose, ...args]);
  if (action === "up") {
    console.log("Waiting for the development CSV import...");
    try {
      await run([...compose, "wait", "typesense-seed"]);
    } finally {
      await run([...compose, "logs", "--no-log-prefix", "typesense-seed"]);
    }
    const code = await run([...compose, "ps", "--all", "--format", "{{.ExitCode}}", "typesense-seed"], true);
    if (code.trim() !== "0") throw new Error("Development CSV import failed. See the typesense-seed logs above.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
