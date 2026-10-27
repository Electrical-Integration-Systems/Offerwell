import { afterEach, expect, test, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = () => new Request("http://localhost/api/embedding", {
  method: "POST",
  body: JSON.stringify({ descriere: "Cablu" }),
});

test("local embeddings go directly to Ollama with the catalog model and no WebUI credentials", async () => {
  vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/");
  vi.stubEnv("OLLAMA_EMBEDDING_MODEL", "");
  vi.stubEnv("OPEN_WEBUI_BASE_URL", "https://production.example");
  vi.stubEnv("OPEN_WEBUI_API_KEY", "production-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ embeddings: [[1, 2]] }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(request());
  expect(await response.json()).toEqual({ embedding: [1, 2] });
  expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:11434/api/embed", expect.objectContaining({
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text:v1.5", input: "Cablu" }),
  }));
});

test("production retains its WebUI endpoint, authorization, and model default", async () => {
  vi.stubEnv("OLLAMA_BASE_URL", "");
  vi.stubEnv("OLLAMA_EMBEDDING_MODEL", "");
  vi.stubEnv("OPEN_WEBUI_BASE_URL", "https://webui.example/");
  vi.stubEnv("OPEN_WEBUI_API_KEY", "webui-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ embeddings: [[3]] }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await POST(request())).status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith("https://webui.example/ollama/api/embed", expect.objectContaining({
    headers: { "Content-Type": "application/json", Authorization: "Bearer webui-key" },
    body: JSON.stringify({ model: "nomic-embed-text:latest", input: "Cablu" }),
  }));
});

test("missing service configuration returns 503 without calling fetch", async () => {
  vi.stubEnv("OLLAMA_BASE_URL", "");
  vi.stubEnv("OPEN_WEBUI_BASE_URL", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect((await POST(request())).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
