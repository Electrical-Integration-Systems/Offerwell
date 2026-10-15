/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import * as XLSX from "xlsx";
import schema from "../schema";
import { api } from "../_generated/api";
import { salePrice } from "../material_prices";
import { normalizeMatchScore, normalizeMaterial, summarizeMaterials, type MatchedMaterial } from "./review";
import { populateWorkbook } from "./excel";
import { convertEuroAmount, euroConversionRate } from "./currency";

const modules = import.meta.glob("/convex/**/*.ts");
const material: MatchedMaterial = {
  rand: 2, descriereOriginala: "Cămin prefabricat din beton", descriereGasita: "Camin prefabricat din beton",
  cantitate: 2, unitate: "buc", matchScore: 1, matchedTokens: [],
  pretAchizitie: 100, pretVanzare: 0, manopera: 10, validated: true,
};

test("zero sale prices use the markup while explicit prices are preserved", () => {
  expect(salePrice(material)).toBe(125);
  expect(salePrice({ pretAchizitie: 100, pretVanzare: 150 })).toBe(150);
  expect(salePrice({ pretAchizitie: 0, pretVanzare: 0 })).toBe(0);
  expect(summarizeMaterials([material]).total).toBe(270);
});

test("the offer total sums quantities, sale prices and labor across all rows", () => {
  const materials = [material, { ...material, rand: 3, cantitate: 3, pretAchizitie: 40, pretVanzare: 60, manopera: 5 }];
  // 2 * (100 * 1.25 + 10) + 3 * (60 + 5) = 465 EUR.
  const total = summarizeMaterials(materials).total;
  expect(total).toBe(465);
  expect(convertEuroAmount(total, "EUR", 5)).toBe(465);
  expect(convertEuroAmount(total, "RON", 5)).toBe(2325);
  expect(convertEuroAmount(total, "EUR", undefined)).toBe(465);
});

test.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("a missing or invalid rate (%s) never becomes a 1:1 conversion", (rate) => {
  expect(euroConversionRate("EUR", rate)).toBe(1);
  expect(euroConversionRate("RON", rate)).toBeNull();
  expect(convertEuroAmount(465, "RON", rate)).toBeNull();
});

test("hybrid hits and old 1/10 scores are recalculated from descriptions", () => {
  expect(normalizeMatchScore(material)).toBe(10);
  const typo = { ...material, descriereOriginala: "Camin prefabricta din beton" };
  expect(normalizeMatchScore(typo)).toBeGreaterThan(8);
  expect(normalizeMatchScore(typo)).toBeLessThan(10);
  const partial = { ...material, descriereGasita: "Camin beton" };
  expect(normalizeMatchScore(partial)).toBeGreaterThan(1);
  expect(normalizeMatchScore(partial)).toBeLessThan(normalizeMatchScore(material));
  expect(normalizeMatchScore({ ...material, descriereGasita: "Cablu electric" })).toBe(1);
  expect(normalizeMaterial(material).matchedTokens).toEqual(["camin", "prefabricat", "din", "beton"]);
});

test.each([1, 5])("Excel sale formulas, cached values and totals agree at conversion rate %s", (conversionRate) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Material", "Cantitate"], ["Camin", 2]]), "Oferta");
  const input = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const mapping = { randIncepereDate: 2, coloanaDescriere: "A", coloanaCantitati: "B", coloanaUnitate: "C", coloanaSfarsitDate: "C", valuta: "EUR" };
  for (const pretVanzare of [0, 125]) {
    const output = populateWorkbook(input, mapping, [{ ...material, pretVanzare }], conversionRate);
    const sheet = XLSX.read(output, { type: "array" }).Sheets.Oferta;
    expect(sheet.E2.v).toBe(100 * conversionRate);
    expect(sheet.G2.f).toBe("E2*1.25");
    expect(sheet.G2.v).toBe(125 * conversionRate);
    expect(sheet.H2.f).toBe("B2*G2");
    expect(sheet.H2.v).toBe(250 * conversionRate);
    expect(sheet.K2).toBeUndefined();
    expect(sheet.H2.v + sheet.J2.v).toBe(270 * conversionRate);
  }
  const explicit = populateWorkbook(input, mapping, [{ ...material, pretVanzare: 150 }], conversionRate);
  const sheet = XLSX.read(explicit, { type: "array" }).Sheets.Oferta;
  expect(sheet.G2.f).toBeUndefined();
  expect(sheet.G2.v).toBe(150 * conversionRate);
});

test("existing offers receive corrected prices, totals and scores once", async () => {
  const t = convexTest(schema, modules);
  const { userId, offerId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test" });
    const content = await ctx.storage.store(new Blob(["xlsx"]));
    const offerId = await ctx.db.insert("oferte", {
      user: userId, excelInput: { content, fileName: "oferta.xlsx" }, revision: 4,
      materialSummary: { materialCount: 1, pendingCount: 0, total: 20 },
    });
    await ctx.db.insert("ofertaMateriale", { ...material, oferta: offerId, pending: false });
    return { userId, offerId };
  });
  const user = t.withIdentity({ subject: userId });
  const before = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(before.total).toBe(270);
  expect(before.materialsReady).toBe(false);
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  const after = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(after.total).toBe(270);
  expect(after.materialsReady).toBe(true);
  expect(after.revision).toBe(5);
  const rows = await user.query(api.oferte.queries.listMateriale, {
    idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 10, cursor: null },
  });
  expect(rows.page[0].pretVanzare).toBe(125);
  expect(rows.page[0].matchScore).toBe(10);
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).revision).toBe(5);
  await user.mutation(api.oferte.mutations.valideazaMaterial, {
    idGenerare: offerId, expectedRevision: 5, rand: 2, cantitate: 3, pretAchizitie: 200, pretVanzare: 0, manopera: 10,
  });
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare: offerId })).total).toBe(780);
});

test("legacy embedded materials are corrected and their old export is invalidated", async () => {
  const t = convexTest(schema, modules);
  const { userId, offerId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test" });
    const content = await ctx.storage.store(new Blob(["xlsx"]));
    const offerId = await ctx.db.insert("oferte", {
      user: userId, excelInput: { content, fileName: "oferta.xlsx" },
      excelOutput: { content, fileName: "old.xlsx" }, materialePotrivite: [material],
    });
    return { userId, offerId };
  });
  const user = t.withIdentity({ subject: userId });
  await user.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  const offer = await user.query(api.oferte.queries.getOferta, { idGenerare: offerId });
  expect(offer.total).toBe(270);
  expect(offer.materialsReady).toBe(true);
  expect(offer.excelOutput).toBeUndefined();
  expect(offer.revision).toBe(1);
});
