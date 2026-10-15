import * as XLSX from "xlsx";
import type { Material } from "../types";

export const MAX_MATERIAL_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIAL_IMPORT_ROWS = 10000;
const fields = ["descriere", "pretAchizitie", "pretVanzare", "manopera"] as const;

export type ImportMaterial = { row: number; material: Material };

function cleanCell(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.startsWith('"') ? text.replace(/^"+|"+$/g, "").trim() : text;
}

export function parseMaterialImport(bytes: Uint8Array, fileName: string): ImportMaterial[] {
  let rows: unknown[][];
  try {
    const input = fileName.toLowerCase().endsWith(".csv")
      ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      : bytes;
    const workbook = XLSX.read(input, {
      type: typeof input === "string" ? "string" : "array",
      raw: true,
      FS: ",",
      sheetRows: MAX_MATERIAL_IMPORT_ROWS + 2,
    });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error();
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1, raw: true, defval: "", blankrows: true,
    });
  } catch {
    throw new Error("Fișierul nu poate fi citit. Folosește un CSV UTF-8 sau un XLSX valid.");
  }

  const headers = (rows[0] ?? []).map((value) => cleanCell(value).replace(/^\uFEFF/, ""));
  if (fields.some((field, index) => headers[index]?.toLowerCase() !== field.toLowerCase()) || headers.slice(4).some(Boolean)) {
    throw new Error("Prima linie trebuie să fie: descriere,pretAchizitie,pretVanzare,manopera,,");
  }
  if (rows.length > MAX_MATERIAL_IMPORT_ROWS + 1) {
    throw new Error(`Fișierul poate conține maximum ${MAX_MATERIAL_IMPORT_ROWS} rânduri de materiale.`);
  }

  const materials: ImportMaterial[] = [];
  for (let index = 1; index < rows.length; index++) {
    const cells = rows[index].map(cleanCell);
    if (!cells.some(Boolean)) continue;
    const row = index + 1;
    const descriere = cells[0] ?? "";
    if (descriere.length < 3 || descriere.length > 500) {
      throw new Error(`Rândul ${row}: descrierea trebuie să aibă între 3 și 500 de caractere.`);
    }
    if (cells.slice(4).some(Boolean)) {
      throw new Error(`Rândul ${row}: coloanele de după manopera trebuie să fie goale.`);
    }
    const price = (column: number): number => {
      // The reference export also wraps numeric cells in literal quotes/apostrophes.
      const value = (cells[column] ?? "").replace(/^["']+|["']+$/g, "").trim();
      if (!value) return 0;
      const normalized = value.replace(",", ".");
      const number = Number(normalized);
      if (!/^\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(number) || number > 2147483647) {
        throw new Error(`Rândul ${row}: ${fields[column]} trebuie să fie un număr între 0 și 2147483647.`);
      }
      return number;
    };
    const pretAchizitie = price(1);
    const pretVanzare = price(2);
    materials.push({ row, material: {
      descriere, pretAchizitie,
      pretVanzare: pretVanzare === 0 ? pretAchizitie * 1.25 : pretVanzare,
      manopera: price(3),
    } });
  }
  if (!materials.length) throw new Error("Fișierul nu conține materiale.");
  return materials;
}
