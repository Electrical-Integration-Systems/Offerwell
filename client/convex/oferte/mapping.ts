import { v, type Infer } from "convex/values";
import { flowError } from "./errors";

export const excelMappingValidator = v.object({
  randIncepereDate: v.number(),
  coloanaDescriere: v.string(),
  coloanaCantitati: v.string(),
  coloanaUnitate: v.string(),
  valuta: v.string(),
  coloanaSfarsitDate: v.string(),
});

export type ExcelMapping = Infer<typeof excelMappingValidator>;

export function extractionMappingChanged(previous: ExcelMapping | undefined, next: ExcelMapping): boolean {
  return !previous || (["randIncepereDate", "coloanaDescriere", "coloanaCantitati", "coloanaUnitate"] as const)
    .some((field) => previous[field] !== next[field]);
}

function columnIndex(column: string): number {
  return [...column].reduce((index, character) => index * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

export function validateExcelMapping(input: ExcelMapping, lastRow: number, lastColumn: number, sheetName?: string): ExcelMapping {
  const mapping = { ...input };
  if (lastRow < 2) throw flowError("STRUCTURE", "Foaia nu conține rânduri de materiale după antet. Verifică foaia și corectează structura manual.", sheetName);
  if (!Number.isInteger(mapping.randIncepereDate) || mapping.randIncepereDate < 2 || mapping.randIncepereDate > lastRow) {
    throw flowError("STRUCTURE", `Primul rând de materiale trebuie să fie un număr întreg între 2 și ${lastRow}. Corectează structura manual.`, sheetName);
  }
  const columns = ["coloanaDescriere", "coloanaCantitati", "coloanaUnitate", "coloanaSfarsitDate"] as const;
  for (const field of columns) {
    const column = mapping[field].trim().toUpperCase();
    if (!/^[A-Z]{1,3}$/.test(column) || columnIndex(column) > lastColumn || columnIndex(column) >= 16384) {
      throw flowError("STRUCTURE", "Coloanele trebuie să fie litere Excel existente în foaia analizată, de exemplu A, B sau AA. Corectează structura manual.", sheetName);
    }
    mapping[field] = column;
  }
  const materialColumns = [mapping.coloanaDescriere, mapping.coloanaCantitati, mapping.coloanaUnitate];
  if (new Set(materialColumns).size !== 3) {
    throw flowError("STRUCTURE", "Descrierea, cantitatea și unitatea de măsură trebuie să folosească trei coloane diferite.", sheetName);
  }
  if (materialColumns.some((column) => columnIndex(column) > columnIndex(mapping.coloanaSfarsitDate))) {
    throw flowError("STRUCTURE", "Ultima coloană a tabelului trebuie să includă coloanele de descriere, cantitate și unitate de măsură.", sheetName);
  }
  mapping.valuta = mapping.valuta.trim().toUpperCase();
  const aliases: Record<string, string> = { EURO: "EUR", EUROS: "EUR", "€": "EUR", LEU: "RON", LEI: "RON" };
  mapping.valuta = aliases[mapping.valuta] ?? mapping.valuta;
  if (mapping.valuta !== "EUR" && mapping.valuta !== "RON") {
    throw flowError("STRUCTURE", "Moneda ofertei trebuie să fie EUR sau RON.", sheetName);
  }
  return mapping;
}
