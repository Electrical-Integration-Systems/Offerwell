/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import * as XLSX from "xlsx";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { blendSearch } from "../typesense";
import { alegePret } from "../laya";
import type { ExcelMapping } from "./mapping";
import type { Id } from "../_generated/dataModel";
import { getFlowError } from "./errors";
import { readFileSync } from "node:fs";
import { MAX_ANALYSIS_PROMPT_BYTES, MAX_ANALYSIS_COMPLETION_TOKENS } from "./excel_analysis";
import { NO_MATERIAL_MATCH } from "./matching";

const modules = import.meta.glob("/convex/**/*.ts");
const { completion } = vi.hoisted(() => ({ completion: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  chat = { completions: { create: completion } };
} }));
vi.mock("../typesense", () => ({ blendSearch: vi.fn(), textSearch: vi.fn() }));
vi.mock("../laya", () => ({ alegePret: vi.fn() }));

const firstMapping: ExcelMapping = {
  randIncepereDate: 2, coloanaDescriere: "A", coloanaCantitati: "B", coloanaUnitate: "C", coloanaSfarsitDate: "C", valuta: "EUR",
};
const secondMapping: ExcelMapping = {
  ...firstMapping, coloanaDescriere: "B", coloanaCantitati: "C", coloanaUnitate: "A", valuta: "RON",
};

async function fixture(selectedSheets = ["Electrice", "Instalații"]) {
  const t = convexTest(schema, modules);
  const book = XLSX.utils.book_new();
  // An empty first sheet must not prevent processing selected sheets.
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), "Copertă");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Material", "Cantitate", "UM"], ["Cablu", 2, "m"], ["Tub", 3, "m"],
  ]), "Electrice");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["UM", "Material", "Cantitate"], ["buc", "Robinet", 4],
  ]), "Instalații");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const { userId, content } = await t.run(async (ctx) => ({
    userId: await ctx.db.insert("users", { name: "Test" }),
    content: await ctx.storage.store(new Blob([bytes])),
  }));
  const user = t.withIdentity({ subject: userId });
  const idGenerare = await user.mutation(api.oferte.mutations.uploadInputExcel, { storageId: content, fileName: "mai-multe-foi.xlsx", selectedSheets });
  return { t, user, idGenerare };
}

test("extracts selected sheets with independent mappings and preserves duplicate row numbers", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 1, sheetName: "Instalații", excelMapping: secondMapping });
  // Resuming analysis with both structures available must not call the AI again.
  await user.action(api.oferte.actions.analizaExcelInput, { idGenerare });
  expect(await user.action(api.oferte.actions.extrageMateriale, { idGenerare })).toEqual({ success: true, count: 3 });
  const offer = await t.run((ctx) => ctx.db.get(idGenerare));
  expect(offer?.materialeExtrase).toEqual([
    { sheetName: "Electrice", rand: 2, descriere: "Cablu", cantitate: 2, unitate: "m" },
    { sheetName: "Electrice", rand: 3, descriere: "Tub", cantitate: 3, unitate: "m" },
    { sheetName: "Instalații", rand: 2, descriere: "Robinet", cantitate: 4, unitate: "buc" },
  ]);
});

test("matches, paginates, validates and exports each sheet without mixing rows or currencies", async () => {
  const { t, user, idGenerare } = await fixture();
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 1, sheetName: "Instalații", excelMapping: secondMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockImplementation(async (description) => ({ hits: description === "Cablu" ? [{
    document: { descriere: "Referință", pretAchizitie: 10, pretVanzare: 20, manopera: 2 },
  }] : [] }) as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockResolvedValue({ answers: { price: { choice: "Referință" } } } as Awaited<ReturnType<typeof alegePret>>);
  await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  const list = (sheetName: string, pendingOnly = false) => user.query(api.oferte.queries.listMateriale, {
    idGenerare, sheetName, pendingOnly, paginationOpts: { numItems: 10, cursor: null },
  });
  expect((await list("Electrice")).page).toHaveLength(2);
  expect((await list("Instalații")).page).toHaveLength(1);
  let revision = 4;
  for (const [sheetName, rand, cantitate] of [["Electrice", 2, 5], ["Electrice", 3, 3], ["Instalații", 2, 7]] as const) {
    await user.mutation(api.oferte.mutations.valideazaMaterial, {
      idGenerare, expectedRevision: revision++, sheetName, rand, cantitate, pretAchizitie: 10, pretVanzare: 20, manopera: 2,
    });
  }
  expect((await list("Electrice", true)).page).toHaveLength(0);
  expect((await list("Instalații")).page[0].cantitate).toBe(7);
  expect((await list("Electrice")).page[0].cantitate).toBe(5);
  await t.run((ctx) => ctx.db.insert("cursuriValutare", { moneda: "EUR", valoare: 5, dataActualizare: "2026-10-15" }));
  const result = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare });
  const bytes = await t.run(async (ctx) => (await ctx.storage.get(result.storageId as Id<"_storage">))!.arrayBuffer());
  const output = XLSX.read(bytes, { type: "array" });
  expect(output.SheetNames).toEqual(["Copertă", "Electrice", "Instalații"]);
  expect(output.Sheets["Copertă"].E1).toBeUndefined();
  expect(output.Sheets.Electrice.B2.v).toBe(5);
  expect(output.Sheets.Electrice.E2.v).toBe(10);
  expect(output.Sheets.Electrice.H2.f).toBe("B2*G2");
  expect(output.Sheets["Instalații"].C2.v).toBe(7);
  expect(output.Sheets["Instalații"].E2.v).toBe(50);
  expect(output.Sheets["Instalații"].H2.f).toBe("C2*G2");
});

test("rejects missing, unselected and incompletely mapped sheets", async () => {
  const { user, idGenerare } = await fixture();
  await expect(user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare, expectedRevision: 0, sheetName: "Copertă", excelMapping: firstMapping,
  })).rejects.toThrow("Foaia nu este selectată");
  await user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping,
  });
  await expect(user.action(api.oferte.actions.extrageMateriale, { idGenerare })).rejects.toThrow("Instalații");
  const missing = await fixture(["Inexistentă"]);
  await expect(missing.user.action(api.oferte.actions.salveazaStructuraExcel, {
    idGenerare: missing.idGenerare, expectedRevision: 0, sheetName: "Inexistentă", excelMapping: firstMapping,
  })).rejects.toThrow("lipsește sau este goală");
});

test("requires at least one distinct selected sheet", async () => {
  await expect(fixture([])).rejects.toThrow("foi distincte");
  await expect(fixture(["Electrice", "Electrice"])).rejects.toThrow("foi distincte");
});

test("analyzes each selected sheet and resumes after a failure without repeating completed sheets", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-key");
  try {
    const { user, idGenerare } = await fixture();
    completion.mockReset();
    completion.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(firstMapping) } }] });
    completion.mockRejectedValueOnce(new Error("Analiză întreruptă"));
    await expect(user.action(api.oferte.actions.analizaExcelInput, { idGenerare })).rejects.toThrow("Serviciul de analiză nu a răspuns");
    const partial = await user.query(api.oferte.queries.getOferta, { idGenerare });
    expect(partial.sheetMappings).toEqual([{ sheetName: "Electrice", mapping: firstMapping }]);
    completion.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(secondMapping) } }] });
    await user.action(api.oferte.actions.analizaExcelInput, { idGenerare });
    expect(completion).toHaveBeenCalledTimes(3);
    expect(completion.mock.calls[0][0].messages[1].content).toContain("Cablu");
    expect(completion.mock.calls[1][0].messages[1].content).toContain("Robinet");
    expect(completion.mock.calls[2][0].messages[1].content).toContain("Robinet");
    const offer = await user.query(api.oferte.queries.getOferta, { idGenerare });
    expect(offer.sheetMappings).toEqual([
      { sheetName: "Electrice", mapping: firstMapping }, { sheetName: "Instalații", mapping: secondMapping },
    ]);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("identifies the failing sheet even when other selected sheets contain materials", async () => {
  const { t, user, idGenerare } = await fixture();
  const source = await t.run(async (ctx) => {
    const offer = await ctx.db.get(idGenerare);
    return (await ctx.storage.get(offer!.excelInput.content))!.arrayBuffer();
  });
  const workbook = XLSX.read(source, { type: "array" });
  workbook.Sheets["Instalații"].D1 = { t: "s", v: "Note" };
  workbook.Sheets["Instalații"]["!ref"] = "A1:D2";
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  await t.run(async (ctx) => {
    const content = await ctx.storage.store(new Blob([bytes]));
    await ctx.db.patch(idGenerare, {
      excelInput: { content, fileName: "test.xlsx" }, excelMapping: firstMapping,
      sheetMappings: [{ sheetName: "Electrice", mapping: firstMapping }, {
        sheetName: "Instalații", mapping: { ...secondMapping, coloanaDescriere: "D", coloanaSfarsitDate: "D" },
      }],
    });
  });
  const error = await user.action(api.oferte.actions.extrageMateriale, { idGenerare }).catch((caught: unknown) => getFlowError(caught, "extraction"));
  expect(error).toMatchObject({ code: "STRUCTURE", recovery: "structure", sheetName: "Instalații" });
  const offer = await user.query(api.oferte.queries.getOferta, { idGenerare });
  expect(offer.hasExtracted).toBe(false);
  expect(offer.revision).toBe(0);
});

test("complete search failures can be retried without saving zero prices as a successful offer", async () => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockRejectedValue(new Error("Typesense is unavailable"));
  const error = await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare }).catch((caught: unknown) => getFlowError(caught, "matching"));
  expect(error).toMatchObject({ code: "SEARCH_UNAVAILABLE", recovery: "retry" });
  expect(await user.query(api.oferte.queries.getOferta, { idGenerare })).toMatchObject({ hasMatched: false, hasExtracted: true, revision: 2 });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  expect(await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).toEqual({ success: true, count: 2, failedCount: 0 });
});

test("partial search failures remain visible and require manual validation", async () => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValueOnce({ hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>).mockRejectedValueOnce(new Error("timeout"));
  expect(await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).toEqual({ success: true, count: 2, failedCount: 1 });
  const rows = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Electrice", pendingOnly: true, paginationOpts: { numItems: 10, cursor: null } });
  expect(rows.page.some((row) => row.descriereGasita === "Eroare la căutare")).toBe(true);
  await expect(user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare })).rejects.toThrow("Valideaza toate");
});

test("malformed AI output prompts manual correction for the correct sheet", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-key");
  try {
    const { user, idGenerare } = await fixture();
    completion.mockReset();
    completion.mockResolvedValueOnce({ choices: [{ message: { content: "invalid json" } }] });
    const error = await user.action(api.oferte.actions.analizaExcelInput, { idGenerare }).catch((caught: unknown) => getFlowError(caught, "analysis"));
    expect(error).toMatchObject({ code: "STRUCTURE", recovery: "structure", sheetName: "Electrice" });
    expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).sheetMappings).toBeUndefined();
  } finally {
    vi.unstubAllEnvs();
  }
});

test("matching strips units for search and AI but keeps the original description in validation and export", async () => {
  const { t, user, idGenerare } = await fixture(["Electrice"]);
  const original = "Cablu 3×2,5 mm²";
  const reference = "Cablu 3x2,5mmp";
  const source = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(source, XLSX.utils.aoa_to_sheet([["Material", "Cantitate", "UM"], [original, 3, "m"]]), "Electrice");
  const bytes = XLSX.write(source, { type: "array", bookType: "xlsx" });
  await t.run(async (ctx) => {
    const content = await ctx.storage.store(new Blob([bytes]));
    await ctx.db.patch(idGenerare, { excelInput: { content, fileName: "unitati.xlsx" } });
  });
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockClear();
  vi.mocked(alegePret).mockClear();
  vi.mocked(blendSearch).mockResolvedValue({ hits: [{ document: { descriere: reference, pretAchizitie: 10, pretVanzare: 20, manopera: 2 } }] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockResolvedValue({ answers: { price: { choice: "Cablu 3x2,5" } } } as Awaited<ReturnType<typeof alegePret>>);
  await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  expect(blendSearch).toHaveBeenCalledWith("Cablu 3x2,5", 10);
  expect(alegePret).toHaveBeenCalledWith("Cablu 3x2,5", [expect.objectContaining({ descriere: "Cablu 3x2,5" })]);
  const rows = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Electrice", pendingOnly: false, paginationOpts: { numItems: 10, cursor: null } });
  expect(rows.page[0]).toMatchObject({ descriereOriginala: original, descriereGasita: reference, unitate: "m", cantitate: 3, matchScore: 10, requiresValidation: false });
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))?.materialeExtrase?.[0].descriere).toBe(original);
  const output = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare });
  const buffer = await t.run(async (ctx) => (await ctx.storage.get(output.storageId as Id<"_storage">))!.arrayBuffer());
  expect(XLSX.read(buffer, { type: "array" }).Sheets.Electrice.A2.v).toBe(original);
});

test("Laya can reject all candidates; unmatched rows require manual prices or a new selection before export", async () => {
  const { t, user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [{ document: { descriere: "Robinet", pretAchizitie: 100, pretVanzare: 150, manopera: 20 } }] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockResolvedValue({ answers: { price: { choice: NO_MATERIAL_MATCH } } } as Awaited<ReturnType<typeof alegePret>>);
  expect(await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).toEqual({ success: true, count: 2, failedCount: 0 });
  const rows = await user.query(api.oferte.queries.listMateriale, { idGenerare, sheetName: "Electrice", pendingOnly: true, paginationOpts: { numItems: 10, cursor: null } });
  expect(rows.page).toHaveLength(2);
  for (const row of rows.page) expect(row).toMatchObject({ descriereGasita: "Nu a fost găsit în baza de date", pretAchizitie: 0,
    pretVanzare: 0, manopera: 0, validated: false, requiresValidation: true, matchedTokens: [], pending: true });
  expect(rows.page.map((row) => row.descriereOriginala)).toEqual(["Cablu", "Tub"]);
  await expect(user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare })).rejects.toThrow("Valideaza toate materialele");
  // Manual prices are sufficient without forcing a catalog reference.
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: 3, sheetName: "Electrice", rand: 2,
    cantitate: 2, pretAchizitie: 10, pretVanzare: 15, manopera: 2 });
  // Alternatively, the user can choose a catalog material and then validate it.
  await user.mutation(api.oferte.mutations.schimbaMaterial, { idGenerare, expectedRevision: 4, sheetName: "Electrice", rand: 3,
    descriere: "Tub din catalog", pretAchizitie: 20, pretVanzare: 25, manopera: 3 });
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: 5, sheetName: "Electrice", rand: 3,
    cantitate: 3, pretAchizitie: 20, pretVanzare: 25, manopera: 3 });
  const result = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare });
  const bytes = await t.run(async (ctx) => (await ctx.storage.get(result.storageId as Id<"_storage">))!.arrayBuffer());
  const output = XLSX.read(bytes, { type: "array" }).Sheets.Electrice;
  expect(output.A2.v).toBe("Cablu");
  expect(output.A3.v).toBe("Tub");
  expect(output.E2.v).toBe(10);
  expect(output.E3.v).toBe(20);
});

test("reports completed batches while matching is still running, then finishes at the exact total", async () => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.mutation(internal.oferte.mutations.updateMaterialeExtrase, { idGenerare, expectedRevision: 0,
    materialeExtrase: Array.from({ length: 21 }, (_, index) => ({ sheetName: "Electrice", rand: index + 2,
      descriere: `Material ${index}`, cantitate: 1, unitate: "buc" })) });
  let release!: () => void;
  let secondBatchStarted!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { secondBatchStarted = resolve; });
  vi.mocked(blendSearch).mockImplementation(async (description) => {
    if (Number(description.split(" ")[1]) >= 10) { secondBatchStarted(); await blocked; }
    return { hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>;
  });
  const matching = user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  await started;
  try {
    const intermediate = await user.query(api.oferte.queries.getOferta, { idGenerare });
    expect(intermediate.matchingProgress).toMatchObject({ completed: 10, total: 21, status: "running" });
    expect(intermediate.revision).toBe(1);
    expect(intermediate.hasMatched).toBe(false);
  } finally { release(); }
  await expect(matching).resolves.toMatchObject({ count: 21, failedCount: 0 });
  const done = await user.query(api.oferte.queries.getOferta, { idGenerare });
  expect(done.matchingProgress).toMatchObject({ completed: 21, total: 21, status: "completed" });
  expect(done.revision).toBe(2);
  expect(done.hasMatched).toBe(true);
});

test("confirmed exports include unvalidated materials, preserve review state and can be regenerated from current prices", async () => {
  const { t, user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [{ document: { descriere: "Referință", pretAchizitie: 10, pretVanzare: 15, manopera: 2 } }] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockResolvedValue({ answers: { price: { choice: "Referință" } } } as Awaited<ReturnType<typeof alegePret>>);
  await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  await expect(user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare })).rejects.toThrow("confirmă generarea");
  const first = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: true });
  expect(first.downloadUrl).toBeTruthy();
  expect(first.fileName).toBe("mai-multe-foi.xlsx");
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).pendingCount).toBe(2);
  const second = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: true });
  expect(second.storageId).not.toBe(first.storageId);
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.excelOutput!.content).toBe(second.storageId);
  await user.mutation(api.oferte.mutations.valideazaMaterial, { idGenerare, expectedRevision: 3, sheetName: "Electrice", rand: 2,
    cantitate: 9, pretAchizitie: 20, pretVanzare: 30, manopera: 4 });
  await expect(user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: false })).rejects.toThrow("confirmă generarea");
  const regenerated = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: true });
  const bytes = await t.run(async (ctx) => (await ctx.storage.get(regenerated.storageId as Id<"_storage">))!.arrayBuffer());
  const output = XLSX.read(bytes, { type: "array" }).Sheets.Electrice;
  expect(output.A2.v).toBe("Cablu");
  expect(output.B2.v).toBe(9);
  expect(output.E2.v).toBe(20);
  expect(output.G2.v).toBe(30);
  expect(output.H2.v).toBe(270);
  const pending = await user.query(api.oferte.queries.listMateriale, { idGenerare, pendingOnly: true, paginationOpts: { numItems: 10, cursor: null } });
  expect(pending.page).toHaveLength(1);
  expect(pending.page[0]).toMatchObject({ rand: 3, validated: false });
});

test("confirmed exports include zero prices for unmatched materials without validating them", async () => {
  const { t, user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  const generated = await user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: true });
  const bytes = await t.run(async (ctx) => (await ctx.storage.get(generated.storageId as Id<"_storage">))!.arrayBuffer());
  const output = XLSX.read(bytes, { type: "array" }).Sheets.Electrice;
  expect(output.E2.v).toBe(0);
  expect(output.E3.v).toBe(0);
  expect(output.A3.v).toBe("Tub");
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).pendingCount).toBe(2);
});

test.each([{ cantitate: NaN }, { pretAchizitie: -1 }, { manopera: Infinity }])("confirmation does not allow invalid numeric values into Excel (%j)", async (invalid) => {
  const { t, user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  await t.run(async (ctx) => {
    const row = await ctx.db.query("ofertaMateriale").first();
    await ctx.db.patch(row!._id, invalid);
  });
  await expect(user.action(api.oferte.actions.genereazaExcelOutput, { idGenerare, allowUnvalidated: true })).rejects.toThrow("Corectează valorile nevalide");
  expect((await t.run((ctx) => ctx.db.get(idGenerare)))!.excelOutput).toBeUndefined();
});

test("failed matching stops its progress indicator and a retry starts from zero", async () => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockRejectedValue(new Error("Unavailable"));
  await expect(user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).rejects.toThrow("Căutarea prețurilor nu este disponibilă");
  const failed = await user.query(api.oferte.queries.getOferta, { idGenerare });
  expect(failed.matchingProgress).toMatchObject({ completed: 2, total: 2, status: "failed" });
  expect(failed.hasMatched).toBe(false);
  let release!: () => void;
  let signalStarted!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  vi.mocked(blendSearch).mockImplementation(async () => {
    signalStarted(); await blocked;
    return { hits: [] } as unknown as Awaited<ReturnType<typeof blendSearch>>;
  });
  const matching = user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare });
  await started;
  try {
    const retry = await user.query(api.oferte.queries.getOferta, { idGenerare });
    expect(retry.matchingProgress).toMatchObject({ completed: 0, total: 2, status: "running" });
    expect(retry.matchingProgress?.runId).not.toBe(failed.matchingProgress?.runId);
  } finally { release(); }
  await matching;
});

test("progress from a superseded run cannot overwrite the new run or save old matching results", async () => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  const args = { idGenerare, expectedRevision: 2 };
  await user.mutation(internal.oferte.mutations.startMatching, { ...args, runId: "first" });
  await user.mutation(internal.oferte.mutations.reportMatchingProgress, { ...args, runId: "first", completed: 1, status: "running" });
  await user.mutation(internal.oferte.mutations.startMatching, { ...args, runId: "second" });
  expect(await user.mutation(internal.oferte.mutations.reportMatchingProgress, { ...args, runId: "first", completed: 2, status: "failed" })).toBe(false);
  await expect(user.mutation(internal.oferte.mutations.updateMaterialePotrivite, { ...args, matchingRunId: "first", materialePotrivite: [] })).rejects.toThrow();
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).matchingProgress).toMatchObject({ runId: "second", completed: 0, status: "running" });
  await user.action(api.oferte.actions.salveazaStructuraExcel, { ...args, sheetName: "Electrice", excelMapping: { ...firstMapping, randIncepereDate: 3 } });
  expect(await user.mutation(internal.oferte.mutations.reportMatchingProgress, { ...args, runId: "second", completed: 2, status: "running" })).toBe(false);
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).matchingProgress).toBeUndefined();
});

test.each([undefined, "Un candidat inexistent"])("an invalid Laya choice (%s) never silently selects the first candidate", async (choice) => {
  const { user, idGenerare } = await fixture(["Electrice"]);
  await user.action(api.oferte.actions.salveazaStructuraExcel, { idGenerare, expectedRevision: 0, sheetName: "Electrice", excelMapping: firstMapping });
  await user.action(api.oferte.actions.extrageMateriale, { idGenerare });
  vi.mocked(blendSearch).mockResolvedValue({ hits: [{ document: { descriere: "Referință", pretAchizitie: 100, pretVanzare: 150, manopera: 20 } }] } as unknown as Awaited<ReturnType<typeof blendSearch>>);
  vi.mocked(alegePret).mockImplementation(async (material) => ({ answers: { price: { choice: material === "Cablu" ? choice : "Referință" } } }) as Awaited<ReturnType<typeof alegePret>>);
  expect(await user.action(api.oferte.actions.cautaSiPopuleazaPreturi, { idGenerare })).toMatchObject({ success: true, failedCount: 1 });
  const rows = await user.query(api.oferte.queries.listMateriale, { idGenerare, pendingOnly: false, paginationOpts: { numItems: 10, cursor: null } });
  expect(rows.page[0]).toMatchObject({ descriereGasita: "Eroare la căutare", pretAchizitie: 0, requiresValidation: true });
  expect(rows.page[1]).toMatchObject({ descriereGasita: "Referință", pretAchizitie: 100 });
});

test("the reported BoQ file produces bounded analysis requests and correct real export columns", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-key");
  try {
    const { t, user, idGenerare } = await fixture(["F3_CTCS", "F4_CTCS"]);
    const bytes = new Uint8Array(readFileSync(new URL("../../../tests/in/Anexa_preturi_BoQ - Achizitie.xlsx", import.meta.url))).buffer;
    await t.run(async (ctx) => {
      const content = await ctx.storage.store(new Blob([bytes]));
      await ctx.db.patch(idGenerare, { excelInput: { content, fileName: "Anexa_preturi_BoQ - Achizitie.xlsx" } });
    });
    completion.mockReset();
    completion.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ ...firstMapping, randIncepereDate: 17, coloanaDescriere: "C", coloanaCantitati: "E", coloanaUnitate: "D", coloanaSfarsitDate: "K" }) } }] });
    completion.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ ...firstMapping, randIncepereDate: 32, coloanaDescriere: "C", coloanaCantitati: "E", coloanaUnitate: "D", coloanaSfarsitDate: "H" }) } }] });
    await user.action(api.oferte.actions.analizaExcelInput, { idGenerare });
    expect(completion).toHaveBeenCalledTimes(2);
    for (const [request] of completion.mock.calls) {
      expect(new TextEncoder().encode(request.messages.map((message: { content: string }) => message.content).join("")).length).toBeLessThanOrEqual(MAX_ANALYSIS_PROMPT_BYTES);
      expect(request.max_completion_tokens).toBe(MAX_ANALYSIS_COMPLETION_TOKENS);
      expect(request.reasoning_effort).toBe("low");
    }
    expect(completion.mock.calls[0][0].messages[1].content).toContain('C17="Tablou electric general TEG');
    expect(completion.mock.calls[1][0].messages[1].content).toContain('C32="Centrala de detectie incendiu"');
    const offer = await user.query(api.oferte.queries.getOferta, { idGenerare });
    expect(offer.sheetMappings?.map((entry) => entry.mapping.coloanaSfarsitDate)).toEqual(["L", "O"]);
  } finally { vi.unstubAllEnvs(); }
});

test("a 413 response retries once with a smaller sample", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-key");
  try {
    const { t, user, idGenerare } = await fixture(["Electrice"]);
    const source = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(source, XLSX.utils.aoa_to_sheet([
      ["Material", "Cantitate", "UM"], ...Array.from({ length: 60 }, (_, index) => [`Cablu ${index} ${"descriere ".repeat(20)}`, 1, "m"]),
    ]), "Electrice");
    const bytes = XLSX.write(source, { type: "array", bookType: "xlsx" });
    await t.run(async (ctx) => {
      const content = await ctx.storage.store(new Blob([bytes]));
      await ctx.db.patch(idGenerare, { excelInput: { content, fileName: "mare.xlsx" } });
    });
    completion.mockReset();
    completion.mockRejectedValueOnce({ status: 413 });
    completion.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(firstMapping) } }] });
    await user.action(api.oferte.actions.analizaExcelInput, { idGenerare });
    expect(completion).toHaveBeenCalledTimes(2);
    expect(completion.mock.calls[1][0].messages[1].content.length).toBeLessThan(completion.mock.calls[0][0].messages[1].content.length);
    expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).excelMapping).toBeDefined();
  } finally { vi.unstubAllEnvs(); }
});

test.each([413, 429])("persistent provider limit %i has a recoverable message and bounded retries", async (status) => {
  vi.stubEnv("GROQ_API_KEY", "test-key");
  try {
    const { user, idGenerare } = await fixture(["Electrice"]);
    completion.mockReset(); completion.mockRejectedValue({ status });
    const error = await user.action(api.oferte.actions.analizaExcelInput, { idGenerare }).catch((caught: unknown) => getFlowError(caught, "analysis"));
    expect(error).toMatchObject({ code: "ANALYSIS_UNAVAILABLE", recovery: "structure", sheetName: "Electrice" });
    expect(completion).toHaveBeenCalledTimes(status === 413 ? 2 : 1);
    expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).excelMapping).toBeUndefined();
  } finally { vi.unstubAllEnvs(); }
});
