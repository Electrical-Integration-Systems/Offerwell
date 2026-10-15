import { beforeEach, expect, test, vi } from "vitest";
import { CATALOG_PAGE_SIZE, sortCatalog, type CatalogMaterial } from "../catalog";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), search: vi.fn(), export: vi.fn() }));
vi.mock("./admin", () => ({ typesenseClient: { collections: () => ({ retrieve: mocks.retrieve, documents: () => ({ search: mocks.search, export: mocks.export }) }) } }));

const material = (id: string, descriere: string, pretAchizitie = 0): CatalogMaterial => ({ id, descriere, pretAchizitie, pretVanzare: 0, manopera: 0 });

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

test("sorts descriptions with Romanian diacritics, case and natural numbers", () => {
  const materials = [material("1", "Tub 10"), material("2", "țeavă"), material("3", "Șurub"), material("4", "Tub 2"), material("5", "cablu")];
  expect(sortCatalog(materials, "descriere", "asc").map((entry) => entry.descriere)).toEqual(["cablu", "Șurub", "Tub 2", "Tub 10", "țeavă"]);
  expect(sortCatalog(materials, "descriere", "desc").map((entry) => entry.id)).toEqual(sortCatalog(materials, "descriere", "asc").map((entry) => entry.id).reverse());
});

test("numeric sorting uses amounts rather than string comparison and breaks ties consistently", () => {
  const materials = [material("a", "Tub", 20), material("b", "Cablu", 3), material("c", "Robinet", 3)];
  expect(sortCatalog(materials, "pretAchizitie", "asc").map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  expect(materials[0].id).toBe("a");
});

test("indexed collections load only the requested alphabetical page without exporting", async () => {
  mocks.retrieve.mockResolvedValue({ fields: [{ name: "descriere", sort: true }] });
  mocks.search.mockResolvedValue({ hits: [{ document: material("1", "Cablu") }], found: 120 });
  const { getCatalogPage } = await import("./catalog");
  expect(await getCatalogPage(2, "descriere", "asc")).toMatchObject({ page: 2, total: 120, hasMore: true });
  expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ q: "*", sort_by: "descriere:asc,_seq_id:asc", page: 2, per_page: CATALOG_PAGE_SIZE, include_fields: "id,descriere,pretAchizitie,pretVanzare,manopera" }));
  expect(mocks.export).not.toHaveBeenCalled();
});

test("numeric sort is performed by Typesense across the entire catalog", async () => {
  mocks.search.mockResolvedValue({ hits: [], found: 0 });
  const { getCatalogPage } = await import("./catalog");
  expect(await getCatalogPage(1, "pretAchizitie", "desc")).toMatchObject({ hasMore: false });
  expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ sort_by: "pretAchizitie:desc,_seq_id:asc" }));
  expect(mocks.retrieve).not.toHaveBeenCalled();
});

test("legacy collections sort globally before pagination and reuse a cache without embeddings", async () => {
  mocks.retrieve.mockResolvedValue({ fields: [{ name: "descriere" }] });
  const materials = Array.from({ length: 105 }, (_, index) => material(String(index), `Material ${104 - index}`));
  mocks.export.mockResolvedValue(materials.map((entry) => JSON.stringify(entry)).join("\n"));
  const { getCatalogPage } = await import("./catalog");
  const first = await getCatalogPage(1, "descriere", "asc");
  const second = await getCatalogPage(2, "descriere", "asc");
  const third = await getCatalogPage(3, "descriere", "asc");
  expect(first.materials[0].descriere).toBe("Material 0");
  expect(second.materials[0].descriere).toBe("Material 50");
  expect(third.materials).toHaveLength(5);
  expect(third.hasMore).toBe(false);
  expect(new Set([...first.materials, ...second.materials, ...third.materials].map((entry) => entry.id)).size).toBe(105);
  expect((await getCatalogPage(3, "descriere", "desc")).materials.map((entry) => entry.descriere)).toEqual(["Material 4", "Material 3", "Material 2", "Material 1", "Material 0"]);
  expect(mocks.export).toHaveBeenCalledTimes(1);
  expect(mocks.export).toHaveBeenCalledWith({ include_fields: "id,descriere,pretAchizitie,pretVanzare,manopera" });
});

test("a failed fallback request does not poison subsequent retries", async () => {
  mocks.retrieve.mockResolvedValue({ fields: [{ name: "descriere" }] });
  mocks.export.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(JSON.stringify(material("a", "Cablu")));
  const { getCatalogPage } = await import("./catalog");
  await expect(getCatalogPage(1, "descriere", "asc")).rejects.toThrow("offline");
  expect((await getCatalogPage(1, "descriere", "asc")).materials).toHaveLength(1);
});
