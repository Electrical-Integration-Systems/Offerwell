/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { materialTotal, normalizeMaterial, summarizeMaterials, type MatchedMaterial } from "./review";

const modules = import.meta.glob("/convex/**/*.ts");
const base: MatchedMaterial = {
  sheetName: "Foaia 1", rand: 2, descriereOriginala: "Cablu original 2 mm", descriereGasita: "Cablu vechi",
  cantitate: 2, unitate: "m", matchScore: 5, pretAchizitie: 10, pretVanzare: 15, manopera: 5, validated: true,
};

async function fixture(legacy = false) {
  const t = convexTest(schema, modules);
  const materials = Array.from({ length: 30 }, (_, index): MatchedMaterial => ({ ...base,
    sheetName: index % 2 ? "Foaia 2" : "Foaia 1", rand: 2 + Math.floor(index / 2),
    pretAchizitie: (index * 7) % 11 + 1, pretVanzare: (index * 3) % 13 + 1, manopera: index % 7,
    cantitate: 2 + (index * 5) % 9,
    descriereGasita: index === 0 ? base.descriereGasita : ["Cablu original 2", "Cablu", "Robinet"][index % 3],
    validated: index % 3 !== 0, requiresValidation: true,
  })).map(normalizeMaterial);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Owner" });
    const otherUserId = await ctx.db.insert("users", { name: "Other" });
    const content = await ctx.storage.store(new Blob(["xlsx"]));
    const idGenerare = await ctx.db.insert("oferte", {
      user: userId, revision: 7, excelInput: { content, fileName: "input.xlsx" },
      excelOutput: { content, fileName: "output.xlsx", formatVersion: 2 },
      materialeExtrase: materials.map((m) => ({ sheetName: m.sheetName, rand: m.rand, descriere: m.descriereOriginala, cantitate: m.cantitate, unitate: m.unitate })),
      ...(legacy ? { materialePotrivite: materials } : { materialSummary: summarizeMaterials(materials) }),
    });
    if (!legacy) for (const m of materials) await ctx.db.insert("ofertaMateriale", { ...m, oferta: idGenerare, pending: !m.validated });
    return { userId, otherUserId, idGenerare };
  });
  return { t, ...ids, materials, user: t.withIdentity({ subject: `${ids.userId}|session` }) };
}

for (const sortBy of ["pretAchizitie", "pretVanzare", "manopera", "cantitate", "matchScore", "totalVanzareManopera"] as const) {
  for (const sortDirection of ["asc", "desc"] as const) {
    test.each([false, true])(`sorts ${sortBy} ${sortDirection} across pages while filtering sheets and pending rows (%s)`, async (pendingOnly) => {
      const { user, idGenerare, materials } = await fixture();
      await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
      let cursor: string | null = null;
      const actual: MatchedMaterial[] = [];
      let pages = 0;
      for (;;) {
        const result: { page: MatchedMaterial[]; isDone: boolean; continueCursor: string } = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Foaia 1", pendingOnly,
          sortBy, sortDirection, paginationOpts: { numItems: 3, cursor } });
        actual.push(...result.page);
        pages++;
        if (result.isDone) break;
        cursor = result.continueCursor;
        if (pages > 30) throw new Error("Pagination did not finish");
      }
      const expected = materials.filter((m) => m.sheetName === "Foaia 1" && (!pendingOnly || !m.validated))
        .sort((a, b) => ((sortBy === "totalVanzareManopera" ? materialTotal(a) - materialTotal(b) : a[sortBy] - b[sortBy]) || a.rand - b.rand) * (sortDirection === "asc" ? 1 : -1));
      expect(actual.map((m) => m.rand)).toEqual(expected.map((m) => m.rand));
      expect(pages).toBeGreaterThan(1);
    });
  }
}

test.each([false, true])("replaces the chosen sheet's match and prices, preserves source data and requires review (legacy=%s)", async (legacy) => {
  const { t, user, idGenerare, materials } = await fixture(legacy);
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  await user.mutation(api.oferte.mutations.schimbaMaterial, { idGenerare, expectedRevision: 7, sheetName: "Foaia 1", rand: 2,
    descriere: "Cablu nou", pretAchizitie: 100, pretVanzare: 0, manopera: 20 });
  const offer = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  const changed = offer.materialePotrivite!.find((m) => m.rand === 2 && m.sheetName === "Foaia 1")!;
  expect(changed).toMatchObject({ descriereOriginala: base.descriereOriginala, cantitate: 2, unitate: "m",
    descriereGasita: "Cablu nou", pretAchizitie: 100, pretVanzare: 125, manopera: 20, validated: false, requiresValidation: true });
  expect(offer.materialePotrivite!.find((m) => m.rand === 2 && m.sheetName === "Foaia 2")).toMatchObject(normalizeMaterial(materials[1]));
  expect(offer.materialeExtrase).toEqual(before!.materialeExtrase);
  expect(offer.materialSummary).toEqual(summarizeMaterials(offer.materialePotrivite!));
  expect(offer.revision).toBe(8);
  expect(offer.excelOutput).toBeUndefined();
  const pending = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(pending.find((m) => m.rand === 2 && m.sheetName === "Foaia 1")!.pending).toBe(true);
});

test("rejects invalid selections, stale revisions and access by other users atomically", async () => {
  const { t, user, idGenerare, otherUserId, materials } = await fixture();
  const args = { idGenerare, expectedRevision: 7, sheetName: "Foaia 1", rand: 2, descriere: "Nou", pretAchizitie: 100, pretVanzare: 150, manopera: 20 };
  for (const changes of [{ expectedRevision: 6 }, { sheetName: "Missing" }, { descriere: " " }, { pretAchizitie: -1 }, { manopera: Infinity }]) {
    await expect(user.mutation(api.oferte.mutations.schimbaMaterial, { ...args, ...changes })).rejects.toThrow();
  }
  await expect(t.mutation(api.oferte.mutations.schimbaMaterial, args)).rejects.toThrow();
  await expect(t.withIdentity({ subject: `${otherUserId}|session` }).mutation(api.oferte.mutations.schimbaMaterial, args)).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.revision).toBe(7);
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(rows.find((m) => m.rand === 2 && m.sheetName === "Foaia 1")!.descriereGasita).toBe(materials[0].descriereGasita);
});

test("prepares existing offers for sorting without invalidating their export or revision", async () => {
  const { t, user, idGenerare } = await fixture();
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).materialsReady).toBe(false);
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const after = await t.run((ctx) => ctx.db.get(idGenerare));
  expect(after!.revision).toBe(before!.revision);
  expect(after!.excelOutput).toEqual(before!.excelOutput);
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).materialsReady).toBe(true);
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  for (const row of rows) expect(row.totalVanzareManopera).toBe(materialTotal(row));
});

test("quantity and total sorting stay current after validation and catalog replacement", async () => {
  const { user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: 7, sheetName: "Foaia 1", rand: 2,
    cantitate: 1000, pretAchizitie: 100, pretVanzare: 200, manopera: 10 });
  for (const sortBy of ["cantitate", "totalVanzareManopera"] as const) {
    const sorted = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Foaia 1", pendingOnly: false,
      sortBy, sortDirection: "desc", paginationOpts: { numItems: 3, cursor: null } });
    expect(sorted.page[0]).toMatchObject({ rand: 2, cantitate: 1000, totalVanzareManopera: 210000 });
  }
  await user.mutation(api.oferte.mutations.schimbaMaterial, { idGenerare, expectedRevision: 8, sheetName: "Foaia 1", rand: 2,
    descriere: base.descriereOriginala, pretAchizitie: 0, pretVanzare: 0, manopera: 0 });
  const sorted = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Foaia 1", pendingOnly: true,
    sortBy: "totalVanzareManopera", sortDirection: "asc", paginationOpts: { numItems: 3, cursor: null } });
  expect(sorted.page[0]).toMatchObject({ rand: 2, totalVanzareManopera: 0, matchScore: 10 });
});
