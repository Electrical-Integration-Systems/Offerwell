import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ExtractedMaterial = NonNullable<Doc<"oferte">["materialeExtrase"]>[number];

export async function getExtractedMaterials(ctx: QueryCtx, oferta: Doc<"oferte">): Promise<ExtractedMaterial[] | undefined> {
  if (oferta.materialeExtrase !== undefined) return oferta.materialeExtrase;
  if (oferta.extractedCount === undefined) return undefined;
  const rows = await ctx.db.query("ofertaExtrase").withIndex("by_oferta_and_position", (q) => q.eq("oferta", oferta._id)).collect();
  return rows.map(({ sheetName, rand, descriere, cantitate, unitate }) => ({ sheetName, rand, descriere, cantitate, unitate }));
}

export async function clearExtractedMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  for await (const row of ctx.db.query("ofertaExtrase").withIndex("by_oferta_and_rand", (q) => q.eq("oferta", oferta._id))) {
    await ctx.db.delete(row._id);
  }
}

export async function storeExtractedMaterials(ctx: MutationCtx, oferta: Doc<"oferte">, materials: ExtractedMaterial[]) {
  await clearExtractedMaterials(ctx, oferta);
  for (const [position, material] of materials.entries()) await ctx.db.insert("ofertaExtrase", { ...material, position, oferta: oferta._id });
  await ctx.db.patch(oferta._id, { materialeExtrase: undefined, extractedCount: materials.length });
}

export async function migrateExtractedMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  if (oferta.materialeExtrase !== undefined) await storeExtractedMaterials(ctx, oferta, oferta.materialeExtrase);
}
