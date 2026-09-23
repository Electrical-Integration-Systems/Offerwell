import type { Doc } from "../_generated/dataModel";

export type MatchedMaterial = NonNullable<Doc<"oferte">["materialePotrivite"]>[number];

export const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIALS = 2000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeToken(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ro-RO");
}

function tokenize(value: string) {
  return value.match(/[\p{L}\p{N}]+/gu)?.map(normalizeToken) ?? [];
}

function editDistance(first: string, second: string) {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[second.length];
}

function inferMatchedTokens(query: string, matchedDescription: string) {
  const availableMatches = tokenize(matchedDescription);
  return tokenize(query).flatMap((queryToken) => {
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    availableMatches.forEach((candidate, index) => {
      const distance = editDistance(queryToken, candidate);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    const allowedTypos = queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
    return closestIndex >= 0 && closestDistance <= allowedTypos
      ? availableMatches.splice(closestIndex, 1)
      : [];
  });
}

export function calculateMatchQuality(query: string, tokensMatched: number, matchedTokens: string[]) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 1;

  const matchedCount = Math.min(Math.max(tokensMatched, 0), queryTokens.length);
  const coverage = matchedCount / queryTokens.length;
  const availableQueryTokens = [...queryTokens];
  const typoRates = matchedTokens.slice(0, matchedCount).map((matchedToken) => {
    const normalizedMatch = normalizeToken(matchedToken);
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    availableQueryTokens.forEach((queryToken, index) => {
      const distance = editDistance(queryToken, normalizedMatch);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    const closestToken = availableQueryTokens.splice(closestIndex, 1)[0] ?? "";
    return closestDistance / Math.max(closestToken.length, normalizedMatch.length, 1);
  });
  const typoRate = typoRates.length
    ? typoRates.reduce((total, rate) => total + rate, 0) / typoRates.length
    : 0;

  const quality = 1 + 9 * coverage * (1 - typoRate);
  return Math.min(10, Math.max(1, Math.round(quality * 10) / 10));
}

export function normalizeMatchScore(material: Pick<MatchedMaterial, "descriereOriginala" | "descriereGasita" | "matchScore" | "matchedTokens">) {
  if (Number.isFinite(material.matchScore) && material.matchScore >= 1 && material.matchScore <= 10) {
    return material.matchScore;
  }
  const matchedTokens = material.matchedTokens?.length
    ? material.matchedTokens
    : inferMatchedTokens(material.descriereOriginala, material.descriereGasita);
  return calculateMatchQuality(material.descriereOriginala, matchedTokens.length, matchedTokens);
}

export function isExactMatch(original: string, matched: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalize(original) !== "" && normalize(original) === normalize(matched);
}

export function hasValidPrices(material: Pick<MatchedMaterial, "cantitate" | "pretAchizitie" | "pretVanzare" | "manopera">): boolean {
  return [material.cantitate, material.pretAchizitie, material.pretVanzare, material.manopera]
    .every((value) => Number.isFinite(value) && value >= 0)
    && Number.isFinite(material.cantitate * (material.pretVanzare + material.manopera))
    && Number.isFinite(material.cantitate * material.pretAchizitie);
}

export function needsReview(material: MatchedMaterial): boolean {
  return !hasValidPrices(material)
    || (material.validated !== true && material.requiresValidation !== false);
}

export function materialTotal(material: MatchedMaterial) {
  const total = material.cantitate * (material.pretVanzare + material.manopera);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

export function summarizeMaterials(materials: MatchedMaterial[]) {
  return { materialCount: materials.length, pendingCount: materials.filter(needsReview).length,
    total: materials.reduce((total, material) => total + materialTotal(material), 0) };
}

export function getOfferProgress(oferta: Pick<Doc<"oferte">, "excelMapping" | "materialeExtrase" | "materialePotrivite" | "excelOutput" | "materialSummary">) {
  const materialCount = oferta.materialSummary?.materialCount ?? oferta.materialePotrivite?.length ?? oferta.materialeExtrase?.length ?? 0;
  const pendingCount = oferta.materialSummary?.pendingCount ?? oferta.materialePotrivite?.filter(needsReview).length ?? 0;
  const status = !oferta.excelMapping ? "analysis" 
    : !oferta.materialeExtrase?.length ? "extraction"
    : !(oferta.materialSummary?.materialCount ?? oferta.materialePotrivite?.length) ? "matching"
    : pendingCount > 0 ? "validation"
    : oferta.excelOutput ? "completed" : "export";
  return { status, materialCount, pendingCount } as const;
}

export function assertReadyForExport(materials: MatchedMaterial[] | undefined): asserts materials is MatchedMaterial[] {
  if (!materials?.length) throw new Error("Nu exista materiale de exportat.");
  if (materials.some(needsReview)) throw new Error("Valideaza toate materialele marcate inainte de export.");
  if (!Number.isFinite(materials.reduce((total, material) => total + material.cantitate * (material.pretVanzare + material.manopera), 0))) {
    throw new Error("Totalul ofertei este prea mare.");
  }
}