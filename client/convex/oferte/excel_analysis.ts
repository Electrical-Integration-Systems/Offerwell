import * as XLSX from "xlsx";

export const MAX_ANALYSIS_PROMPT_BYTES = 6_000;
export const MAX_ANALYSIS_SAMPLE_BYTES = 4_500;
export const MAX_ANALYSIS_COMPLETION_TOKENS = 1_024;

const encoder = new TextEncoder();
const headerPatterns = [/descri|denum|capitolul de lucr|material|description/i, /cantitate|cantitati|cant\.?$|quantity|qty/i, /^u\.?\s*m\.?$|unitate|unit of measure|^nr buc$/i];

function headerScore(values: string[]) {
  return headerPatterns.filter((pattern) => values.some((value) => pattern.test(value.normalize("NFD").replace(/\p{M}/gu, "")))).length;
}

function contentCells(sheet: XLSX.WorkSheet) {
  return Object.entries(sheet).flatMap(([address, cell]) => {
    if (!/^[A-Z]+[1-9]\d*$/.test(address)) return [];
    const value = String(cell.v ?? (cell.f ? `=${cell.f}` : "")).replace(/\s+/g, " ").trim();
    if (!value) return [];
    return [{ address, ...XLSX.utils.decode_cell(address), value, numeric: typeof cell.v === "number" }];
  });
}

export function worksheetContentRange(sheet: XLSX.WorkSheet) {
  const cells = contentCells(sheet);
  const range = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  for (const cell of cells) {
    range.e.r = Math.max(range.e.r, cell.r);
    range.e.c = Math.max(range.e.c, cell.c);
  }
  return range;
}

function truncate(value: string, limit: number) {
  if (encoder.encode(value).length <= limit) return value;
  let result = "";
  for (const character of value) {
    if (encoder.encode(result + character).length > limit - 3) break;
    result += character;
  }
  return `${result}...`;
}

export function buildWorksheetSample(sheet: XLSX.WorkSheet, maxBytes = MAX_ANALYSIS_SAMPLE_BYTES): string {
  const groups = new Map<number, ReturnType<typeof contentCells>>();
  for (const cell of contentCells(sheet)) {
    const row = groups.get(cell.r) ?? [];
    row.push(cell); groups.set(cell.r, row);
  }
  const rows = [...groups.entries()].sort(([first], [second]) => first - second).map(([index, cells]) => ({
    index, cells: cells.sort((first, second) => first.c - second.c), score: headerScore(cells.map((cell) => cell.value)),
  }));
  const selected = new Map<number, string>();
  let usedBytes = 0;
  const add = (row: typeof rows[number]) => {
    if (selected.has(row.index)) return;
    const parts: typeof row.cells = [];
    let rowBytes = 0;
    // Header labels take precedence when a very wide row needs truncation.
    const candidates = [...row.cells].sort((first, second) => headerScore([second.value]) - headerScore([first.value]) || first.c - second.c);
    for (const cell of candidates) {
      const value = `${cell.address}=${JSON.stringify(truncate(cell.value, maxBytes < 3_000 ? 90 : 160))}`;
      const size = encoder.encode(value).length + 2;
      if (rowBytes + size > 1_000 || parts.length >= 24) continue;
      parts.push({ ...cell, value }); rowBytes += size;
    }
    const line = `R${row.index + 1}: ${parts.sort((first, second) => first.c - second.c).map((cell) => cell.value).join("; ")}`;
    const size = encoder.encode(line).length + (selected.size ? 1 : 0);
    if (parts.length && usedBytes + size <= maxBytes) { selected.set(row.index, line); usedBytes += size; }
  };
  for (const header of rows.filter((candidate) => candidate.score >= 2).slice(0, 4)) {
    add(header);
    const examples = rows.filter((row) => row.index > header.index && row.score < 2
      && row.cells.some((cell) => cell.numeric)
      && row.cells.some((cell) => /\p{L}/u.test(cell.value) && cell.value.length >= 4)).slice(0, 3);
    for (const row of examples) add(row);
  }
  for (const row of rows.slice(0, 80)) add(row);
  return [...selected.entries()].sort(([first], [second]) => first - second).map(([, line]) => line).join("\n");
}
