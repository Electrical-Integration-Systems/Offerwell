import { afterEach, expect, test, vi } from "vitest";
import { GET } from "./route";
import { getCatalogPage } from "@/lib/typesense/catalog";

vi.mock("@/lib/typesense/catalog", () => ({ getCatalogPage: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test.each(["page=0", "page=-1", "page=Infinity", "page=1.5", "sort=embedding", "direction=drop", "page=9007199254740992"])("rejects invalid catalog parameters: %s", async (params) => {
  expect((await GET(new Request(`http://localhost/api/catalog?${params}`))).status).toBe(400);
  expect(getCatalogPage).not.toHaveBeenCalled();
});

test("returns a page sorted on the server and disables shared caching", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  vi.mocked(getCatalogPage).mockResolvedValue({ materials: [], total: 0, page: 2, hasMore: false });
  const response = await GET(new Request("http://localhost/api/catalog?page=2&sort=manopera&direction=desc"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(getCatalogPage).toHaveBeenCalledWith(2, "manopera", "desc");
});

test("upstream failures return a retryable message without internal details", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  vi.mocked(getCatalogPage).mockRejectedValue(new Error("secret/internal"));
  const response = await GET(new Request("http://localhost/api/catalog"));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("secret");
});
