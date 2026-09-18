/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import Typesense from "typesense";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { populateWorkbook } from "./oferte/excel";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { assertReadyForExport, isExactMatch, MAX_DESCRIPTION_LENGTH, MAX_EXCEL_BYTES, MAX_MATERIALS, needsReview } from "./oferte/review";

const modules = import.meta.glob("./**/*.ts");
const material = {
  rand: 4, descriereOriginala: "Cablu 3x1", descriereGasita: "Cablu 3x2", cantitate: 2, unitate: "m",
  matchScore: 578730123456789000, requiresValidation: true, validated: false,
  pretAchizitie: 10, pretVanzare: 15, manopera: 5,
};
const mapping = {
  randIncepereDate: 4, coloanaDescriere: "B", coloanaCantitati: "C", coloanaUnitate: "D", coloanaSfarsitDate: "D", valuta: "RON",
};

async function fixture(overrides: Partial<Doc<"oferte">> = {}, inputRows?: unknown[][]) {
  const backend = convexTest(schema, modules);
  const worksheet = XLSX.utils.aoa_to_sheet(inputRows ?? [
    [], [null, "Lista de cantitati"], [null, "Descriere", "Cantitate", "UM"], [null, "Cablu 3x1", "1.234,50", "m"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Materiale");
  const input = new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })]);
  const { userId, otherId, storageId } = await backend.run(async (ctx) => ({
    userId: await ctx.db.insert("users", { email: "owner@example.test" }),
    otherId: await ctx.db.insert("users", { email: "other@example.test" }),
    storageId: await ctx.storage.store(input),
  }));
  const owner = backend.withIdentity({ subject: `${userId}|session` });
  const offerId = await owner.mutation(api.oferte.mutations.uploadInputExcel, { storageId, fileName: "input.xlsx" });
  await backend.run((ctx) => ctx.db.patch(offerId, { excelMapping: mapping, materialePotrivite: [material], ...overrides }));
  const document = async () => (await backend.run((ctx) => ctx.db.get(offerId)))!;
  return { backend, owner, offerId, userId, otherId, storageId, document };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("approximate, missing and legacy matches require review; exact matches may proceed", () => {
  expect(needsReview(material)).toBe(true);
  expect(needsReview({ ...material, matchScore: 0 })).toBe(true);
  expect(needsReview({ ...material, requiresValidation: undefined })).toBe(true);
  expect(needsReview({ ...material, requiresValidation: false })).toBe(false);
  expect(isExactMatch(" CABLU  3x1 ", "cablu 3x1")).toBe(true);
  expect(isExactMatch("Cablu 3x1", "Cablu 3x2")).toBe(false);
  expect(isExactMatch("", "")).toBe(false);
});

test("empty previews and invalid amounts cannot be exported even after validation", () => {
  expect(() => assertReadyForExport([])).toThrow();
  for (const value of [-1, Infinity, NaN]) {
    expect(() => assertReadyForExport([{ ...material, validated: true, pretVanzare: value }])).toThrow();
  }
  expect(() => assertReadyForExport([{ ...material, validated: true }])).not.toThrow();
});

test("upload returns a persisted offer id linked to the authenticated user", async () => {
  const { document, offerId, userId, storageId } = await fixture();
  expect(await document()).toMatchObject({ _id: offerId, user: userId, revision: 0, excelInput: { content: storageId } });
});

test("offer list is paginated, newest first and restricted to its owner", async () => {
  const { backend, owner, offerId, userId, otherId, storageId } = await fixture();
  const newerId = await backend.run(async (ctx) => {
    await ctx.db.insert("oferte", { user: otherId, excelInput: { content: storageId, fileName: "private.xlsx" } });
    return ctx.db.insert("oferte", { user: userId, excelInput: { content: storageId, fileName: "new.xlsx" } });
  });
  const first = await owner.query(api.oferte.queries.listOferte, { paginationOpts: { numItems: 1, cursor: null } });
  expect(first.page.map((item) => item._id)).toEqual([newerId]);
  expect(first.page[0].status).toBe("analysis");
  expect(first.page[0]).not.toHaveProperty("materialePotrivite");
  const second = await owner.query(api.oferte.queries.listOferte, { paginationOpts: { numItems: 1, cursor: first.continueCursor } });
  expect(second.page.map((item) => item._id)).toEqual([offerId]);
  expect(second.isDone).toBe(true);
  await expect(backend.query(api.oferte.queries.listOferte, { paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
});

test("offer status follows persisted progress and validation across sessions", async () => {
  const { backend, owner, offerId, storageId } = await fixture({ excelMapping: undefined, materialePotrivite: undefined });
  const status = async () => (await owner.query(api.oferte.queries.listOferte, { paginationOpts: { numItems: 10, cursor: null } })).page[0];
  expect((await status()).status).toBe("analysis");
  await backend.run((ctx) => ctx.db.patch(offerId, { excelMapping: mapping }));
  expect((await status()).status).toBe("extraction");
  await backend.run((ctx) => ctx.db.patch(offerId, { materialeExtrase: [{ rand: 4, descriere: "Cablu", cantitate: 2, unitate: "m" }] }));
  expect((await status()).status).toBe("matching");
  await backend.run((ctx) => ctx.db.patch(offerId, { materialePotrivite: [material] }));
  expect(await status()).toMatchObject({ status: "validation", materialCount: 1, pendingCount: 1 });
  await owner.mutation(api.oferte.mutations.valideazaMaterial, {
    idGenerare: offerId, expectedRevision: 0, rand: 4, cantitate: 2, pretAchizitie: 10, pretVanzare: 15, manopera: 5,
  });
  expect(await status()).toMatchObject({ status: "export", pendingCount: 0 });
  expect((await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } })).page[0].validated).toBe(true);
  await owner.mutation(internal.oferte.mutations.updateExcelOutput, {
    idGenerare: offerId, expectedRevision: 1, excelOutput: { content: storageId, fileName: "output.xlsx" },
  });
  expect((await status()).status).toBe("completed");
});

test("materials migrate once and paginate in row order with server-side review filtering", async () => {
  const materials = Array.from({ length: 55 }, (_, index) => ({ ...material, rand: index + 4, validated: index % 2 === 0 }));
  const { backend, owner, offerId, otherId, document } = await fixture({ materialePotrivite: materials });
  const before = await owner.query(api.oferte.queries.getOfertaPage, { idOferta: offerId });
  expect(before).not.toHaveProperty("materialePotrivite");
  expect(before).not.toHaveProperty("materialeExtrase");
  expect(before).toMatchObject({ materialCount: 55, pendingCount: 27, materialsReady: false, total: 2200 });
  await owner.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  await owner.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  expect((await document()).materialePotrivite).toBeUndefined();
  expect((await document()).revision).toBe(0);
  const first = await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } });
  const second = await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: first.continueCursor } });
  const last = await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: second.continueCursor } });
  expect([first.page.length, second.page.length, last.page.length]).toEqual([20, 20, 15]);
  expect(last.isDone).toBe(true);
  expect([...first.page, ...second.page, ...last.page].map((row) => row.rand)).toEqual(materials.map((row) => row.rand));
  const pending = await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: true, paginationOpts: { numItems: 20, cursor: null } });
  expect(pending.page).toHaveLength(20);
  expect(pending.page.every((row) => row.pending && !row.validated)).toBe(true);
  await owner.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare: offerId, expectedRevision: 0, rand: 5, cantitate: 3, pretAchizitie: 10, pretVanzare: 20, manopera: 5 });
  const remaining = await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: true, paginationOpts: { numItems: 20, cursor: null } });
  expect(remaining.page[0].rand).toBe(7);
  expect(await owner.query(api.oferte.queries.getOfertaPage, { idOferta: offerId })).toMatchObject({ pendingCount: 26, total: 2235, materialsReady: true });
  for (const caller of [backend, backend.withIdentity({ subject: `${otherId}|session` })]) {
    await expect(caller.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow();
    await expect(caller.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId })).rejects.toThrow();
  }
});

test("export includes materials beyond the first page and remapping clears indexed rows", async () => {
  const materials = Array.from({ length: 45 }, (_, index) => ({ ...material, rand: index + 4, validated: true }));
  const { owner, offerId, backend, document } = await fixture({ materialePotrivite: materials });
  await owner.mutation(api.oferte.mutations.prepareMaterialPagination, { idGenerare: offerId });
  await owner.action(api.oferte.actions.genereazaExcelOutput, { idGenerare: offerId });
  const oferta = await document();
  const buffer = await backend.run(async (ctx) => (await ctx.storage.get(oferta.excelOutput!.content))!.arrayBuffer());
  expect(XLSX.read(buffer, { type: "array" }).Sheets.Materiale.L48.v).toBe(40);
  await owner.mutation(internal.oferte.mutations.updateExcelMapping, { idGenerare: offerId, expectedRevision: 0, excelMapping: mapping });
  expect((await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } })).page).toEqual([]);
  expect((await document()).materialSummary).toBeUndefined();
});

test("detail page hides invalid, missing and foreign offer ids", async () => {
  const { backend, owner, offerId, otherId } = await fixture();
  expect(await owner.query(api.oferte.queries.getOfertaPage, { idOferta: "invalid" })).toBeNull();
  expect(await backend.withIdentity({ subject: `${otherId}|session` }).query(api.oferte.queries.getOfertaPage, { idOferta: offerId })).toBeNull();
  await backend.run((ctx) => ctx.db.delete(offerId));
  expect(await owner.query(api.oferte.queries.getOfertaPage, { idOferta: offerId })).toBeNull();
});

test("upload rejects non-xlsx, empty and oversized files", async () => {
  const { backend, owner, storageId } = await fixture();
  await expect(owner.mutation(api.oferte.mutations.uploadInputExcel, { storageId, fileName: "test.csv" })).rejects.toThrow();
  for (const size of [0, MAX_EXCEL_BYTES + 1]) {
    const invalidId = await backend.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(size)])));
    await expect(owner.mutation(api.oferte.mutations.uploadInputExcel, { storageId: invalidId, fileName: "test.xlsx" })).rejects.toThrow();
  }
});

test("preview, validation and all actions enforce ownership and authentication", async () => {
  const { backend, offerId, otherId } = await fixture();
  for (const caller of [backend, backend.withIdentity({ subject: `${otherId}|session` })]) {
    await expect(caller.query(api.oferte.queries.getOferta, { idGenerare: offerId })).rejects.toThrow();
    await expect(caller.mutation(api.oferte.mutations.valideazaMaterial, {
      idGenerare: offerId, expectedRevision: 0, rand: 4, cantitate: 2, pretAchizitie: 10, pretVanzare: 15, manopera: 5,
    })).rejects.toThrow();
    for (const action of [api.oferte.actions.analizaExcelInput, api.oferte.actions.extrageMateriale, api.oferte.actions.cautaSiPopuleazaPreturi, api.oferte.actions.genereazaExcelOutput]) {
      await expect(caller.action(action, { idGenerare: offerId })).rejects.toThrow();
    }
  }
});

test("validation saves corrections, increments revision and invalidates previous output", async () => {
  const { backend, owner, offerId, storageId, document } = await fixture();
  await backend.run((ctx) => ctx.db.patch(offerId, { excelOutput: { content: storageId, fileName: "old.xlsx" } }));
  await owner.mutation(api.oferte.mutations.valideazaMaterial, {
    idGenerare: offerId, expectedRevision: 0, rand: 4, cantitate: 3, pretAchizitie: 10, pretVanzare: 20, manopera: 5,
  });
  const oferta = await document();
  expect((await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } })).page[0])
    .toMatchObject({ validated: true, pretVanzare: 20, cantitate: 3 });
  expect(oferta.materialePotrivite).toBeUndefined();
  expect(oferta.materialSummary).toEqual({ materialCount: 1, pendingCount: 0, total: 75 });
  expect(oferta.revision).toBe(1);
  expect(oferta.excelOutput).toBeUndefined();
});

test("validation rejects invalid values, nonexistent rows and stale revisions", async () => {
  const { owner, offerId } = await fixture();
  const args = { idGenerare: offerId, expectedRevision: 0, rand: 4, cantitate: 2, pretAchizitie: 10, pretVanzare: 15, manopera: 5 };
  await expect(owner.mutation(api.oferte.mutations.valideazaMaterial, { ...args, rand: 900 })).rejects.toThrow();
  await expect(owner.mutation(api.oferte.mutations.valideazaMaterial, { ...args, expectedRevision: 1 })).rejects.toThrow();
  await expect(owner.mutation(api.oferte.mutations.valideazaMaterial, { ...args, cantitate: -1 })).rejects.toThrow();
});

test("extraction preserves worksheet row numbers and parses Romanian quantities", async () => {
  const { owner, offerId, document } = await fixture();
  expect(await owner.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).toMatchObject({ count: 1 });
  const oferta = await document();
  expect(oferta.materialeExtrase?.[0]).toEqual({ rand: 4, descriere: "Cablu 3x1", cantitate: 1234.5, unitate: "m" });
  expect(oferta.materialePotrivite).toBeUndefined();
});

test.each([501, MAX_MATERIALS])("extraction accepts %i materials and truncates long descriptions", async (count) => {
  const longDescription = "a".repeat(MAX_DESCRIPTION_LENGTH - 1) + "\u{1F4A1}" + "extra";
  const inputRows = [
    [], [null, "Lista"], [null, "Descriere", "Cantitate", "UM"],
    ...Array.from({ length: count }, (_, index) => [null, index === 0 ? `  ${longDescription}  ` : `Material ${index}`, 2, "buc"]),
  ];
  const { owner, offerId, document, backend, storageId } = await fixture({}, inputRows);
  expect(await owner.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).toEqual({ success: true, count });
  const extracted = (await document()).materialeExtrase!;
  expect(extracted).toHaveLength(count);
  expect(extracted[0].descriere).toBe("a".repeat(MAX_DESCRIPTION_LENGTH - 1) + "\u{1F4A1}");
  expect(Array.from(extracted[0].descriere)).toHaveLength(MAX_DESCRIPTION_LENGTH);
  expect(extracted.at(-1)).toMatchObject({ rand: count + 3, cantitate: 2, unitate: "buc" });
  const buffer = await backend.run(async (ctx) => (await ctx.storage.get(storageId))!.arrayBuffer());
  expect(XLSX.read(buffer, { type: "array" }).Sheets.Materiale.B4.v).toBe(`  ${longDescription}  `);
});

test("extraction rejects more than the new material limit without saving partial results", async () => {
  const inputRows = [
    [], [null, "Lista"], [null, "Descriere", "Cantitate", "UM"],
    ...Array.from({ length: MAX_MATERIALS + 1 }, () => [null, "Material", 1, "buc"]),
  ];
  const { owner, offerId, document } = await fixture({}, inputRows);
  await expect(owner.action(api.oferte.actions.extrageMateriale, { idGenerare: offerId })).rejects.toThrow(`Maximum ${MAX_MATERIALS} materiale per fisier.`);
  expect((await document()).materialeExtrase).toBeUndefined();
});

test("AI analysis preserves leading blank rows and columns and resets downstream data", async () => {
  const { owner, offerId, document } = await fixture({ excelMapping: undefined });
  vi.stubEnv("GROQ_API_KEY", "test-key");
  let requested: { messages: { content: string }[] } | undefined;
  vi.stubGlobal("fetch", async (_: unknown, init: RequestInit) => {
    requested = JSON.parse(String(init.body));
    return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify(mapping) }, finish_reason: "stop", index: 0 }] });
  });
  await owner.action(api.oferte.actions.analizaExcelInput, { idGenerare: offerId });
  const sample = requested!.messages[1].content.split("\n\n")[1].split("\n");
  expect(sample[0]).toBe(",,,");
  expect(sample[3]).toMatch(/^,Cablu 3x1,/);
  expect((await document()).excelMapping?.randIncepereDate).toBe(4);
  expect((await document()).materialePotrivite).toBeUndefined();
});

test.each([
  ["EURO", "EUR"],
  [" euro ", "EUR"],
  ["EUROS", "EUR"],
  ["\u20ac", "EUR"],
  ["LEU", "RON"],
  [" lei ", "RON"],
  [" eur ", "EUR"],
  ["RON", "RON"],
  ["USD", "USD"],
])("AI analysis normalizes currency %s to %s before saving", async (valuta, expected) => {
  const { owner, offerId, document } = await fixture({ excelMapping: undefined });
  vi.stubEnv("GROQ_API_KEY", "test-key");
  vi.stubGlobal("fetch", async () => Response.json({
    choices: [{ message: { role: "assistant", content: JSON.stringify({ ...mapping, valuta }) }, finish_reason: "stop", index: 0 }],
  }));
  const result = await owner.action(api.oferte.actions.analizaExcelInput, { idGenerare: offerId });
  expect(result.valuta).toBe(expected);
  expect((await document()).excelMapping?.valuta).toBe(expected);
});

test("AI analysis still rejects an unrecognized currency name", async () => {
  const { owner, offerId, document } = await fixture({ excelMapping: undefined });
  vi.stubEnv("GROQ_API_KEY", "test-key");
  vi.stubGlobal("fetch", async () => Response.json({
    choices: [{ message: { role: "assistant", content: JSON.stringify({ ...mapping, valuta: "necunoscuta" }) }, finish_reason: "stop", index: 0 }],
  }));
  await expect(owner.action(api.oferte.actions.analizaExcelInput, { idGenerare: offerId })).rejects.toThrow("Valuta identificata nu este valida.");
  expect((await document()).excelMapping).toBeUndefined();
});

test("matching requires review for approximate and missing matches regardless of raw score", async () => {
  vi.stubEnv("TYPESENSE_SEARCH_KEY", "test-key");
  vi.spyOn(Typesense.Client.prototype, "collections").mockImplementation(() => ({
    documents: () => ({ search: async ({ q }: { q: string }) => ({
      hits: q === "missing" ? [] : [{ text_match: material.matchScore, document: {
        descriere: q === "exact" ? "exact" : "different", pretAchizitie: 10, pretVanzare: 15, manopera: 5,
      } }],
    }) }),
  }) as unknown as ReturnType<InstanceType<typeof Typesense.Client>["collections"]>);
  const { owner, offerId, document } = await fixture({ materialeExtrase: ["exact", "approximate", "missing"].map((descriere, index) => ({
    rand: index + 4, descriere, cantitate: 1, unitate: "buc",
  })) });
  await owner.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare: offerId });
  expect((await document()).materialePotrivite).toBeUndefined();
  expect((await owner.query(api.oferte.queries.listMateriale, { idGenerare: offerId, pendingOnly: false, paginationOpts: { numItems: 20, cursor: null } })).page.map(needsReview)).toEqual([false, true, true]);
});

test("export refuses pending validation without storing output", async () => {
  const { owner, offerId, document } = await fixture();
  await expect(owner.action(api.oferte.actions.genereazaExcelOutput, { idGenerare: offerId })).rejects.toThrow(/Valideaza/);
  expect((await document()).excelOutput).toBeUndefined();
});

test("output stores corrected quantities, prices, formulas and cached totals", async () => {
  const { backend, owner, offerId, document } = await fixture({ materialePotrivite: [{ ...material, validated: true, cantitate: 3, pretVanzare: 20 }] });
  await owner.action(api.oferte.actions.genereazaExcelOutput, { idGenerare: offerId });
  const oferta = await document();
  const stored = await backend.run(async (ctx) => {
    const blob = (await ctx.storage.get(oferta.excelOutput!.content))!;
    return { buffer: await blob.arrayBuffer(), type: blob.type };
  });
  const output = XLSX.read(stored.buffer, { type: "array" }).Sheets.Materiale;
  expect(output.C4.v).toBe(3);
  expect(output.H4.v).toBe(20);
  expect(output.I4.f).toBe("C4*H4");
  expect(output.I4.v).toBe(60);
  expect(output.L4.f).toBe("I4+K4");
  expect(output.L4.v).toBe(75);
  expect(stored.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect((await owner.query(api.oferte.queries.getOferta, { idGenerare: offerId })).downloadUrl).toBeTruthy();
});

test("output preserves original styles, worksheet layout and all other archive parts", () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([[], ["Title"], [null, "Description", "Quantity", "Unit"], [null, "Cable", 2, "m"]]);
  worksheet["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }];
  worksheet["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 12 }];
  worksheet["!rows"] = [{}, { hpt: 35 }, { hpt: 25 }, { hpt: 30 }];
  worksheet["!margins"] = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
  worksheet.C4.z = "0.000";
  XLSX.utils.book_append_sheet(workbook, worksheet, "Materiale");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Untouched"]]), "Other");
  const archive = unzipSync(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const styles = parser.parseFromString(strFromU8(archive["xl/styles.xml"]), "application/xml");
  const font = styles.getElementsByTagName("font")[0];
  font.appendChild(styles.createElement("b"));
  const color = styles.getElementsByTagName("color")[0];
  color.setAttribute("rgb", "FF336699");
  archive["xl/styles.xml"] = strToU8(serializer.serializeToString(styles));
  const input = new Uint8Array(zipSync(archive)).buffer;
  const output = unzipSync(new Uint8Array(populateWorkbook(input, mapping, [{ ...material, validated: true, cantitate: 3 }])));
  expect(Object.keys(output).sort()).toEqual(Object.keys(archive).sort());
  for (const path of Object.keys(archive)) {
    if (path !== "xl/worksheets/sheet1.xml") expect(output[path], path).toEqual(archive[path]);
  }
  const originalSheet = parser.parseFromString(strFromU8(archive["xl/worksheets/sheet1.xml"]), "application/xml");
  const outputSheet = parser.parseFromString(strFromU8(output["xl/worksheets/sheet1.xml"]), "application/xml");
  for (const tag of ["cols", "mergeCells", "sheetViews", "pageMargins"]) {
    expect(serializer.serializeToString(outputSheet.getElementsByTagName(tag)[0]))
      .toEqual(serializer.serializeToString(originalSheet.getElementsByTagName(tag)[0]));
  }
  const originalCells = Array.from(originalSheet.getElementsByTagName("c"));
  const outputCells = Array.from(outputSheet.getElementsByTagName("c"));
  for (const cell of originalCells) {
    const result = outputCells.find((candidate) => candidate.getAttribute("r") === cell.getAttribute("r"))!;
    if (cell.getAttribute("r") === "C4") expect(result.getAttribute("s")).toBe(cell.getAttribute("s"));
    else expect(serializer.serializeToString(result)).toBe(serializer.serializeToString(cell));
  }
  expect(Array.from(outputSheet.getElementsByTagName("row")).map((row) => row.getAttribute("ht")))
    .toEqual(Array.from(originalSheet.getElementsByTagName("row")).map((row) => row.getAttribute("ht")));
});

test("concurrent edits prevent publication of a stale output", async () => {
  const { owner, offerId, storageId, document } = await fixture({ materialePotrivite: [{ ...material, validated: true }], revision: 1 });
  await expect(owner.mutation(internal.oferte.mutations.updateExcelOutput, {
    idGenerare: offerId, expectedRevision: 0, excelOutput: { content: storageId, fileName: "stale.xlsx" },
  })).rejects.toThrow(/modificata/);
  expect((await document()).excelOutput).toBeUndefined();
});