import { afterEach, expect, test, vi } from "vitest";
import { hybridSearchTypesense, typesenseClient, vectorSearchTypesense } from "./client";

vi.mock("typesense", () => ({ default: { Client: class { multiSearch = { perform: vi.fn() }; } } }));

afterEach(() => vi.restoreAllMocks());

test.each(["vector", "hybrid"] as const)("%s search reports transport and provider errors to the selection dialog", async (mode) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const perform = vi.spyOn(typesenseClient.multiSearch, "perform");
  const search = () => mode === "vector"
    ? vectorSearchTypesense("materiale", [1, 2], "embedding", 1, 20, true)
    : hybridSearchTypesense("materiale", "cablu", [1, 2], 50, "embedding", 1, 20, true);
  perform.mockRejectedValueOnce(new Error("Service unavailable"));
  await expect(search()).rejects.toThrow();
  perform.mockResolvedValueOnce({ results: [{ error: "Unavailable", code: 503 }] } as never);
  await expect(search()).rejects.toThrow();
  perform.mockResolvedValueOnce({ results: [{ found: 0, hits: [] }] } as never);
  await expect(search()).resolves.toMatchObject({ results: [], total: 0 });
});
