import type { Doc } from "../_generated/dataModel";
import { salePrice } from "../material_prices";
import { flowError, structureError } from "./errors";
import { normalizeMaterialDescription } from "../lib/material_description";
import { isCurrentExcelOutput } from "./export_format";

export type MatchedMaterial = NonNullable<Doc<"oferte">["materialePotrivite"]>[number];

export const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIALS = 2000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeToken(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ro-RO");
}

function tokenize(value: string) {
  return normalizeMaterialDescription(value).match(/[\p{L}\p{N}]+/gu)?.map(normalizeToken) ?? [];
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

export function inferMatchedTokens(query: string, matchedDescription: string) {
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
    const allowedTypos = /^\d+$/.test(queryToken) ? 0 : queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
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
  // Hybrid vector hits can omit text-match metadata, even for identical descriptions.
  const matchedTokens = inferMatchedTokens(material.descriereOriginala, material.descriereGasita);
  return calculateMatchQuality(material.descriereOriginala, matchedTokens.length, matchedTokens);
}

export function normalizeMaterial<T extends MatchedMaterial>(material: T): T {
  const matchedTokens = inferMatchedTokens(material.descriereOriginala, material.descriereGasita);
  return { ...material, pretVanzare: salePrice(material),
    matchScore: calculateMatchQuality(material.descriereOriginala, matchedTokens.length, matchedTokens), matchedTokens };
}

export function isExactMatch(original: string, matched: string): boolean {
  const normalize = (value: string) => normalizeMaterialDescription(value).toLowerCase();
  return normalize(original) !== "" && normalize(original) === normalize(matched);
}

export function hasValidPrices(material: Pick<MatchedMaterial, "cantitate" | "pretAchizitie" | "pretVanzare" | "manopera">): boolean {
  return [material.cantitate, material.pretAchizitie, material.pretVanzare, material.manopera]
    .every((value) => Number.isFinite(value) && value >= 0)
    && Number.isFinite(material.cantitate * (salePrice(material) + material.manopera))
    && Number.isFinite(material.cantitate * material.pretAchizitie);
}

export function needsReview(material: MatchedMaterial): boolean {
  return !hasValidPrices(material)
    || (material.validated !== true && material.requiresValidation !== false);
}

export function materialTotal(material: MatchedMaterial) {
  const total = material.cantitate * (salePrice(material) + material.manopera);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

export function canBulkValidate(material: MatchedMaterial, minimumQuality: number) {
  return needsReview(material) && hasValidPrices(material) && material.cantitate > 0
    && material.matchScore >= minimumQuality && material.descriereGasita.trim() !== ""
    && material.descriereGasita !== "Nu a fost găsit în baza de date" && material.descriereGasita !== "Eroare la căutare";
}

export function summarizeMaterials(materials: MatchedMaterial[]) {
  return { pricingVersion: 1, materialCount: materials.length, pendingCount: materials.filter(needsReview).length,
    total: materials.reduce((total, material) => total + materialTotal(material), 0) };
}

export function getOfferProgress(oferta: Pick<Doc<"oferte">, "excelMapping" | "selectedSheets" | "sheetMappings" | "materialeExtrase" | "materialePotrivite" | "excelOutput" | "materialSummary">) {
  const materialCount = oferta.materialSummary?.materialCount ?? oferta.materialePotrivite?.length ?? oferta.materialeExtrase?.length ?? 0;
  const pendingCount = oferta.materialSummary?.pendingCount ?? oferta.materialePotrivite?.filter(needsReview).length ?? 0;
  const hasMappings = Boolean(oferta.excelMapping) && !oferta.selectedSheets?.some((name) => !oferta.sheetMappings?.some((entry) => entry.sheetName === name));
  const status = !hasMappings ? "analysis"
    : !oferta.materialeExtrase?.length && !oferta.materialSummary ? "extraction"
    : !oferta.materialSummary && !oferta.materialePotrivite?.length ? "matching"
    : pendingCount > 0 ? "validation"
    : isCurrentExcelOutput(oferta.excelOutput) ? "completed" : "export";
  return { status, materialCount, pendingCount } as const;
}

export function assertReadyForExport(materials: MatchedMaterial[] | undefined, allowUnvalidated = false): asserts materials is MatchedMaterial[] {
  if (!materials?.length) throw structureError();
  if (materials.some((material) => !hasValidPrices(material))) throw flowError("VALIDATION", "Cantitățile și prețurile trebuie să fie numere finite, pozitive sau zero. Corectează valorile nevalide înainte de export.");
  if (!allowUnvalidated && materials.some(needsReview)) throw flowError("VALIDATION", "Valideaza toate materialele marcate înainte de export sau confirmă generarea cu materiale nevalidate.");
  if (!Number.isFinite(materials.reduce((total, material) => total + material.cantitate * (salePrice(material) + material.manopera), 0))) {
    throw flowError("VALIDATION", "Totalul ofertei este prea mare. Verifică și corectează cantitățile și prețurile materialelor.");
  }
}
