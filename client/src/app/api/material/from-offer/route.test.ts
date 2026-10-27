// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { POST } from "./route";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { saveOfferMaterial } from "@/lib/typesense/offer-catalog";

vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));
vi.mock("@/lib/typesense/offer-catalog", () => ({ saveOfferMaterial: vi.fn(), CatalogConflict: class extends Error {} }));

const body = { idGenerare: "offer-id", expectedRevision: 7, rand: 2, sheetName: "Lista", mode: "create", descriere: "Cablu nou" };
const material = { rand: 2, descriereOriginala: "Cablu", descriereGasita: "Cablu catalog", cantitate: 10, unitate: "m",
  validated: true, matchScore: 10, pretAchizitie: 1.5, pretVanzare: 2.25, manopera: 0.75 };
const request = (data: unknown = body, origin = "http://localhost") => new Request("http://localhost/api/material/from-offer", {
  method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(data),
});
afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TYPESENSE_API_KEY", "test-admin-key");
  vi.mocked(convexAuthNextjsToken).mockResolvedValue("session-token");
  vi.mocked(fetchQuery).mockResolvedValue(material);
  vi.mocked(saveOfferMaterial).mockResolvedValue({ id: "new-id", descriere: "Cablu nou", pretAchizitie: 1.5, pretVanzare: 2.25, manopera: 0.75 });
});

test("requires authentication before accessing the offer or catalog", async () => {
  vi.mocked(convexAuthNextjsToken).mockResolvedValue(undefined);
  expect((await POST(request())).status).toBe(401);
  expect(fetchQuery).not.toHaveBeenCalled();
  expect(saveOfferMaterial).not.toHaveBeenCalled();
});

test("uses the validated server snapshot and ignores forged client prices and catalog IDs", async () => {
  expect((await POST(request({ ...body, pretAchizitie: 999, catalogMaterialId: "other-document" }))).status).toBe(200);
  expect(fetchQuery).toHaveBeenCalledWith(expect.anything(), { idGenerare: "offer-id", expectedRevision: 7, rand: 2, sheetName: "Lista" }, { token: "session-token" });
  expect(saveOfferMaterial).toHaveBeenCalledWith(material, expect.any(String), "create", "Cablu nou");
});

test.each([["AUTH", 401], ["UNAVAILABLE", 403], ["CONFLICT", 409], ["VALIDATION", 400]])("rejects backend %s errors without writing to catalog", async (code, status) => {
  vi.mocked(fetchQuery).mockRejectedValue(new ConvexError({ code, message: "Rejected" }));
  expect((await POST(request())).status).toBe(status);
  expect(saveOfferMaterial).not.toHaveBeenCalled();
});

test("rejects foreign origins and invalid descriptions before writing", async () => {
  expect((await POST(request(body, "https://other.example"))).status).toBe(403);
  expect((await POST(request({ ...body, descriere: "x" }))).status).toBe(400);
  expect(saveOfferMaterial).not.toHaveBeenCalled();
});
