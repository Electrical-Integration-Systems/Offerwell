import type { Doc } from "../_generated/dataModel";

export type MatchedMaterial = NonNullable<Doc<"oferte">["materialePotrivite"]>[number];

export const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIALS = 2000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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