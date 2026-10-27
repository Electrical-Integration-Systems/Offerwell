/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import * as XLSX from "xlsx";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { RESTART_CONFIRMATION_TEXT } from "./restart_confirmation";
import { normalizeMaterial, summarizeMaterials } from "./review";
import type { MatchedMaterial } from "./review";
import type { ExcelMapping } from "./mapping";
import { blendSearch } from "../typesense";
import { alegePret } from "../laya";

const modules = import.meta.glob("/convex/**/*.ts");
const { completion } = vi.hoisted(() => ({ completion: vi.fn() }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: completion } }; } }));
vi.mock("../typesense", () => ({ blendSearch: vi.fn(), textSearch: vi.fn() }));
vi.mock("../laya", () => ({ alegePret: vi.fn() }));

const mapping: ExcelMapping = { randIncepereDate: 2, coloanaDescriere: "A", coloanaCantitati: "B", coloanaUnitate: "C", coloanaSfarsitDate: "C", valuta: "EUR" };
const material: MatchedMaterial = normalizeMaterial({ sheetName: "Lista", rand: 2, descriereOriginala: "Cablu", descriereGasita: "Cablu",
  cantitate: 10, unitate: "m", matchScore: 10, pretAchizitie: 100, pretVanzare: 125, manopera: 5, validated: true });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GROQ_API_KEY", "development-test-key");
  completion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(mapping) } }] });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [{ document: { id: "catalog", descriere: "Cablu", pretAchizitie: 2, pretVanzare: 3, manopera: 1 } }] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockResolvedValue({ answers: { price: { choice: "Cablu" } } } as Awaited<ReturnType<typeof alegePret>>);
});
afterEach(() => vi.unstubAllEnvs());

async function fixture(legacy = false) {
  const t = convexTest(schema, modules);
  const book = XLSX.utils.book_new();
  for (const name of ["Lista", "Anexa"]) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Material", "Cantitate", "UM"], ["Cablu", 4, "m"]]), name);
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { name: "Owner" });
    const other = await ctx.db.insert("users", { name: "Other" });
    const content = await ctx.storage.store(new Blob([bytes]));
    const idGenerare = await ctx.db.insert("oferte", {
      user: owner, revision: 7, selectedSheets: ["Lista", "Anexa"],
      excelInput: { content, fileName: "oferta.xlsx" }, excelOutput: { content, fileName: "export.xlsx", formatVersion: 2 },
      excelMapping: mapping, sheetMappings: ["Lista", "Anexa"].map((sheetName) => ({ sheetName, mapping })),
      matchingProgress: { runId: "old-run", completed: 1, total: 1, status: "completed" },
      ...(legacy ? { materialeExtrase: [{ sheetName: "Lista", rand: 2, descriere: "Veche", cantitate: 10, unitate: "m" }], materialePotrivite: [material] }
        : { extractedCount: 1, materialSummary: summarizeMaterials([material]), materialSortingVersion: 1 }),
    });
    if (!legacy) {
      await ctx.db.insert("ofertaMateriale", { ...material, oferta: idGenerare, pending: false });
      await ctx.db.insert("ofertaExtrase", { oferta: idGenerare, position: 0, sheetName: "Lista", rand: 2, descriere: "Veche", cantitate: 10, unitate: "m" });
    }
    await ctx.db.insert("ofertaAcces", { oferta: idGenerare, user: owner });
    return { idGenerare, owner, other, content };
  });
  return { t, ...ids, user: t.withIdentity({ subject: `${ids.owner}|session` }) };
}

test.each([false, true])("full restart clears legacy and normalized results while preserving the file, selected sheets, ownership and catalog access (legacy=%s)", async (legacy) => {
  const { t, user, idGenerare, owner, content } = await fixture(legacy);
  await user.mutation(api.oferte.mutations.restartOferta, { idGenerare, expectedRevision: 7, confirmation: RESTART_CONFIRMATION_TEXT });
  const offer = (await t.run((ctx) => ctx.db.get(idGenerare)))!;
  expect(offer).toMatchObject({ user: owner, revision: 8, selectedSheets: ["Lista", "Anexa"], excelInput: { content, fileName: "oferta.xlsx" } });
  for (const field of ["excelMapping", "sheetMappings", "materialeExtrase", "extractedCount", "materialePotrivite", "materialSummary", "materialSortingVersion", "matchingProgress", "excelOutput"] as const) expect(offer[field]).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("ofertaExtrase").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("ofertaAcces").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.system.get(content))).not.toBeNull();
  expect(await user.query(api.oferte.queries.getOferta, { idGenerare })).toMatchObject({ status: "analysis", hasMatched: false, hasExtracted: false, materialCount: 0 });
});

test.each(["", "REIA", "reia complet oferta", ` ${RESTART_CONFIRMATION_TEXT}`])("inexact confirmation leaves the offer untouched (%j)", async (confirmation) => {
  const { t, user, idGenerare } = await fixture();
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  await expect(user.mutation(api.oferte.mutations.restartOferta, { idGenerare, expectedRevision: 7, confirmation })).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.get(idGenerare))).toEqual(before);
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toHaveLength(1);
});

test("unauthorized accounts, stale dialogs and repeated reset requests cannot clear results", async () => {
  const { t, user, idGenerare, other } = await fixture();
  const args = { idGenerare, expectedRevision: 7, confirmation: RESTART_CONFIRMATION_TEXT };
  await expect(t.mutation(api.oferte.mutations.restartOferta, args)).rejects.toThrow();
  await expect(t.withIdentity({ subject: `${other}|session` }).mutation(api.oferte.mutations.restartOferta, args)).rejects.toThrow();
  await expect(user.mutation(api.oferte.mutations.restartOferta, { ...args, expectedRevision: 6 })).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.revision).toBe(7);
  await user.mutation(api.oferte.mutations.restartOferta, args);
  await expect(user.mutation(api.oferte.mutations.restartOferta, args)).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.revision).toBe(8);
});

test("a missing analysis key or source file prevents reset and preserves existing results", async () => {
  const { t, user, idGenerare, content } = await fixture();
  const args = { idGenerare, expectedRevision: 7, confirmation: RESTART_CONFIRMATION_TEXT };
  const before = await t.run((ctx) => ctx.db.get(idGenerare));
  vi.stubEnv("GROQ_API_KEY", "");
  await expect(user.mutation(api.oferte.mutations.restartOferta, args)).rejects.toThrow("Reanalizarea automată nu este configurată");
  expect(await t.run((ctx) => ctx.db.get(idGenerare))).toEqual(before);
  vi.stubEnv("GROQ_API_KEY", "development-test-key");
  await t.run((ctx) => ctx.storage.delete(content));
  await expect(user.mutation(api.oferte.mutations.restartOferta, args)).rejects.toThrow("Fișierul Excel nu mai este disponibil");
  expect(await t.run((ctx) => ctx.db.get(idGenerare))).toEqual(before);
});

test("writes and progress updates from processing started before restart cannot restore old results", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.restartOferta, { idGenerare, expectedRevision: 7, confirmation: RESTART_CONFIRMATION_TEXT });
  await expect(user.mutation(internal.oferte.mutations.updateExcelMapping, { idGenerare, expectedRevision: 7, excelMapping: mapping, sheetName: "Lista" })).rejects.toThrow();
  await expect(user.mutation(internal.oferte.mutations.updateMaterialeExtrase, { idGenerare, expectedRevision: 7, materialeExtrase: [{ rand: 2, descriere: "Veche", cantitate: 10, unitate: "m" }] })).rejects.toThrow();
  await expect(user.mutation(internal.oferte.mutations.updateMaterialePotrivite, { idGenerare, expectedRevision: 7, matchingRunId: "old-run", materialePotrivite: [material] })).rejects.toThrow();
  expect(await user.mutation(internal.oferte.mutations.reportMatchingProgress, { idGenerare, expectedRevision: 7, runId: "old-run", completed: 1, status: "running" })).toBe(false);
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.materialSummary).toBeUndefined();
});

test("after restart every selected sheet is analyzed again, extracted from the original file and matched against current catalog prices", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.restartOferta, { idGenerare, expectedRevision: 7, confirmation: RESTART_CONFIRMATION_TEXT });
  await user.action(api.oferte.actions.analizaExcelInput, { idGenerare });
  expect(completion).toHaveBeenCalledTimes(2);
  expect(await user.action(api.oferte.actions.extrageMateriale, { idGenerare })).toEqual({ success: true, count: 2 });
  expect(await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).toMatchObject({ success: true, count: 2 });
  const offer = await user.query(internal.oferte.queries.getGenerare, { idGenerare });
  expect(offer.materialePotrivite).toHaveLength(2);
  for (const row of offer.materialePotrivite!) expect(row).toMatchObject({ cantitate: 4, pretAchizitie: 2, pretVanzare: 3, manopera: 1, validated: false, catalogMaterialId: "catalog" });
  expect(offer.matchingProgress).toMatchObject({ status: "completed", completed: 2, total: 2 });
  expect(offer.matchingProgress!.runId).not.toBe("old-run");
  expect(offer.excelOutput).toBeUndefined();
  expect((await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).map((row) => row.sheetName).sort()).toEqual(["Anexa", "Lista"]);
});
