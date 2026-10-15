import type { MaterialExtras } from "../types";
import type { MatchedMaterial } from "./review";

export const NO_MATERIAL_MATCH = "__NO_MATCH__";

export function unmatchedMaterial(material: MaterialExtras): MatchedMaterial {
  return {
    ...(material.sheetName ? { sheetName: material.sheetName } : {}),
    rand: material.rand, descriereOriginala: material.descriere,
    cantitate: material.cantitate, unitate: material.unitate,
    descriereGasita: "Nu a fost găsit în baza de date",
    matchScore: 1, matchedTokens: [], requiresValidation: true, validated: false,
    pretAchizitie: 0, pretVanzare: 0, manopera: 0,
  };
}
