// Length/area/volume unit spellings found in material descriptions. Do not strip
// arbitrary letter sequences: model names and electrical ratings remain intact.
const measurementUnits = /(?<![\p{L}_])(?:mmp|mmc|cmp|cmc|dmp|dmc|mp|mc|ml|(?:mm|cm|dm|m)(?:\^[23]|[23²³])?)(?=$|[^\p{L}\p{N}_]|[x×*]\s*\d)/giu;

export function normalizeMaterialDescription(description: string): string {
  return description
    .replace(measurementUnits, (unit: string, offset: number, source: string) => {
      // A standalone M2/M3 can be a technical code. ASCII exponents are units
      // only when they follow a numeric measurement (e.g. 2.5mm2).
      if (/[23]$/.test(unit) && !/(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?)*\s*$/iu.test(source.slice(0, offset))) return unit;
      return "";
    })
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/(?<=\d)\s*[x×*]\s*(?=\d)/giu, "x")
    .replace(/\s+/g, " ")
    .trim();
}
