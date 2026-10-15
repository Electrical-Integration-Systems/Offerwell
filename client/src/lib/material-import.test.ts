// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as XLSX from "xlsx";
import { MAX_MATERIAL_IMPORT_ROWS, parseMaterialImport } from "./material-import";

const header = "descriere,pretAchizitie,pretVanzare,manopera,,\n";
const csv = (text: string) => parseMaterialImport(new TextEncoder().encode(text), "materiale.csv");

test("imports the reference CSV and its XLSX equivalent with matching materials", () => {
  const source = new URL("../../../typesense/collections/", import.meta.url);
  const materials = parseMaterialImport(readFileSync(new URL("materiale.csv", source)), "materiale.csv");
  expect(materials[0].material).toEqual({ descriere: "Camin prefabricat din beton", pretAchizitie: 1700, pretVanzare: 2125, manopera: 300 });
  expect(materials[2].material).toEqual({ descriere: "Tub corugat PEHD 90''", pretAchizitie: 1.74, pretVanzare: 2.175, manopera: 1.2 });
  const book = XLSX.read(readFileSync(new URL("materiale.csv", source)), { type: "buffer", raw: true, FS: "," });
  book.Sheets[book.SheetNames[0]].A1.v = "Descriere";
  const excel = parseMaterialImport(new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" })), "materiale.xlsx");
  expect(excel.map((entry) => entry.material)).toEqual(materials.map((entry) => entry.material));
});

test("accepts BOM, quotes, escaped quotes, commas, multiline descriptions and empty rows", () => {
  const result = csv('\uFEFF' + header + '\n"Tub, metalic ""20mm""",2.5,3,0,,\n"Descriere\nmultilinie","1,74",0,,,\n');
  expect(result[0]).toEqual({ row: 3, material: { descriere: 'Tub, metalic "20mm"', pretAchizitie: 2.5, pretVanzare: 3, manopera: 0 } });
  expect(result[1].material).toEqual({ descriere: "Descriere\nmultilinie", pretAchizitie: 1.74, pretVanzare: 2.175, manopera: 0 });
});

test("reads native numeric XLSX cells", () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["descriere", "pretAchizitie", "pretVanzare", "manopera"], ["Cablu", 1.25, 2.5, 0.2],
  ]), "Materiale");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  expect(parseMaterialImport(new Uint8Array(bytes), "materiale.xlsx")[0].material)
    .toEqual({ descriere: "Cablu", pretAchizitie: 1.25, pretVanzare: 2.5, manopera: 0.2 });
});

test("rejects invalid headers, empty files, invalid prices and nonempty extra columns", () => {
  expect(() => csv("descriere,pret\nCablu,1")).toThrow("Prima linie");
  expect(() => csv(header)).toThrow("nu conține materiale");
  for (const price of ["-1", "Infinity", "NaN", "0x10", "abc", "2147483648"]) {
    expect(() => csv(header + `Cablu,${price},0,0,,`)).toThrow("Rândul 2: pretAchizitie");
  }
  expect(() => csv(header + "Cablu,1,0,0,extra,")).toThrow("coloanele");
  expect(() => csv(header + "ab,1,0,0,,")).toThrow("descrierea");
});

test("rejects oversized row counts instead of silently truncating", () => {
  expect(() => csv(header + "Cablu,1,0,0,,\n".repeat(MAX_MATERIAL_IMPORT_ROWS + 1))).toThrow("maximum 10000");
});
