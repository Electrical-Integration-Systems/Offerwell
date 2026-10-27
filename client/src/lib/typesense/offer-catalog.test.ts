// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { CatalogConflict, saveOfferMaterial } from "./offer-catalog";
import type { MatchedMaterial } from "../../../convex/oferte/review";

const { upsert, search, update, document } = vi.hoisted(() => ({ upsert: vi.fn(), search: vi.fn(), update: vi.fn(), document: vi.fn() }));
vi.mock("./admin", () => ({ typesenseClient: { collections: () => ({ documents: document }) } }));
const material: MatchedMaterial = { rand: 2, descriereOriginala: "Cablu original", descriereGasita: "Cablu catalog", cantitate: 10,
  unitate: "m", validated: true, matchScore: 10, pretAchizitie: 1.5, pretVanzare: 2.25, manopera: 0.75 };
beforeEach(() => {
  vi.resetAllMocks();
  document.mockReturnValue({ upsert, search, update });
  upsert.mockImplementation(async (value) => value);
  update.mockImplementation(async (value) => value);
});

test("retries of a new material use the same ID and save unit prices, not quantity totals", async () => {
  const first = await saveOfferMaterial(material, "offer-revision-row", "create", "Cablu nou");
  const retry = await saveOfferMaterial(material, "offer-revision-row", "create", "Cablu nou");
  expect(first).toEqual(retry);
  expect(first).toMatchObject({ descriere: "Cablu nou", pretAchizitie: 1.5, pretVanzare: 2.25, manopera: 0.75 });
  expect(first.id).toMatch(/^offer-[a-f0-9]{64}$/);
  expect(first).not.toHaveProperty("cantitate");
  expect(search).not.toHaveBeenCalled();
});

test("updating a known catalog ID changes only prices and does not search by description", async () => {
  await saveOfferMaterial({ ...material, catalogMaterialId: "catalog-123" }, "snapshot", "update");
  expect(document).toHaveBeenCalledWith("catalog-123");
  expect(update).toHaveBeenCalledWith({ pretAchizitie: 1.5, pretVanzare: 2.25, manopera: 0.75 });
  expect(search).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test("legacy associations update only a single exact description match", async () => {
  search.mockResolvedValue({ found: 1, hits: [{ document: { id: "legacy", descriere: material.descriereGasita } }] });
  await saveOfferMaterial(material, "snapshot", "update");
  expect(document).toHaveBeenCalledWith("legacy");
  expect(search).toHaveBeenCalledWith(expect.objectContaining({ filter_by: "descriere:=`Cablu catalog`", per_page: 2 }));
});

test.each([0, 2])("missing or ambiguous legacy associations never write to catalog (found=%s)", async (found) => {
  search.mockResolvedValue({ found, hits: [] });
  await expect(saveOfferMaterial(material, "snapshot", "update")).rejects.toBeInstanceOf(CatalogConflict);
  expect(update).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});
