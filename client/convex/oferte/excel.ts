import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";
import type { Doc } from "../_generated/dataModel";
import type { MatchedMaterial } from "./review";

export function populateWorkbook(input: ArrayBuffer, mapping: NonNullable<Doc<"oferte">["excelMapping"]>, materials: MatchedMaterial[]) {
  const archive = unzipSync(new Uint8Array(input));
  const parser = new DOMParser();
  const parse = (path: string) => {
    if (!archive[path]) throw new Error(`Componenta XLSX lipseste: ${path}`);
    return parser.parseFromString(strFromU8(archive[path]), "application/xml");
  };
  const workbook = parse("xl/workbook.xml");
  const sheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
  const relationshipId = sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const relationships = parse("xl/_rels/workbook.xml.rels");
  const relationship = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target");
  if (!target || relationship?.getAttribute("TargetMode") === "External") throw new Error("Foaia Excel nu poate fi localizata.");
  const sheetPath = new URL(target, "https://xlsx.local/xl/workbook.xml").pathname.slice(1);
  const document = parse(sheetPath);
  const root = document.documentElement!;
  const sheetData = document.getElementsByTagNameNS("*", "sheetData")[0];
  if (!sheetData) throw new Error("Foaia Excel nu contine celule.");
  const create = (name: string) => document.createElementNS(root.namespaceURI, root.prefix ? `${root.prefix}:${name}` : name);
  const rows = new Map(Array.from(sheetData.getElementsByTagNameNS("*", "row")).map((row) => [Number(row.getAttribute("r")), row]));
  const writeCell = (address: string, value: string | number, style?: string | null, formula?: string) => {
    const position = XLSX.utils.decode_cell(address);
    let row = rows.get(position.r + 1);
    if (!row) {
      row = create("row");
      row.setAttribute("r", String(position.r + 1));
      const next = Array.from(sheetData.childNodes).find((node) => node.nodeType === 1 && Number((node as NonNullable<typeof row>).getAttribute("r")) > position.r + 1);
      sheetData.insertBefore(row, next ?? null);
      rows.set(position.r + 1, row);
    }
    row.removeAttribute("spans");
    const cells = Array.from(row.getElementsByTagNameNS("*", "c"));
    let cell = cells.find((item) => item.getAttribute("r") === address);
    if (!cell) {
      cell = create("c");
      cell.setAttribute("r", address);
      if (style) cell.setAttribute("s", style);
      const next = cells.find((item) => XLSX.utils.decode_cell(item.getAttribute("r")!).c > position.c);
      row.insertBefore(cell, next ?? null);
    }
    for (const child of Array.from(cell.childNodes)) {
      if (["f", "v", "is"].includes(child.localName ?? "")) cell.removeChild(child);
    }
    cell.setAttribute("t", typeof value === "string" ? "inlineStr" : "n");
    const extension = Array.from(cell.childNodes).find((child) => child.localName === "extLst") ?? null;
    if (formula) {
      const formulaNode = create("f");
      formulaNode.textContent = formula;
      cell.insertBefore(formulaNode, extension);
    }
    const valueNode = create(typeof value === "string" ? "is" : "v");
    if (typeof value === "string") {
      const text = create("t");
      text.textContent = value;
      valueNode.appendChild(text);
    } else valueNode.textContent = String(value);
    cell.insertBefore(valueNode, extension);
  };
  const styleAt = (row: number) => {
    const cells = Array.from(rows.get(row)?.getElementsByTagNameNS("*", "c") ?? []);
    return cells.find((cell) => cell.getAttribute("r") === `${mapping.coloanaSfarsitDate}${row}`)?.getAttribute("s")
      ?? cells.at(-1)?.getAttribute("s");
  };
  const startColumn = XLSX.utils.decode_col(mapping.coloanaSfarsitDate) + 2;
  if (startColumn + 6 >= 16384) throw new Error("Nu exista suficient spatiu pentru coloanele de pret.");
  const headerRow = Math.max(1, mapping.randIncepereDate - 1);
  const headerStyle = styleAt(headerRow);
  const headers = ["Preț Achiziție", "Preț Achiziție Total", "Preț Vânzare", "Preț Vânzare Total", "Manoperă", "Manoperă Total", "Total final"];
  headers.forEach((header, index) => writeCell(`${XLSX.utils.encode_col(startColumn + index)}${headerRow}`, header, headerStyle));
  for (const material of materials) {
    const style = styleAt(material.rand);
    const refs = headers.map((_, index) => `${XLSX.utils.encode_col(startColumn + index)}${material.rand}`);
    const quantityRef = `${mapping.coloanaCantitati}${material.rand}`;
    writeCell(quantityRef, material.cantitate);
    writeCell(refs[0], material.pretAchizitie, style);
    writeCell(refs[1], material.cantitate * material.pretAchizitie, style, `${quantityRef}*${refs[0]}`);
    writeCell(refs[2], material.pretVanzare, style);
    writeCell(refs[3], material.cantitate * material.pretVanzare, style, `${quantityRef}*${refs[2]}`);
    writeCell(refs[4], material.manopera, style);
    writeCell(refs[5], material.cantitate * material.manopera, style, `${quantityRef}*${refs[4]}`);
    writeCell(refs[6], material.cantitate * (material.pretVanzare + material.manopera), style, `${refs[3]}+${refs[5]}`);
  }
  const dimension = document.getElementsByTagNameNS("*", "dimension")[0];
  if (dimension) {
    const range = XLSX.utils.decode_range(dimension.getAttribute("ref") ?? "A1");
    range.e.c = Math.max(range.e.c, startColumn + 6);
    range.e.r = Math.max(range.e.r, ...materials.map((material) => material.rand - 1));
    dimension.setAttribute("ref", XLSX.utils.encode_range(range));
  }
  archive[sheetPath] = strToU8(new XMLSerializer().serializeToString(document));
  return new Uint8Array(zipSync(archive)).buffer;
}