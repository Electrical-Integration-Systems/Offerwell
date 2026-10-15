import { test, expect, afterAll } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMaterialsFromCSV } from "./csv";

const directory = await mkdtemp(join(tmpdir(), "offerwell-csv-"));
afterAll(() => rm(directory, { recursive: true, force: true }));
async function fixture(name: string, content: string) {
  const path = join(directory, name);
  await writeFile(path, content);
  return path;
}

test("reads BOM headers, extra empty columns and spreadsheet-quoted values", async () => {
  const path = await fixture("spreadsheet.csv", '\uFEFFdescriere,pretAchizitie,pretVanzare,manopera,,\n"""Camin, beton""","""1700""","""0""","""300""",,\n"""Tub 90\'\'","""1.74\'\'","""0""","""1.2\'\'",,\n');
  expect(await loadMaterialsFromCSV(path)).toEqual([
    { descriere: "Camin, beton", pretAchizitie: 1700, pretVanzare: 2125, manopera: 300 },
    { descriere: "Tub 90''", pretAchizitie: 1.74, pretVanzare: 2.175, manopera: 1.2 },
  ]);
});

test("reads ordinary CSV and empty prices", async () => {
  const path = await fixture("normal.csv", 'descriere,pretAchizitie,pretVanzare,manopera\n"Tub, metalic",2,3,\n');
  expect(await loadMaterialsFromCSV(path)).toEqual([
    { descriere: "Tub, metalic", pretAchizitie: 2, pretVanzare: 3, manopera: 0 },
  ]);
});

test("normalizes measurement units before indexing while keeping dimensions and prices", async () => {
  const path = await fixture("units.csv", 'descriere,pretAchizitie,pretVanzare,manopera\n"Tub metalic 20mm",2,3,1\n"Cablu 3x2,5mmp",4,5,2\n"Cablu 3×2,5 mm²",6,7,3\n"Platbanda 40x4 mm",8,9,4\n');
  expect(await loadMaterialsFromCSV(path)).toEqual([
    { descriere: "Tub metalic 20", pretAchizitie: 2, pretVanzare: 3, manopera: 1 },
    { descriere: "Cablu 3x2,5", pretAchizitie: 4, pretVanzare: 5, manopera: 2 },
    { descriere: "Cablu 3x2,5", pretAchizitie: 6, pretVanzare: 7, manopera: 3 },
    { descriere: "Platbanda 40x4", pretAchizitie: 8, pretVanzare: 9, manopera: 4 },
  ]);
});

test("rejects descriptions that contain only measurement units", async () => {
  const path = await fixture("only-units.csv", "descriere,pretAchizitie,pretVanzare,manopera\nmm mmp,2,0,0\n");
  await expect(loadMaterialsFromCSV(path)).rejects.toThrow("descriere is empty");
});

test("rejects missing columns", async () => {
  const path = await fixture("headers.csv", "description,price\nTub,2\n");
  await expect(loadMaterialsFromCSV(path)).rejects.toThrow("missing required columns");
});

test("rejects invalid prices and empty descriptions", async () => {
  const header = "descriere,pretAchizitie,pretVanzare,manopera\n";
  const price = await fixture("price.csv", header + "Tub,invalid,0,0\n");
  await expect(loadMaterialsFromCSV(price)).rejects.toThrow("row 2: invalid pretAchizitie");
  const description = await fixture("description.csv", header + ",2,0,0\n");
  await expect(loadMaterialsFromCSV(description)).rejects.toThrow("row 2: descriere is empty");
});

test("rejects unreadable files", async () => {
  await expect(loadMaterialsFromCSV(join(directory, "missing.csv"))).rejects.toThrow();
});

