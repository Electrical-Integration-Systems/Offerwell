import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { canBulkValidate, getOfferProgress, normalizeMaterial, summarizeMaterials, type MatchedMaterial } from "./review";
import { flowError } from "./errors";
import { isCurrentExcelOutput } from "./export_format";

export async function getOwnedOferta(ctx: QueryCtx, idGenerare: Id<"oferte">): Promise<Doc<"oferte">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw flowError("AUTH", "Autentificarea este necesară. Conectează-te din nou pentru a continua.");
  const oferta = await ctx.db.get(idGenerare);
  if (!oferta) throw flowError("UNAVAILABLE", "Oferta nu a fost găsită. Revino la lista de oferte.");
  if (oferta.user !== userId) throw flowError("UNAVAILABLE", "Oferta nu este disponibila pentru acest cont. Revino la lista de oferte.");
  return oferta;
}

export async function getMaterials(ctx: QueryCtx, oferta: Doc<"oferte">): Promise<MatchedMaterial[] | undefined> {
  if (!oferta.materialSummary) return oferta.materialePotrivite?.map(normalizeMaterial);
  const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
  return rows.map(({ _id, _creationTime, oferta: offerId, pending, totalVanzareManopera, ...material }) => {
    void _id; void _creationTime; void offerId; void pending; void totalVanzareManopera;
    return normalizeMaterial(material);
  });
}

async function offerSummary(ctx: QueryCtx, oferta: Doc<"oferte">) {
  const summary = oferta.materialSummary?.pricingVersion === 1
    ? oferta.materialSummary
    : summarizeMaterials(await getMaterials(ctx, oferta) ?? []);
  return {
    _id: oferta._id, revision: oferta.revision ?? 0,
    excelInput: oferta.excelInput, excelMapping: oferta.excelMapping,
    selectedSheets: oferta.selectedSheets, sheetMappings: oferta.sheetMappings,
    excelOutput: oferta.excelOutput,
    downloadUrl: isCurrentExcelOutput(oferta.excelOutput) && oferta.excelOutput ? await ctx.storage.getUrl(oferta.excelOutput.content) : null,
    needsExportRefresh: Boolean(oferta.excelOutput) && !isCurrentExcelOutput(oferta.excelOutput),
    ...getOfferProgress({ ...oferta, materialSummary: oferta.materialSummary ? summary : undefined }),
    total: summary.total,
    matchingProgress: oferta.matchingProgress,
    extractedCount: oferta.materialeExtrase?.length ?? 0,
    hasExtracted: Boolean(oferta.materialeExtrase?.length),
    hasMatched: Boolean(oferta.materialSummary || oferta.materialePotrivite?.length),
    materialsReady: oferta.materialSummary?.pricingVersion === 1 && oferta.materialSortingVersion === 1,
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
  args: { idGenerare: v.id("oferte"), pendingOnly: v.boolean(), sheetName: v.optional(v.string()), paginationOpts: paginationOptsValidator,
    sortBy: v.optional(v.union(v.literal("pretAchizitie"), v.literal("pretVanzare"), v.literal("manopera"),
      v.literal("cantitate"), v.literal("matchScore"), v.literal("totalVanzareManopera"))),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    await getOwnedOferta(ctx, args.idGenerare);
    const rows = ctx.db.query("ofertaMateriale");
    const indexed = args.sortBy
      ? rows.withIndex(`by_oferta_and_${args.sortBy}`, (index) => index.eq("oferta", args.idGenerare)).order(args.sortDirection ?? "asc")
      : args.pendingOnly
      ? rows.withIndex("by_oferta_and_pending_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("pending", true))
      : rows.withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare));
    const pending = args.sortBy && args.pendingOnly ? indexed.filter((q) => q.eq(q.field("pending"), true)) : indexed;
    const result = await (args.sheetName ? pending.filter((q) => q.eq(q.field("sheetName"), args.sheetName)) : pending).paginate(args.paginationOpts);
    return { ...result, page: result.page.map(normalizeMaterial) };
  },
});

export async function bulkValidationCandidates(ctx: QueryCtx, idGenerare: Id<"oferte">, minimumQuality: number, sheetName?: string) {
  if (!Number.isFinite(minimumQuality) || minimumQuality < 1 || minimumQuality > 10) {
    throw flowError("VALIDATION", "Alege o calitate minimă între 1 și 10.");
  }
  const pending = ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_pending_and_rand", (index) => index.eq("oferta", idGenerare).eq("pending", true));
  const rows = await (sheetName ? pending.filter((q) => q.eq(q.field("sheetName"), sheetName)) : pending).collect();
  return rows.map(normalizeMaterial).filter((material) => canBulkValidate(material, minimumQuality));
}

export const countBulkValidation = query({
  args: { idGenerare: v.id("oferte"), minimumQuality: v.number(), sheetName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await getOwnedOferta(ctx, args.idGenerare);
    return (await bulkValidationCandidates(ctx, args.idGenerare, args.minimumQuality, args.sheetName)).length;
  },
});

export const listOferte = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw flowError("AUTH", "Autentificarea este necesară. Conectează-te din nou pentru a continua.");
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
        sheetCount: oferta.selectedSheets?.length ?? 1,
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
    if (userId === null) throw flowError("AUTH", "Autentificarea este necesară. Conectează-te din nou pentru a continua.");
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

export const getExchangeRate = query({
  args: { moneda: v.string() },
  handler: async (ctx, args) => {
    const rate = await ctx.db.query("cursuriValutare")
      .withIndex("by_moneda", (index) => index.eq("moneda", args.moneda))
      .first();
    return rate?.valoare ?? null;
  },
});

export const getExchangeRateInternal = internalQuery({
  args: { moneda: v.string() },
  handler: async (ctx, args) => {
    const rate = await ctx.db.query("cursuriValutare")
      .withIndex("by_moneda", (index) => index.eq("moneda", args.moneda))
      .first();
    return rate?.valoare ?? null;
  },
});

export const getCursuriValutare = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("cursuriValutare").collect();
  },
});
