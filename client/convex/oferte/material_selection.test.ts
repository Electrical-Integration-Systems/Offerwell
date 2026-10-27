/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { materialTotal, normalizeMaterial, summarizeMaterials, type MatchedMaterial } from "./review";
import { assertOfertaAccess } from "./queries";
import type { QueryCtx } from "../_generated/server";

const modules = import.meta.glob("/convex/**/*.ts");
const base: MatchedMaterial = {
  sheetName: "Foaia 1", rand: 2, descriereOriginala: "Cablu original 2 mm", descriereGasita: "Cablu vechi",
  cantitate: 2, unitate: "m", matchScore: 5, pretAchizitie: 10, pretVanzare: 15, manopera: 5, validated: true,
};

test.each([false, true])("bulk multiplier recalculates every sheet, preserves validation and input, and replaces individual overrides (legacy=%s)", async (legacy) => {
  const { t, user, idGenerare } = await fixture(legacy);
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const before = (await t.run((ctx) => ctx.db.get(idGenerare)))!;
  const rowsBefore = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  await user.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, { idGenerare, expectedRevision: before.revision!, salePriceMultiplier: 1.6 });
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(new Set(rows.map((m) => m.sheetName)).size).toBe(2);
  for (const row of rows) {
    const previous = rowsBefore.find((m) => m._id === row._id)!;
    expect(row.pretVanzare).toBe(row.pretAchizitie * 1.6);
    expect(row.salePriceMultiplier).toBe(1.6);
    expect(row.totalVanzareManopera).toBe(row.cantitate * (row.pretVanzare + row.manopera));
    expect(row.validated).toBe(previous.validated);
    expect(row.pending).toBe(previous.pending);
    expect(row.manopera).toBe(previous.manopera);
  }
  const after = (await t.run((ctx) => ctx.db.get(idGenerare)))!;
  expect(after.salePriceMultiplier).toBe(1.6);
  expect(after.revision).toBe(before.revision! + 1);
  expect(after.excelOutput).toBeUndefined();
  expect(after.excelInput).toEqual(before.excelInput);
  expect(after.excelMapping).toEqual(before.excelMapping);
  expect(after.extractedCount).toBe(before.extractedCount);
  expect(after.materialSummary).toEqual({ ...before.materialSummary, total: rows.reduce((sum, m) => sum + materialTotal(m), 0) });
  const first = rows[0];
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: after.revision!,
    rand: first.rand, sheetName: first.sheetName, cantitate: first.cantitate, pretAchizitie: 20, pretVanzare: 99, manopera: first.manopera, salePriceMultiplier: 1.8 });
  const edited = await t.run((ctx) => ctx.db.get(first._id));
  expect(edited!.pretVanzare).toBe(36);
  expect(edited!.salePriceMultiplier).toBe(1.8);
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.salePriceMultiplier).toBe(1.6);
  await user.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, { idGenerare, expectedRevision: after.revision! + 1, salePriceMultiplier: 2 });
  expect((await t.run((ctx) => ctx.db.get(first._id)))!.pretVanzare).toBe(40);
});

test("offer multiplier survives catalog replacement and matching results", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, { idGenerare, expectedRevision: 7, salePriceMultiplier: 1.7 });
  await user.mutation(api.oferte.mutations.schimbaMaterial, { idGenerare, expectedRevision: 8,
    rand: 2, sheetName: "Foaia 1", descriere: "Alt cablu", pretAchizitie: 100, pretVanzare: 999, manopera: 5 });
  const replaced = (await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Foaia 1", pendingOnly: false, paginationOpts: { numItems: 10, cursor: null } })).page[0];
  expect(replaced.pretVanzare).toBe(170);
  expect(replaced.salePriceMultiplier).toBe(1.7);
  await user.mutation(internal.oferte.mutations.updateMaterialePotrivite, { idGenerare, expectedRevision: 9,
    materialePotrivite: [{ ...base, pretAchizitie: 10, pretVanzare: 999 }] });
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0].pretVanzare).toBe(17);
  expect(rows[0].salePriceMultiplier).toBe(1.7);
});

test("multiplier rejects unauthorized, stale and invalid updates without changing prices", async () => {
  const { t, user, idGenerare, otherUserId } = await fixture();
  const args = { idGenerare, expectedRevision: 7, salePriceMultiplier: 1.5 };
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  await expect(t.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, args)).rejects.toThrow();
  await expect(t.withIdentity({ subject: `${otherUserId}|session` }).mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, args)).rejects.toThrow();
  await expect(user.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, { ...args, expectedRevision: 6 })).rejects.toThrow();
  for (const salePriceMultiplier of [0, -1, NaN, Infinity, Number.MAX_VALUE]) {
    await expect(user.mutation(api.oferte.mutations.aplicaMultiplicatorVanzare, { ...args, salePriceMultiplier })).rejects.toThrow();
  }
  expect(await t.run((ctx) => ctx.db.get(idGenerare))).toEqual(before);
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual(rows);
});

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

test("prepares a stable ownership record once without changing the offer revision or export", async () => {
  const { t, user, idGenerare, userId } = await fixture();
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).accessReady).toBe(false);
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const access = await t.run((ctx) => ctx.db.query("ofertaAcces").collect());
  expect(access).toHaveLength(1);
  expect(access[0]).toMatchObject({ oferta: idGenerare, user: userId });
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).accessReady).toBe(true);
  const after = await t.run((ctx) => ctx.db.get(idGenerare));
  expect(after!.revision).toBe(before!.revision);
  expect(after!.excelOutput).toEqual(before!.excelOutput);

  const get = vi.fn(() => { throw new Error("The large offer document must not be read for page authorization"); });
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) },
    db: { get, query: () => ({ withIndex: () => ({ unique: async () => access[0] }) }) },
  } as unknown as QueryCtx;
  await assertOfertaAccess(ctx, idGenerare);
  expect(get).not.toHaveBeenCalled();
});

test.each([false, true])("material pages and bulk counts reject unauthorized accounts before and after access migration (%s)", async (prepared) => {
  const { t, user, idGenerare, otherUserId } = await fixture();
  if (prepared) await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const args = { idGenerare, pendingOnly: false, paginationOpts: { numItems: 10, cursor: null } };
  const other = t.withIdentity({ subject: `${otherUserId}|session` });
  for (const caller of [t, other]) {
    await expect(caller.query(api.oferte.queries.listMateriale, args)).rejects.toThrow();
    await expect(caller.query(api.oferte.queries.countBulkValidation, { idGenerare, minimumQuality: 7 })).rejects.toThrow();
  }
  expect((await user.query(api.oferte.queries.listMateriale, args)).page).toHaveLength(10);
});

test("deleting an offer removes its access record and prevents subsequent page reads", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  await user.mutation(api.oferte.mutations.deleteOferta, { idGenerare });
  expect(await t.run((ctx) => ctx.db.query("ofertaAcces").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("ofertaExtrase").collect())).toEqual([]);
  await expect(user.query(api.oferte.queries.listMateriale, { idGenerare, pendingOnly: false, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
});

test("migration moves extracted payload once, preserving data, order, revision and export", async () => {
  const { t, user, idGenerare } = await fixture();
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const raw = await t.run((ctx) => ctx.db.get(idGenerare));
  const hydrated = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  expect(raw!.materialeExtrase).toBeUndefined();
  expect(raw!.extractedCount).toBe(before!.materialeExtrase!.length);
  expect(hydrated.materialeExtrase).toEqual(before!.materialeExtrase);
  expect(raw!.revision).toBe(before!.revision);
  expect(raw!.excelOutput).toEqual(before!.excelOutput);
  expect(await t.run((ctx) => ctx.db.query("ofertaExtrase").collect())).toHaveLength(before!.materialeExtrase!.length);
});

test("unvalidation preserves prices and quantity, updates pending count and invalidates export", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const before = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  const selected = before.materialePotrivite!.find((m) => m.validated)!;
  await user.mutation(api.oferte.mutations.nevalideazaMaterial, { idGenerare, expectedRevision: 7, sheetName: selected.sheetName, rand: selected.rand });
  const after = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  expect(after.materialePotrivite!.find((m) => m.sheetName === selected.sheetName && m.rand === selected.rand)).toMatchObject({
    ...selected, validated: false, requiresValidation: true,
  });
  expect(after.materialSummary!.pendingCount).toBe(before.materialSummary!.pendingCount + 1);
  expect(after.materialSummary!.total).toBe(before.materialSummary!.total);
  expect(after.revision).toBe(8);
  expect(after.excelOutput).toBeUndefined();
  await expect(user.query(api.oferte.queries.getCatalogMaterial, { idGenerare, expectedRevision: 8, sheetName: selected.sheetName, rand: selected.rand })).rejects.toThrow();
  await expect(user.mutation(api.oferte.mutations.nevalideazaMaterial, { idGenerare, expectedRevision: 8, sheetName: selected.sheetName, rand: selected.rand })).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.materialeExtrase).toBeUndefined();
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: 8, sheetName: selected.sheetName, rand: selected.rand,
    cantitate: selected.cantitate, pretAchizitie: selected.pretAchizitie, pretVanzare: selected.pretVanzare, manopera: selected.manopera });
  expect((await user.query(api.oferte.queries.getCatalogMaterial, { idGenerare, expectedRevision: 9, sheetName: selected.sheetName, rand: selected.rand })).validated).toBe(true);
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.materialSummary!.pendingCount).toBe(before.materialSummary!.pendingCount);
});

test("unvalidation and catalog snapshots reject unauthorized users and stale revisions", async () => {
  const { t, user, idGenerare, otherUserId } = await fixture();
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const offer = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  const row = offer.materialePotrivite!.find((m) => m.validated)!;
  const args = { idGenerare, expectedRevision: 7, sheetName: row.sheetName, rand: row.rand };
  expect(await user.query(api.oferte.queries.getCatalogMaterial, args)).toMatchObject({ validated: true, pretAchizitie: row.pretAchizitie });
  for (const caller of [t, t.withIdentity({ subject: `${otherUserId}|session` })]) {
    await expect(caller.mutation(api.oferte.mutations.nevalideazaMaterial, args)).rejects.toThrow();
    await expect(caller.query(api.oferte.queries.getCatalogMaterial, args)).rejects.toThrow();
  }
  await expect(user.mutation(api.oferte.mutations.nevalideazaMaterial, { ...args, expectedRevision: 6 })).rejects.toThrow();
  await expect(user.query(api.oferte.queries.getCatalogMaterial, { ...args, expectedRevision: 6 })).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.revision).toBe(7);
});

test.each([false, true])("paginates only the selected sheet in row order, including pending filtering (%s)", async (pendingOnly) => {
  const { user, idGenerare, materials } = await fixture();
  let cursor: string | null = null;
  const actual: MatchedMaterial[] = [];
  for (let pages = 0; ; pages++) {
    const result: { page: MatchedMaterial[]; isDone: boolean; continueCursor: string } = await user.query(api.oferte.queries.listMateriale, {
      idGenerare, sheetName: "Foaia 2", pendingOnly, paginationOpts: { numItems: 3, cursor },
    });
    actual.push(...result.page);
    if (result.isDone) break;
    if (pages > 30) throw new Error("Pagination did not finish");
    cursor = result.continueCursor;
  }
  expect(actual.map((m) => m.rand)).toEqual(materials.filter((m) => m.sheetName === "Foaia 2" && (!pendingOnly || !m.validated)).map((m) => m.rand));
});

for (const sortBy of ["pretAchizitie", "pretVanzare", "manopera", "cantitate", "matchScore", "totalVanzareManopera"] as const) {
  for (const sortDirection of ["asc", "desc"] as const) {
    test.each([{ pendingOnly: false, sheetName: "Foaia 1" }, { pendingOnly: true, sheetName: "Foaia 1" }, { pendingOnly: false, sheetName: undefined }, { pendingOnly: true, sheetName: undefined }])(`sorts ${sortBy} ${sortDirection} across pages with indexed filters (%j)`, async ({ pendingOnly, sheetName }) => {
      const { user, idGenerare, materials } = await fixture();
      await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
      let cursor: string | null = null;
      const actual: MatchedMaterial[] = [];
      let pages = 0;
      for (;;) {
        const result: { page: MatchedMaterial[]; isDone: boolean; continueCursor: string } = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName, pendingOnly,
          sortBy, sortDirection, paginationOpts: { numItems: 3, cursor } });
        actual.push(...result.page);
        pages++;
        if (result.isDone) break;
        cursor = result.continueCursor;
        if (pages > 30) throw new Error("Pagination did not finish");
      }
      const expected = materials.filter((m) => (sheetName === undefined || m.sheetName === sheetName) && (!pendingOnly || !m.validated))
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

test.each([false, true])("bulk validation includes the selected quality boundary across pages, and preserves other sheets and prices (legacy=%s)", async (legacy) => {
  const { t, user, idGenerare } = await fixture(legacy);
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  const before = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  expect(await user.query(api.oferte.queries.countBulkValidation, { idGenerare, sheetName: "Foaia 1", minimumQuality: 10 })).toBe(4);
  const result = await user.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, { idGenerare, expectedRevision: before.revision!, sheetName: "Foaia 1", minimumQuality: 10 });
  expect(result.validatedCount).toBe(4);
  const after = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  expect(after.materialSummary!.pendingCount).toBe(before.materialSummary!.pendingCount - 4);
  expect(after.materialSummary!.total).toBe(before.materialSummary!.total);
  expect(after.revision).toBe(before.revision! + 1);
  expect(after.excelOutput).toBeUndefined();
  for (const row of after.materialePotrivite!) {
    const old = before.materialePotrivite!.find((item) => item.sheetName === row.sheetName && item.rand === row.rand)!;
    expect(row).toMatchObject({ cantitate: old.cantitate, pretAchizitie: old.pretAchizitie, pretVanzare: old.pretVanzare, manopera: old.manopera });
    if (row.sheetName === "Foaia 2" || row.matchScore < 10) expect(row.validated).toBe(old.validated);
    else expect(row.validated).toBe(true);
  }
  expect(await user.query(api.oferte.queries.countBulkValidation, { idGenerare, sheetName: "Foaia 1", minimumQuality: 10 })).toBe(0);
  const repeated = await user.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, { idGenerare, expectedRevision: after.revision!, sheetName: "Foaia 1", minimumQuality: 10 });
  expect(repeated.validatedCount).toBe(0);
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.revision).toBe(after.revision);
});

test("bulk validation leaves unmatched, failed, invalid-price and zero-quantity rows for manual review", async () => {
  const { t, user, idGenerare } = await fixture();
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("ofertaMateriale").collect();
    const edits = [{ descriereGasita: "Nu a fost găsit în baza de date" }, { descriereGasita: "Eroare la căutare" }, { pretAchizitie: -1 }, { cantitate: 0 }];
    for (let i = 0; i < edits.length; i++) {
      const row = rows.find((item) => item.sheetName === "Foaia 1" && item.rand === [5, 8, 11, 14][i])!;
      await ctx.db.patch(row._id, edits[i]);
    }
  });
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare });
  expect(await user.query(api.oferte.queries.countBulkValidation, { idGenerare, sheetName: "Foaia 1", minimumQuality: 1 })).toBe(1);
  expect((await user.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, { idGenerare, expectedRevision: 7, sheetName: "Foaia 1", minimumQuality: 1 })).validatedCount).toBe(1);
  const pending = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Foaia 1", pendingOnly: true, paginationOpts: { numItems: 30, cursor: null } });
  expect(pending.page.map((row) => row.rand)).toEqual([5, 8, 11, 14]);
});

test("bulk validation rejects invalid thresholds, stale revisions and unauthorized users without changing data", async () => {
  const { t, user, idGenerare, otherUserId } = await fixture();
  const args = { idGenerare, expectedRevision: 7, minimumQuality: 7, sheetName: "Foaia 1" };
  for (const minimumQuality of [0, 11, NaN, Infinity]) {
    await expect(user.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, { ...args, minimumQuality })).rejects.toThrow();
    await expect(user.query(api.oferte.queries.countBulkValidation, { idGenerare, minimumQuality })).rejects.toThrow();
  }
  await expect(user.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, { ...args, expectedRevision: 6 })).rejects.toThrow();
  await expect(t.mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, args)).rejects.toThrow();
  await expect(t.withIdentity({ subject: `${otherUserId}|session` }).mutation(api.oferte.mutations.valideazaMaterialeDupaCalitate, args)).rejects.toThrow();
  const offer = await t.run((ctx) => ctx.db.get(idGenerare));
  expect(offer!.revision).toBe(7);
  expect(offer!.materialSummary!.pendingCount).toBe(10);
  expect(offer!.excelOutput).toBeDefined();
});
