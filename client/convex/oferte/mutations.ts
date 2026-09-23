import { mutation, internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getMaterials, getOwnedOferta } from "./queries";
import { matchedMaterialValidator } from "../schema";
import { assertReadyForExport, hasValidPrices, materialTotal, needsReview, summarizeMaterials, MAX_EXCEL_BYTES, MAX_MATERIALS, type MatchedMaterial } from "./review";

async function clearMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  if (oferta.materialSummary) {
    const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

async function storeMaterials(ctx: MutationCtx, id: Id<"oferte">, materials: MatchedMaterial[]) {
  if (materials.length > MAX_MATERIALS || new Set(materials.map((material) => material.rand)).size !== materials.length) {
    throw new Error("Lista de materiale este invalida.");
  }
  for (const material of materials) await ctx.db.insert("ofertaMateriale", { ...material, oferta: id, pending: needsReview(material) });
  const summary = summarizeMaterials(materials);
  await ctx.db.patch(id, { materialSummary: summary, materialePotrivite: undefined });
  return summary;
}

async function ensureMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  return oferta.materialSummary ?? await storeMaterials(ctx, oferta._id, oferta.materialePotrivite ?? []);
}

export const prepareMaterialPagination = mutation({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    if (oferta.materialePotrivite) await ensureMaterials(ctx, oferta);
    return null;
  },
});

export const stergeOferta = mutation({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    await clearMaterials(ctx, oferta);
    await ctx.db.delete(args.idGenerare);
    return null;
  },
});

async function getCurrentOferta(ctx: MutationCtx, args: { idGenerare: Id<"oferte">; expectedRevision: number }) {
  const oferta = await getOwnedOferta(ctx, args.idGenerare);
  if ((oferta.revision ?? 0) !== args.expectedRevision) {
    throw new Error("Oferta a fost modificata. Reincearca folosind datele actualizate.");
  }
  return oferta;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    if (userId === null) {
      throw new Error("Unauthenticated call to mutation");
    }
    
    return await ctx.storage.generateUploadUrl();
  },
})

export const uploadInputExcel = mutation({
  args: {
    storageId: v.id("_storage"), fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    if (userId === null) {
      throw new Error("Unauthenticated call to mutation");
    }

    const metadata = await ctx.db.system.get(args.storageId);
    if (!args.fileName.toLowerCase().endsWith(".xlsx") || args.fileName.length > 255
      || !metadata || metadata.size === 0 || metadata.size > MAX_EXCEL_BYTES) {
      throw new Error("Selecteaza un fisier .xlsx valid, de maximum 10 MB.");
    }

    return await ctx.db.insert("oferte", {
        user: userId,
      revision: 0,
        excelInput: {
            content: args.storageId,
            fileName: args.fileName,
        },
    });
  },
})

export const updateExcelMapping = internalMutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    excelMapping: v.object({
      randIncepereDate: v.number(),
      coloanaDescriere: v.string(),
      coloanaCantitati: v.string(),
      coloanaUnitate: v.string(),
      valuta: v.string(),
      coloanaSfarsitDate: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    await clearMaterials(ctx, oferta);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: undefined,
      excelMapping: args.excelMapping,
      materialeExtrase: undefined,
      materialePotrivite: undefined,
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const updateMaterialeExtrase = internalMutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    materialeExtrase: v.array(
      v.object({
        rand: v.number(),
        descriere: v.string(),
        cantitate: v.number(),
        unitate: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (!args.materialeExtrase.length || args.materialeExtrase.length > MAX_MATERIALS) {
      throw new Error(`Fisierul trebuie sa contina intre 1 si ${MAX_MATERIALS} materiale.`);
    }
    await clearMaterials(ctx, oferta);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: undefined,
      materialeExtrase: args.materialeExtrase,
      materialePotrivite: undefined,
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const updateMaterialePotrivite = internalMutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    materialePotrivite: v.array(matchedMaterialValidator),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    await clearMaterials(ctx, oferta);
    await storeMaterials(ctx, args.idGenerare, args.materialePotrivite);
    await ctx.db.patch(args.idGenerare, {
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const valideazaMaterial = mutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    rand: v.number(),
    cantitate: v.number(),
    pretAchizitie: v.number(),
    pretVanzare: v.number(),
    manopera: v.number(),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (!hasValidPrices(args)) throw new Error("Cantitatea si preturile trebuie sa fie numere finite, pozitive sau zero.");
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand)).unique();
    if (!material) throw new Error("Materialul nu exista.");
    const updated = {
      ...material,
      cantitate: args.cantitate,
      pretAchizitie: args.pretAchizitie,
      pretVanzare: args.pretVanzare,
      manopera: args.manopera,
      validated: true,
    };
    await ctx.db.patch(material._id, { cantitate: updated.cantitate, pretAchizitie: updated.pretAchizitie,
      pretVanzare: updated.pretVanzare, manopera: updated.manopera, validated: true, pending: false });
    await ctx.db.patch(args.idGenerare, {
      materialSummary: { ...summary, pendingCount: summary.pendingCount - (material.pending ? 1 : 0),
        total: summary.total - materialTotal(material) + materialTotal(updated) },
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
    return null;
  },
});

export const updateExcelOutput = internalMutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    excelOutput: v.object({
      content: v.id("_storage"),
      fileName: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    assertReadyForExport(await getMaterials(ctx, oferta));
    await ctx.db.patch(args.idGenerare, { excelOutput: args.excelOutput });
  },
});
