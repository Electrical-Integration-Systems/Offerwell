// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { POST } from "./route";
import { importaMateriale } from "@/lib/typesense/admin";

vi.mock("@/lib/typesense/admin", () => ({ importaMateriale: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

function request(csv: string, origin = "http://localhost") {
  const body = new FormData();
  body.set("file", new File([csv], "materiale.csv"));
  return new Request("http://localhost/api/material/import", { method: "POST", body, headers: { origin } });
}
const valid = "descriere,pretAchizitie,pretVanzare,manopera,,\nCablu,1.5,0,2,,\nTub,2,3,0,,";

test("validates the entire file before writing any materials", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  const response = await POST(request(valid + "\nInvalid,-1,0,0,,"));
  expect(response.status).toBe(400);
  expect(importaMateriale).not.toHaveBeenCalled();
});

test("returns success with the number of saved materials", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  vi.mocked(importaMateriale).mockResolvedValue([{ success: true }, { success: true }]);
  const response = await POST(request(valid));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ imported: 2, total: 2, failedRows: [] });
  expect(vi.mocked(importaMateriale).mock.calls[0][0][0].pretVanzare).toBe(1.875);
});

test("reports partially saved imports and source row numbers", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  vi.mocked(importaMateriale).mockResolvedValue([{ success: true }, { success: false, error: "invalid", code: 400 }]);
  const response = await POST(request(valid));
  expect(response.status).toBe(207);
  expect(await response.json()).toEqual({ imported: 1, total: 2, failedRows: [3] });
});

test("rejects foreign origins and missing configuration without writing", async () => {
  expect((await POST(request(valid, "http://elsewhere"))).status).toBe(403);
  vi.stubEnv("TYPESENSE_API_KEY", "");
  expect((await POST(request(valid))).status).toBe(503);
  expect(importaMateriale).not.toHaveBeenCalled();
});

test("reports uncertain save state when the catalog connection fails", async () => {
  vi.stubEnv("TYPESENSE_API_KEY", "test");
  vi.mocked(importaMateriale).mockRejectedValue(new Error("timeout"));
  const response = await POST(request(valid));
  expect(response.status).toBe(502);
  expect((await response.json()).error).toContain("Unele materiale pot fi deja salvate");
});
