import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { getOfferProgress, normalizeMatchScore, summarizeMaterials, type MatchedMaterial } from "./review";

export async function getOwnedOferta(ctx: QueryCtx, idGenerare: Id<"oferte">): Promise<Doc<"oferte">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Autentificarea este necesara.");
  const oferta = await ctx.db.get(idGenerare);
  if (!oferta || oferta.user !== userId) throw new Error("Oferta nu este disponibila.");
  return oferta;
}

export async function getMaterials(ctx: QueryCtx, oferta: Doc<"oferte">): Promise<MatchedMaterial[] | undefined> {
  if (!oferta.materialSummary) return oferta.materialePotrivite;
  const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
  return rows.map(({ _id, _creationTime, oferta: offerId, pending, ...material }) => {
    void _id; void _creationTime; void offerId; void pending;
    return material;
  });
}

async function offerSummary(ctx: QueryCtx, oferta: Doc<"oferte">) {
  return {
    _id: oferta._id, revision: oferta.revision ?? 0,
    excelInput: oferta.excelInput, excelMapping: oferta.excelMapping,
    excelOutput: oferta.excelOutput,
    downloadUrl: oferta.excelOutput ? await ctx.storage.getUrl(oferta.excelOutput.content) : null,
    ...getOfferProgress(oferta),
    total: (oferta.materialSummary ?? summarizeMaterials(oferta.materialePotrivite ?? [])).total,
    hasExtracted: Boolean(oferta.materialeExtrase?.length),
    hasMatched: Boolean(oferta.materialSummary?.materialCount ?? oferta.materialePotrivite?.length),
    materialsReady: Boolean(oferta.materialSummary),
  };
}

export const getGenerare = internalQuery({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args): Promise<Doc<"oferte">> => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    return { ...oferta, materialePotrivite: await getMaterials(ctx, oferta) };
  },
});

export const listMateriale = query({
  args: { idGenerare: v.id("oferte"), pendingOnly: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await getOwnedOferta(ctx, args.idGenerare);
    const rows = ctx.db.query("ofertaMateriale");
    const result = await (args.pendingOnly
      ? rows.withIndex("by_oferta_and_pending_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("pending", true)).paginate(args.paginationOpts)
      : rows.withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare)).paginate(args.paginationOpts));
    return { ...result, page: result.page.map((material) => ({ ...material, matchScore: normalizeMatchScore(material) })) };
  },
});

export const listOferte = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Autentificarea este necesara.");
    const result = await ctx.db.query("oferte")
      .withIndex("by_user", (index) => index.eq("user", userId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((oferta) => ({
        _id: oferta._id,
        _creationTime: oferta._creationTime,
        fileName: oferta.excelInput.fileName,
        valuta: oferta.excelMapping?.valuta ?? null,
        ...getOfferProgress(oferta),
      })),
    };
  },
});

export const getOfertaPage = query({
  args: { idOferta: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Autentificarea este necesara.");
    const id = ctx.db.normalizeId("oferte", args.idOferta);
    if (!id) return null;
    const oferta = await ctx.db.get(id);
    if (!oferta || oferta.user !== userId) return null;
    return offerSummary(ctx, oferta);
  },
});

export const getOferta = query({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    return offerSummary(ctx, oferta);
  },
});
