import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { buildWorksheetSample, worksheetContentRange, MAX_ANALYSIS_SAMPLE_BYTES } from "./excel_analysis";

test("the reported BoQ workbook has bounded samples and ignores formatted empty columns", () => {
  const book = XLSX.read(readFileSync(new URL("../../../tests/in/Anexa_preturi_BoQ - Achizitie.xlsx", import.meta.url)), { type: "buffer", cellStyles: true });
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    const sample = buildWorksheetSample(sheet);
    expect(new TextEncoder().encode(sample).length).toBeLessThanOrEqual(MAX_ANALYSIS_SAMPLE_BYTES);
    expect(XLSX.utils.decode_range(sheet["!ref"]!).e.c).toBeGreaterThan(1000);
    expect(worksheetContentRange(sheet).e.c).toBeLessThan(20);
  }
  const f3 = buildWorksheetSample(book.Sheets.F3_CTCS);
  expect(f3).toContain('C17="Tablou electric general TEG');
  expect(f3).toContain('E17="1"');
  const f4 = buildWorksheetSample(book.Sheets.F4_CTCS);
  expect(f4).toContain('C32="Centrala de detectie incendiu"');
  expect(f4).toContain('D32="buc"');
  expect(f4).toContain('E32="1"');
  expect(XLSX.utils.encode_col(worksheetContentRange(book.Sheets.F3_CTCS).e.c)).toBe("L");
  expect(XLSX.utils.encode_col(worksheetContentRange(book.Sheets.F4_CTCS).e.c)).toBe("O");
});

test("sampling preserves absolute addresses with long gaps and material rows after row 30", () => {
  const sheet: XLSX.WorkSheet = {
    "!ref": "A1:XFD1000", A1: { t: "s", v: "Listă de materiale" },
    C70: { t: "s", v: "Denumire" }, E70: { t: "s", v: "Cantități" }, G70: { t: "s", v: "U.M." },
    C83: { t: "s", v: "Cablu 3x2,5 mm²" }, E83: { t: "n", v: 15 }, G83: { t: "s", v: "m" },
    XFD999: { t: "z" },
  };
  const sample = buildWorksheetSample(sheet);
  expect(sample).toContain('R70: C70="Denumire"');
  expect(sample).toContain('R83: C83="Cablu 3x2,5 mm²"; E83="15"; G83="m"');
  expect(worksheetContentRange(sheet)).toEqual({ s: { r: 0, c: 0 }, e: { r: 82, c: 6 } });
});

test("large Unicode cells and very wide populated rows respect the byte budget", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Descriere", "Cantitate", "UM", ...Array.from({ length: 200 }, () => "Notă ".repeat(500))],
    ["Cablu șțăîâ 😀 ".repeat(1000), 12, "m"],
  ]);
  for (const budget of [4500, 2250, 1000, 100]) {
    expect(new TextEncoder().encode(buildWorksheetSample(sheet, budget)).length).toBeLessThanOrEqual(budget);
  }
});
