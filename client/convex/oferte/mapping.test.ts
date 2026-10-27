/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import * as XLSX from "xlsx";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { validateExcelMapping, type ExcelMapping } from "./mapping";
import { CURRENT_EXPORT_FORMAT } from "./export_format";
import { getExtractedMaterials } from "./extracted";

const modules = import.meta.glob("/convex/**/*.ts");
vi.mock("../typesense", () => ({ blendSearch: vi.fn(), textSearch: vi.fn() }));
vi.mock("../laya", () => ({ alegePret: vi.fn() }));
const mapping: ExcelMapping = {
  randIncepereDate: 3, coloanaDescriere: "B", coloanaCantitati: "D", coloanaUnitate: "C", coloanaSfarsitDate: "D", valuta: "RON",
};

async function fixture() {
  const t = convexTest(schema, modules);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Listă de cantități"], ["Cod", "Id Articol", "UM", "Cantitate", "Note"],
    ["A001", "Cablu 3x2,5", "m", 100, "Păstrează această coloană"], ["A002", "Tub corugat", "m", 20],
  ]), "Lista");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test" });
    const content = await ctx.storage.store(new Blob([bytes]));
    const offerId = await ctx.db.insert("oferte", {
      user: userId, revision: 7, excelInput: { content, fileName: "lista.xlsx" },
      excelMapping: { ...mapping, coloanaDescriere: "A" },
      materialeExtrase: [{ rand: 3, descriere: "A001", cantitate: 100, unitate: "m" }],
      materialSummary: { materialCount: 1, pendingCount: 0, total: 123, pricingVersion: 1 },
      excelOutput: { content, fileName: "vechi.xlsx" },
    });
    await ctx.db.insert("ofertaMateriale", {
      oferta: offerId, pending: false, rand: 3, descriereOriginala: "A001", descriereGasita: "Cablu", cantitate: 100,
      unitate: "m", matchScore: 1, validated: true, pretAchizitie: 1, pretVanzare: 2, manopera: 1,
    });
    return { userId, offerId };
  });
  return { t, ...ids, user: t.withIdentity({ subject: ids.userId }) };
}

test("normalizes Excel letters and currency aliases", () => {
  expect(validateExcelMapping({ ...mapping, coloanaDescriere: " b ", valuta: "lei" }, 4, 4)).toEqual(mapping);
});

test.each([
  { randIncepereDate: 1 }, { randIncepereDate: 1.5 }, { randIncepereDate: 5 },
  { coloanaDescriere: "B3" }, { coloanaDescriere: "XFE" }, { coloanaCantitati: "F" },
  { coloanaCantitati: "B" }, { coloanaSfarsitDate: "B" }, { valuta: "USD" },
])("rejects invalid structure %j", (invalid) => {
  expect(() => validateExcelMapping({ ...mapping, ...invalid }, 4, 4)).toThrow();
});

test("manual correction clears obsolete results and extracts the Id Articol description without AI", async () => {
  const { t, user, offerId } = await fixture();
  const saved = await user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7, excelMapping: mapping,
  });
  expect(saved.coloanaSfarsitDate).toBe("D");
  const after = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(after.revision).toBe(8);
  expect(after.hasExtracted).toBe(false);
  expect(after.hasMatched).toBe(false);
  expect(after.excelOutput).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual([]);
  expect(await user.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).toEqual({ success: true, count: 2 });
  const result = await t.run(async (ctx) => { const offer = (await ctx.db.get(offerId))!; return { ...offer, materialeExtrase: await getExtractedMaterials(ctx, offer) }; });
  expect(result?.materialeExtrase).toEqual([
    { rand: 3, descriere: "Cablu 3x2,5", cantitate: 100, unitate: "m" },
    { rand: 4, descriere: "Tub corugat", cantitate: 20, unitate: "m" },
  ]);
});

test("allows manual correction when analysis failed before saving any structure", async () => {
  const { t, user, offerId } = await fixture();
  await t.run((ctx) => ctx.db.patch(offerId, { excelMapping: undefined }));
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare: offerId, expectedRevision: 7, excelMapping: mapping });
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).excelMapping?.coloanaDescriere).toBe("B");
});

test("recovers from extraction that found no materials with the wrong mapping", async () => {
  const { t, user, offerId } = await fixture();
  await t.run((ctx) => ctx.db.patch(offerId, {
    excelMapping: { ...mapping, randIncepereDate: 4, coloanaDescriere: "E", coloanaSfarsitDate: "E" },
    materialeExtrase: undefined,
  }));
  await expect(user.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).rejects.toThrow("Structura identificată a Excelului poate fi greșită");
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).revision).toBe(7);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare: offerId, expectedRevision: 7, excelMapping: mapping });
  expect(await user.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).toEqual({ success: true, count: 2 });
});

test("a manual mapping with no material descriptions preserves previous results", async () => {
  const { user, offerId } = await fixture();
  await expect(user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7,
    excelMapping: { ...mapping, randIncepereDate: 4, coloanaDescriere: "E", coloanaSfarsitDate: "E" },
  })).rejects.toThrow("Corectează structura manual");
  const offer = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(offer.revision).toBe(7);
  expect(offer.hasMatched).toBe(true);
  expect(offer.excelOutput).toBeDefined();
});

test.each([{ coloanaSfarsitDate: "E" }, { valuta: "EUR" }, { coloanaSfarsitDate: "E", valuta: "EUR" }])("export-only changes preserve extracted rows, edited prices and validation: %j", async (change) => {
  const { t, user, offerId } = await fixture();
  const before = await t.run((ctx) => ctx.db.get(offerId));
  const rowsBefore = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  const saved = await user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7, excelMapping: { ...before!.excelMapping!, ...change },
  });
  expect(saved).toMatchObject(change);
  const after = await t.run((ctx) => ctx.db.get(offerId));
  expect(after?.materialeExtrase).toBeUndefined();
  expect(await t.run(async (ctx) => getExtractedMaterials(ctx, (await ctx.db.get(offerId))!))).toEqual(before?.materialeExtrase);
  expect(after?.materialSummary).toEqual(before?.materialSummary);
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual(rowsBefore);
  expect(after?.excelOutput).toBeUndefined();
  expect(await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).toMatchObject({ hasExtracted: true, hasMatched: true, revision: 8 });
});

test("changing an export column in one sheet preserves other sheet mappings and legacy matched rows", async () => {
  const { t, user, offerId } = await fixture();
  const originalMapping = { ...mapping, coloanaDescriere: "A" };
  const legacyRows = [{ rand: 3, descriereOriginala: "Cablu", descriereGasita: "Cablu", cantitate: 12, unitate: "m", matchScore: 10, pretAchizitie: 3, pretVanzare: 5, manopera: 1, validated: true }];
  await t.run((ctx) => ctx.db.patch(offerId, {
    selectedSheets: ["Lista", "Alta"], sheetMappings: [{ sheetName: "Lista", mapping: originalMapping }, { sheetName: "Alta", mapping }],
    materialePotrivite: legacyRows, materialSummary: undefined,
  }));
  await user.mutation(internal.oferte.mutations.updateExcelMapping, {
    idGenerare: offerId, expectedRevision: 7, sheetName: "Lista", excelMapping: { ...originalMapping, coloanaSfarsitDate: "E" },
  });
  const after = await t.run((ctx) => ctx.db.get(offerId));
  expect(after?.materialePotrivite).toEqual(legacyRows);
  expect(after?.sheetMappings?.find((entry) => entry.sheetName === "Alta")?.mapping).toEqual(mapping);
  expect(after?.excelMapping?.coloanaSfarsitDate).toBe("E");
});

test("rejects out-of-sheet columns and stale revisions without erasing existing work", async () => {
  const { user, offerId } = await fixture();
  await expect(user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7, excelMapping: { ...mapping, coloanaDescriere: "Z" },
  })).rejects.toThrow("Coloanele");
  await expect(user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 6, excelMapping: mapping,
  })).rejects.toThrow("modificată");
  const after = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(after.revision).toBe(7);
  expect(after.excelOutput).toBeDefined();
  expect(after.hasMatched).toBe(true);
});

test("only the offer owner can change its structure", async () => {
  const { t, offerId } = await fixture();
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  await expect(t.withIdentity({ subject: otherId }).action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7, excelMapping: mapping,
  })).rejects.toThrow("disponibila");
  await expect(t.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: offerId, expectedRevision: 7, excelMapping: mapping,
  })).rejects.toThrow("Autentificarea");
});

test("old exports require regeneration and the current format preserves all validated materials", async () => {
  const { t, user, offerId } = await fixture();
  const rowsBefore = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).toMatchObject({
    needsExportRefresh: true, downloadUrl: null, status: "export", hasMatched: true,
  });
  await t.run((ctx) => ctx.db.insert("cursuriValutare", { moneda: "EUR", valoare: 5, dataActualizare: "2026-10-15" }));
  await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare: offerId });
  const after = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(after.needsExportRefresh).toBe(false);
  expect(after.downloadUrl).toBeTruthy();
  expect(after.status).toBe("completed");
  expect(after.excelOutput?.formatVersion).toBe(CURRENT_EXPORT_FORMAT);
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual(rowsBefore);
});
