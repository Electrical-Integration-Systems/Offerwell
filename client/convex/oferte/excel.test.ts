import { expect, test } from "vitest";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { populateWorkbook } from "./excel";
import type { MatchedMaterial } from "./review";
import { readFileSync } from "node:fs";

const mapping = { randIncepereDate: 2, coloanaDescriere: "A", coloanaCantitati: "B", coloanaUnitate: "C", coloanaSfarsitDate: "C", valuta: "EUR" };
const material: MatchedMaterial = { rand: 2, descriereOriginala: "Cablu", descriereGasita: "Cablu", cantitate: 3, unitate: "m", matchScore: 10, pretAchizitie: 1000.25, pretVanzare: 1500, manopera: 12.5, validated: true };

function fixture() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Material", "Cantitate", "UM"], ["Cablu", 3, "m"]]), "Lista");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Păstrează această foaie", 123]]), "Copertă");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function parse(archive: Record<string, Uint8Array>, path: string) {
  return new DOMParser().parseFromString(strFromU8(archive[path]), "application/xml");
}

test("BoQ exports remove the obsolete calculation chain and its package references while preserving external links and other sheets", () => {
  const source = new Uint8Array(readFileSync(new URL("../../../tests/in/Anexa_preturi_BoQ - Achizitie.xlsx", import.meta.url))).buffer;
  const original = unzipSync(new Uint8Array(source));
  expect(original["xl/calcChain.xml"]).toBeDefined();
  const sourceSheet = parse(original, "xl/worksheets/sheet1.xml");
  const quantity = Array.from(sourceSheet.getElementsByTagNameNS("*", "c")).find((cell) => cell.getAttribute("r") === "E35")!;
  expect(quantity.getElementsByTagNameNS("*", "f").length).toBe(1);
  const output = unzipSync(new Uint8Array(populateWorkbook(source, { ...mapping, randIncepereDate: 17, coloanaDescriere: "C", coloanaCantitati: "E", coloanaUnitate: "D", coloanaSfarsitDate: "L" }, [{ ...material, rand: 35 }], 1, "F3_CTCS")));
  expect(output["xl/calcChain.xml"]).toBeUndefined();
  const relationships = parse(output, "xl/_rels/workbook.xml.rels");
  expect(Array.from(relationships.getElementsByTagNameNS("*", "Relationship")).some((link) => link.getAttribute("Type")?.endsWith("/calcChain"))).toBe(false);
  const contentTypes = parse(output, "[Content_Types].xml");
  expect(Array.from(contentTypes.getElementsByTagNameNS("*", "Override")).some((entry) => entry.getAttribute("PartName") === "/xl/calcChain.xml" || entry.getAttribute("ContentType")?.endsWith(".calcChain+xml"))).toBe(false);
  const resultSheet = parse(output, "xl/worksheets/sheet1.xml");
  const changed = Array.from(resultSheet.getElementsByTagNameNS("*", "c")).find((cell) => cell.getAttribute("r") === "E35")!;
  expect(changed.getElementsByTagNameNS("*", "f").length).toBe(0);
  expect(changed.getElementsByTagNameNS("*", "v")[0].textContent).toBe("3");
  expect(output["xl/worksheets/sheet2.xml"]).toEqual(original["xl/worksheets/sheet2.xml"]);
  for (const path of Object.keys(original).filter((path) => path.startsWith("xl/externalLinks/"))) expect(output[path]).toEqual(original[path]);
  const workbook = parse(output, "xl/workbook.xml");
  const calculation = workbook.getElementsByTagNameNS("*", "calcPr")[0];
  expect(calculation.getAttribute("fullCalcOnLoad")).toBe("1");
  expect(calculation.getAttribute("forceFullCalc")).toBe("1");
});

test("export headers and values use the reference colors, bold text and two decimal places", () => {
  const bytes = populateWorkbook(fixture(), mapping, [material]);
  const output = unzipSync(new Uint8Array(bytes));
  const sheet = parse(output, "xl/worksheets/sheet1.xml");
  const styles = parse(output, "xl/styles.xml");
  const formats = styles.getElementsByTagNameNS("*", "cellXfs")[0].getElementsByTagNameNS("*", "xf");
  const fonts = styles.getElementsByTagNameNS("*", "fonts")[0].getElementsByTagNameNS("*", "font");
  const columns = ["E", "F", "G", "H", "I", "J"];
  const colors = ["FFFF0000", "FFFF0000", "FF00B050", "FF00B050", "FF000000", "FF000000"];
  for (const [index, column] of columns.entries()) {
    for (const row of [1, 2]) {
      const cell = Array.from(sheet.getElementsByTagNameNS("*", "c")).find((entry) => entry.getAttribute("r") === `${column}${row}`)!;
      const format = formats[Number(cell.getAttribute("s"))];
      const font = fonts[Number(format.getAttribute("fontId"))];
      expect(font.getElementsByTagNameNS("*", "color")[0].getAttribute("rgb")).toBe(colors[index]);
      expect(font.getElementsByTagNameNS("*", "b").length).toBe(1);
      expect(format.getAttribute("numFmtId")).toBe(row === 1 ? "0" : "4");
      const alignment = format.getElementsByTagNameNS("*", "alignment")[0];
      expect(alignment.getAttribute("horizontal")).toBe(row === 1 ? "center" : "right");
      if (row === 1) expect(alignment.getAttribute("wrapText")).toBe("1");
    }
  }
  expect(sheet.getElementsByTagNameNS("*", "col").length).toBe(6);
  const exported = XLSX.read(bytes, { type: "array" });
  expect(exported.Sheets.Lista.F1.v).toBe("ACHIZIȚIE\nTOTAL");
  expect(exported.Sheets.Lista.K1).toBeUndefined();
  expect(exported.Sheets.Lista.K2).toBeUndefined();
});

test("styles and contents outside the generated columns are preserved", () => {
  const input = fixture();
  const original = unzipSync(new Uint8Array(input));
  const output = unzipSync(new Uint8Array(populateWorkbook(input, mapping, [material])));
  expect(output["xl/worksheets/sheet2.xml"]).toEqual(original["xl/worksheets/sheet2.xml"]);
  const sourceFonts = parse(original, "xl/styles.xml").getElementsByTagNameNS("*", "fonts")[0].getElementsByTagNameNS("*", "font");
  const resultFonts = parse(output, "xl/styles.xml").getElementsByTagNameNS("*", "fonts")[0].getElementsByTagNameNS("*", "font");
  for (let index = 0; index < sourceFonts.length; index++) expect(new XMLSerializer().serializeToString(resultFonts[index])).toBe(new XMLSerializer().serializeToString(sourceFonts[index]));
});

test("generated cells have no fill or border even when the source's base style has both", () => {
  const original = unzipSync(new Uint8Array(fixture()));
  const sourceStyles = parse(original, "xl/styles.xml");
  const create = (name: string) => sourceStyles.createElementNS(sourceStyles.documentElement!.namespaceURI, name);
  const pattern = sourceStyles.getElementsByTagNameNS("*", "fills")[0].getElementsByTagNameNS("*", "patternFill")[0];
  pattern.setAttribute("patternType", "solid");
  const foreground = create("fgColor"); foreground.setAttribute("rgb", "FFFFFF00"); pattern.appendChild(foreground);
  const edge = sourceStyles.getElementsByTagNameNS("*", "borders")[0].getElementsByTagNameNS("*", "left")[0];
  edge.setAttribute("style", "thin");
  const black = create("color"); black.setAttribute("rgb", "FF000000"); edge.appendChild(black);
  original["xl/styles.xml"] = strToU8(new XMLSerializer().serializeToString(sourceStyles));
  const output = unzipSync(new Uint8Array(populateWorkbook(new Uint8Array(zipSync(original)).buffer, mapping, [material])));
  const sheet = parse(output, "xl/worksheets/sheet1.xml");
  const styles = parse(output, "xl/styles.xml");
  const formats = styles.getElementsByTagNameNS("*", "cellXfs")[0].getElementsByTagNameNS("*", "xf");
  const fills = styles.getElementsByTagNameNS("*", "fills")[0].getElementsByTagNameNS("*", "fill");
  const borders = styles.getElementsByTagNameNS("*", "borders")[0].getElementsByTagNameNS("*", "border");
  for (const cell of Array.from(sheet.getElementsByTagNameNS("*", "c"))) {
    if (!/^[E-J][12]$/.test(cell.getAttribute("r")!)) continue;
    const format = formats[Number(cell.getAttribute("s"))];
    expect(format.getAttribute("applyBorder")).toBe("1");
    expect(format.getAttribute("applyFill")).toBe("1");
    const fill = fills[Number(format.getAttribute("fillId"))].getElementsByTagNameNS("*", "patternFill")[0];
    expect(fill.getAttribute("patternType")).toBe("none");
    expect(fill.getElementsByTagNameNS("*", "fgColor").length).toBe(0);
    const border = borders[Number(format.getAttribute("borderId"))];
    expect(Array.from(border.childNodes).every((node) => !(node as typeof edge).getAttribute?.("style"))).toBe(true);
  }
  // The original black border and fill remain available to source cells.
  expect(borders[0].getElementsByTagNameNS("*", "left")[0].getAttribute("style")).toBe("thin");
  expect(fills[0].getElementsByTagNameNS("*", "patternFill")[0].getAttribute("patternType")).toBe("solid");
});

test("the manually chosen final column determines the output position", () => {
  const book = XLSX.read(fixture(), { type: "array" });
  book.Sheets.Lista.D1 = { t: "s", v: "Notă" };
  book.Sheets.Lista.D2 = { t: "s", v: "Păstrează nota" };
  book.Sheets.Lista["!ref"] = "A1:D2";
  const input = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const output = XLSX.read(populateWorkbook(input, mapping, [material]), { type: "array" });
  expect(output.Sheets.Lista.D2.v).toBe("Păstrează nota");
  expect(output.Sheets.Lista.E1.v).toBe("ACHIZIȚIE");
  expect(output.Sheets.Lista.E2.v).toBe(1000.25);
});

test("a manual output position cannot overwrite existing notes or formulas", () => {
  const book = XLSX.read(fixture(), { type: "array" });
  book.Sheets.Lista.E2 = { t: "n", v: 42, f: "6*7" };
  book.Sheets.Lista["!ref"] = "A1:E2";
  expect(() => populateWorkbook(XLSX.write(book, { type: "array", bookType: "xlsx" }), mapping, [material])).toThrow("s-ar suprapune peste date existente");
});

test("the actual F3 workbook receives six colored columns without changing the F4 sheet", () => {
  const input = new Uint8Array(readFileSync(new URL("../../../tests/in/2416_F3+F4_BMS.xlsx", import.meta.url))).buffer;
  const bytes = populateWorkbook(input, {
    randIncepereDate: 24, coloanaDescriere: "B", coloanaCantitati: "D", coloanaUnitate: "C", coloanaSfarsitDate: "H", valuta: "EUR",
  }, [{ ...material, rand: 24, cantitate: 7580 }], 1, "F3");
  const original = unzipSync(new Uint8Array(input));
  const output = unzipSync(new Uint8Array(bytes));
  expect(output["xl/worksheets/sheet2.xml"]).toEqual(original["xl/worksheets/sheet2.xml"]);
  const book = XLSX.read(bytes, { type: "array" });
  expect(book.Sheets.F3.J23.v).toBe("ACHIZIȚIE");
  expect(book.Sheets.F3.O23.v).toBe("MANOPERĂ\nTOTAL");
  expect(book.Sheets.F3.P23).toBeUndefined();
  const sheet = parse(output, "xl/worksheets/sheet1.xml");
  const styles = parse(output, "xl/styles.xml");
  const formats = styles.getElementsByTagNameNS("*", "cellXfs")[0].getElementsByTagNameNS("*", "xf");
  const fonts = styles.getElementsByTagNameNS("*", "fonts")[0].getElementsByTagNameNS("*", "font");
  const borders = styles.getElementsByTagNameNS("*", "borders")[0].getElementsByTagNameNS("*", "border");
  const fills = styles.getElementsByTagNameNS("*", "fills")[0].getElementsByTagNameNS("*", "fill");
  const colors = ["FFFF0000", "FFFF0000", "FF00B050", "FF00B050", "FF000000", "FF000000"];
  for (const [index, column] of ["J", "K", "L", "M", "N", "O"].entries()) {
    for (const row of [23, 24]) {
      const cell = Array.from(sheet.getElementsByTagNameNS("*", "c")).find((entry) => entry.getAttribute("r") === `${column}${row}`)!;
      const format = formats[Number(cell.getAttribute("s"))];
      expect(fonts[Number(format.getAttribute("fontId"))].getElementsByTagNameNS("*", "color")[0].getAttribute("rgb")).toBe(colors[index]);
      expect(fills[Number(format.getAttribute("fillId"))].getElementsByTagNameNS("*", "patternFill")[0].getAttribute("patternType")).toBe("none");
      const border = borders[Number(format.getAttribute("borderId"))];
      expect(Array.from(border.childNodes).every((node) => !(node as typeof cell).getAttribute?.("style"))).toBe(true);
    }
  }
});
