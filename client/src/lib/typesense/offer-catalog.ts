import { createHash } from "node:crypto";
import { typesenseClient } from "./admin";
import type { MaterialHit } from "@/types";
import type { MatchedMaterial } from "../../../convex/oferte/review";

export class CatalogConflict extends Error {}

export async function saveOfferMaterial(material: MatchedMaterial, source: string, mode: "update" | "create", description?: string) {
  const documents = typesenseClient.collections<MaterialHit>("materiale").documents();
  const prices = { pretAchizitie: material.pretAchizitie, pretVanzare: material.pretVanzare, manopera: material.manopera };
  if (mode === "create") {
    const descriere = description!.trim();
    // Retrying the same confirmed offer snapshot creates no duplicate document.
    const id = `offer-${createHash("sha256").update(JSON.stringify([source, descriere])).digest("hex")}`;
    return documents.upsert({ id, descriere, ...prices });
  }
  let id = material.catalogMaterialId;
  if (!id) {
    const escaped = material.descriereGasita.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
    const result = await documents.search({ q: "*", query_by: "descriere", filter_by: `descriere:=\`${escaped}\``, per_page: 2, exclude_fields: "embedding" });
    const matches = result.hits?.filter((hit) => hit.document.descriere === material.descriereGasita) ?? [];
    if (result.found !== 1 || matches.length !== 1 || !matches[0].document.id) {
      throw new CatalogConflict("Materialul asociat nu poate fi identificat în mod unic. Asociază din nou materialul din catalog sau adaugă-l ca material nou.");
    }
    id = matches[0].document.id;
  }
  // Only prices change; preserve the catalog description and embedding.
  return typesenseClient.collections<MaterialHit>("materiale").documents(id).update(prices);
}
