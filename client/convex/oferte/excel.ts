import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";
import type { Doc } from "../_generated/dataModel";
import type { MatchedMaterial } from "./review";
import { salePrice, SALE_PRICE_MULTIPLIER } from "../material_prices";
import { flowError } from "./errors";
import { appendOutputStyles } from "./excel_styles";

export function populateWorkbook(input: ArrayBuffer, mapping: NonNullable<Doc<"oferte">["excelMapping"]>, materials: MatchedMaterial[], conversionRate: number = 1, sheetName?: string) {
  const archive = unzipSync(new Uint8Array(input));
  const parser = new DOMParser();
  const parse = (path: string) => {
    if (!archive[path]) throw flowError("INVALID_FILE", "Fișierul Excel este incomplet sau corupt. Deschide-l în Excel, salvează-l ca .xlsx și încarcă-l din nou.");
    return parser.parseFromString(strFromU8(archive[path]), "application/xml");
  };
  const workbook = parse("xl/workbook.xml");
  const sheets = Array.from(workbook.getElementsByTagNameNS("*", "sheet"));
  const sheet = sheetName === undefined ? sheets[0] : sheets.find((entry) => entry.getAttribute("name") === sheetName);
  const relationshipId = sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const relationships = parse("xl/_rels/workbook.xml.rels");
  // Source calculation entries can point to quantity formulas replaced by values.
  // Drop the optional chain and its package references; Excel rebuilds it on open.
  const calculationLinks = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .filter((item) => item.getAttribute("Type")?.endsWith("/calcChain"));
  const contentTypes = parse("[Content_Types].xml");
  const calculationOverrides = Array.from(contentTypes.getElementsByTagNameNS("*", "Override"))
    .filter((item) => item.getAttribute("ContentType")?.endsWith(".calcChain+xml"));
  if (calculationLinks.length || calculationOverrides.length || archive["xl/calcChain.xml"]) {
    for (const link of calculationLinks) {
      const target = link.getAttribute("Target");
      if (target && link.getAttribute("TargetMode") !== "External") delete archive[new URL(target, "https://xlsx.local/xl/workbook.xml").pathname.slice(1)];
      link.parentNode!.removeChild(link);
    }
    for (const override of calculationOverrides) {
      const partName = override.getAttribute("PartName");
      if (partName) delete archive[partName.replace(/^\//, "")];
      override.parentNode!.removeChild(override);
    }
    delete archive["xl/calcChain.xml"];
    archive["xl/_rels/workbook.xml.rels"] = strToU8(new XMLSerializer().serializeToString(relationships));
    archive["[Content_Types].xml"] = strToU8(new XMLSerializer().serializeToString(contentTypes));
  }
  const relationship = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target");
  if (!target || relationship?.getAttribute("TargetMode") === "External") throw flowError("INVALID_FILE", "Foaia Excel nu poate fi localizată. Salvează fișierul ca .xlsx și încarcă-l din nou.", sheetName);
  const sheetPath = new URL(target, "https://xlsx.local/xl/workbook.xml").pathname.slice(1);
  const styleTarget = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Type")?.endsWith("/styles"))?.getAttribute("Target") ?? "styles.xml";
  const stylesPath = new URL(styleTarget, "https://xlsx.local/xl/workbook.xml").pathname.slice(1);
  const stylesDocument = parse(stylesPath);
  const outputStyles = appendOutputStyles(stylesDocument);
  const document = parse(sheetPath);
  const root = document.documentElement!;
  const sheetData = document.getElementsByTagNameNS("*", "sheetData")[0];
  if (!sheetData) throw flowError("INVALID_FILE", "Foaia Excel nu conține celule. Încarcă un fișier cu materiale și cantități.", sheetName);
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
      const next = cells.find((item) => XLSX.utils.decode_cell(item.getAttribute("r")!).c > position.c);
      row.insertBefore(cell, next ?? null);
    }
    if (style !== undefined && style !== null) cell.setAttribute("s", style);
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
  const startColumn = XLSX.utils.decode_col(mapping.coloanaSfarsitDate) + 2;
  const headers = ["ACHIZIȚIE", "ACHIZIȚIE\nTOTAL", "VÂNZARE", "VÂNZARE\nTOTAL", "MANOPERĂ", "MANOPERĂ\nTOTAL"];
  const lastColumn = startColumn + headers.length - 1;
  if (lastColumn >= 16384) throw flowError("INVALID_FILE", "Nu există suficient spațiu pentru coloanele de preț. Elimină coloanele goale de la finalul foii și încarcă fișierul din nou.", sheetName);
  const headerRow = Math.max(1, mapping.randIncepereDate - 1);
  // A manually selected export position must not overwrite original data.
  for (const rowNumber of [headerRow, ...materials.map((material) => material.rand)]) {
    for (const cell of Array.from(rows.get(rowNumber)?.getElementsByTagNameNS("*", "c") ?? [])) {
      const column = XLSX.utils.decode_cell(cell.getAttribute("r")!).c;
      if (column >= startColumn && column <= lastColumn && Array.from(cell.childNodes).some((node) => ["f", "v", "is"].includes(node.localName ?? "") && node.textContent?.trim())) {
        throw flowError("STRUCTURE", "Coloanele de preț s-ar suprapune peste date existente. Corectează ultima coloană a tabelului pentru a plasa prețurile într-o zonă liberă.", sheetName);
      }
    }
  }
  headers.forEach((header, index) => writeCell(`${XLSX.utils.encode_col(startColumn + index)}${headerRow}`, header, outputStyles[index].header));
  const header = rows.get(headerRow)!;
  header.setAttribute("ht", String(Math.max(32, Number(header.getAttribute("ht")) || 0)));
  header.setAttribute("customHeight", "1");
  let columns = document.getElementsByTagNameNS("*", "cols")[0];
  if (!columns) { columns = create("cols"); root.insertBefore(columns, sheetData); }
  const firstOutputColumn = startColumn + 1;
  const lastOutputColumn = lastColumn + 1;
  for (const column of Array.from(columns.getElementsByTagNameNS("*", "col"))) {
    const min = Number(column.getAttribute("min"));
    const max = Number(column.getAttribute("max"));
    if (max < firstOutputColumn || min > lastOutputColumn) continue;
    if (min < firstOutputColumn) {
      const before = column.cloneNode(true) as typeof column;
      before.setAttribute("max", String(firstOutputColumn - 1)); columns.insertBefore(before, column);
    }
    if (max > lastOutputColumn) {
      const after = column.cloneNode(true) as typeof column;
      after.setAttribute("min", String(lastOutputColumn + 1)); columns.insertBefore(after, column);
    }
    columns.removeChild(column);
  }
  headers.forEach((_, index) => {
    const position = firstOutputColumn + index;
    const column = create("col");
    column.setAttribute("min", String(position)); column.setAttribute("max", String(position));
    column.setAttribute("style", outputStyles[index].value);
    column.setAttribute("width", index % 2 === 0 ? "15" : "18"); column.setAttribute("customWidth", "1");
    const next = Array.from(columns.getElementsByTagNameNS("*", "col")).find((item) => Number(item.getAttribute("min")) > position);
    columns.insertBefore(column, next ?? null);
  });
  for (const material of materials) {
    const pretVanzare = salePrice(material);
    const refs = headers.map((_, index) => `${XLSX.utils.encode_col(startColumn + index)}${material.rand}`);
    const quantityRef = `${mapping.coloanaCantitati}${material.rand}`;
    writeCell(quantityRef, material.cantitate);
    writeCell(refs[0], material.pretAchizitie * conversionRate, outputStyles[0].value);
    writeCell(refs[1], material.cantitate * material.pretAchizitie * conversionRate, outputStyles[1].value, `${quantityRef}*${refs[0]}`);
    writeCell(refs[2], pretVanzare * conversionRate, outputStyles[2].value,
      pretVanzare === material.pretAchizitie * SALE_PRICE_MULTIPLIER ? `${refs[0]}*${SALE_PRICE_MULTIPLIER}` : undefined);
    writeCell(refs[3], material.cantitate * pretVanzare * conversionRate, outputStyles[3].value, `${quantityRef}*${refs[2]}`);
    writeCell(refs[4], material.manopera * conversionRate, outputStyles[4].value);
    writeCell(refs[5], material.cantitate * material.manopera * conversionRate, outputStyles[5].value, `${quantityRef}*${refs[4]}`);
  }
  const dimension = document.getElementsByTagNameNS("*", "dimension")[0];
  if (dimension) {
    const range = XLSX.utils.decode_range(dimension.getAttribute("ref") ?? "A1");
    range.e.c = Math.max(range.e.c, lastColumn);
    range.e.r = Math.max(range.e.r, ...materials.map((material) => material.rand - 1));
    dimension.setAttribute("ref", XLSX.utils.encode_range(range));
  }
  archive[sheetPath] = strToU8(new XMLSerializer().serializeToString(document));
  archive[stylesPath] = strToU8(new XMLSerializer().serializeToString(stylesDocument));
  const workbookRoot = workbook.documentElement!;
  let calculation = workbook.getElementsByTagNameNS("*", "calcPr")[0];
  if (!calculation) {
    calculation = workbook.createElementNS(workbookRoot.namespaceURI, workbookRoot.prefix ? `${workbookRoot.prefix}:calcPr` : "calcPr");
    const extension = Array.from(workbookRoot.childNodes).find((child) => child.localName === "extLst") ?? null;
    workbookRoot.insertBefore(calculation, extension);
  }
  calculation.setAttribute("calcMode", "auto");
  calculation.setAttribute("fullCalcOnLoad", "1");
  calculation.setAttribute("forceFullCalc", "1");
  archive["xl/workbook.xml"] = strToU8(new XMLSerializer().serializeToString(workbook));
  return new Uint8Array(zipSync(archive)).buffer;
}
