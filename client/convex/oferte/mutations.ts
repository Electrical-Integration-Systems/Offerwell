import { mutation, internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import { bulkValidationCandidates, getMaterials, getOwnedOferta } from "./queries";
import { matchedMaterialValidator } from "../schema";
import { assertReadyForExport, hasValidPrices, materialTotal, needsReview, normalizeMaterial, summarizeMaterials, MAX_EXCEL_BYTES, MAX_MATERIALS, type MatchedMaterial } from "./review";
import { salePrice } from "../material_prices";
import { excelMappingValidator, extractionMappingChanged } from "./mapping";
import { flowError, structureError } from "./errors";

async function clearMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  if (oferta.materialSummary) {
    const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

async function storeMaterials(ctx: MutationCtx, id: Id<"oferte">, materials: MatchedMaterial[]) {
  materials = materials.map(normalizeMaterial);
  if (materials.length > MAX_MATERIALS || new Set(materials.map((material) => JSON.stringify([material.sheetName, material.rand]))).size !== materials.length) {
    throw flowError("RETRY", "Lista de materiale nu a putut fi salvată. Reia procesarea ofertei.");
  }
  for (const material of materials) await ctx.db.insert("ofertaMateriale", { ...material, oferta: id, pending: needsReview(material), totalVanzareManopera: materialTotal(material) });
  const summary = summarizeMaterials(materials);
  await ctx.db.patch(id, { materialSummary: summary, materialePotrivite: undefined, materialSortingVersion: 1 });
  return summary;
}

async function ensureMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  if (oferta.materialSummary?.pricingVersion === 1) {
    if (oferta.materialSortingVersion !== 1) {
      const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
      for (const row of rows) {
        const material = normalizeMaterial(row);
        await ctx.db.patch(row._id, { totalVanzareManopera: materialTotal(material), matchScore: material.matchScore, matchedTokens: material.matchedTokens });
      }
      await ctx.db.patch(oferta._id, { materialSortingVersion: 1 });
    }
    return oferta.materialSummary;
  }
  if (!oferta.materialSummary) {
    const summary = await storeMaterials(ctx, oferta._id, oferta.materialePotrivite ?? []);
    await ctx.db.patch(oferta._id, { excelOutput: undefined, revision: (oferta.revision ?? 0) + 1 });
    return summary;
  }
  const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
  const materials = rows.map(normalizeMaterial);
  for (const material of materials) {
    await ctx.db.patch(material._id, { pretVanzare: material.pretVanzare, matchScore: material.matchScore,
      matchedTokens: material.matchedTokens, pending: needsReview(material), totalVanzareManopera: materialTotal(material) });
  }
  const summary = summarizeMaterials(materials);
  await ctx.db.patch(oferta._id, { materialSummary: summary, materialSortingVersion: 1, excelOutput: undefined, revision: (oferta.revision ?? 0) + 1 });
  return summary;
}

export const prepareMaterialPagination = mutation({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    if (oferta.materialePotrivite || oferta.materialSummary) await ensureMaterials(ctx, oferta);
    return null;
  },
});

export const deleteOferta = mutation({
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
    throw flowError("CONFLICT", "Oferta a fost modificată în altă sesiune. Verifică datele actualizate și încearcă din nou.");
  }
  return oferta;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    if (userId === null) {
      throw flowError("AUTH", "Autentificarea este necesară. Conectează-te din nou pentru a continua.");
    }
    
    return await ctx.storage.generateUploadUrl();
  },
})

export const uploadInputExcel = mutation({
  args: {
    storageId: v.id("_storage"), fileName: v.string(),
    selectedSheets: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    if (userId === null) {
      throw flowError("AUTH", "Autentificarea este necesară. Conectează-te din nou pentru a continua.");
    }

    const metadata = await ctx.db.system.get(args.storageId);
    if (!args.fileName.toLowerCase().endsWith(".xlsx") || args.fileName.length > 255
      || !metadata || metadata.size === 0 || metadata.size > MAX_EXCEL_BYTES) {
      throw flowError("INVALID_FILE", "Selectează un fișier .xlsx valid, de maximum 10 MB.");
    }

    if (args.selectedSheets && (!args.selectedSheets.length || args.selectedSheets.length > 100 || new Set(args.selectedSheets).size !== args.selectedSheets.length)) {
      throw flowError("INVALID_FILE", "Selectează între 1 și 100 de foi distincte.");
    }
    return await ctx.db.insert("oferte", {
      selectedSheets: args.selectedSheets,
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
    excelMapping: excelMappingValidator,
    sheetName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (args.sheetName && !oferta.selectedSheets?.includes(args.sheetName)) throw flowError("STRUCTURE", "Foaia nu este selectată. Alege una dintre foile selectate pentru ofertă.");
    const sheetMappings = args.sheetName
      ? [...(oferta.sheetMappings ?? []).filter((entry) => entry.sheetName !== args.sheetName), { sheetName: args.sheetName, mapping: args.excelMapping }]
      : oferta.sheetMappings;
    const previousMapping = args.sheetName
      ? oferta.sheetMappings?.find((entry) => entry.sheetName === args.sheetName)?.mapping
      : oferta.excelMapping;
    const reextract = extractionMappingChanged(previousMapping, args.excelMapping);
    if (reextract) await clearMaterials(ctx, oferta);
    await ctx.db.patch(args.idGenerare, {
      excelMapping: sheetMappings?.find((entry) => entry.sheetName === oferta.selectedSheets?.[0])?.mapping ?? args.excelMapping,
      sheetMappings,
      matchingProgress: undefined,
      ...(reextract ? { materialSummary: undefined, materialeExtrase: undefined, materialePotrivite: undefined } : {}),
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
        sheetName: v.optional(v.string()),
        rand: v.number(),
        descriere: v.string(),
        cantitate: v.number(),
        unitate: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (!args.materialeExtrase.length) throw structureError();
    if (args.materialeExtrase.length > MAX_MATERIALS) {
      throw flowError("LIMIT", `Fișierul depășește limita de ${MAX_MATERIALS} materiale în total. Împarte lista în fișiere mai mici sau selectează mai puține foi.`);
    }
    await clearMaterials(ctx, oferta);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: undefined,
      materialeExtrase: args.materialeExtrase,
      matchingProgress: undefined,
      materialePotrivite: undefined,
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const startMatching = internalMutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), runId: v.string() },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    const total = oferta.materialeExtrase?.length ?? 0;
    if (!total) throw structureError();
    await ctx.db.patch(args.idGenerare, { matchingProgress: { runId: args.runId, completed: 0, total, status: "running" } });
    return null;
  },
});

export const reportMatchingProgress = internalMutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), runId: v.string(), completed: v.number(),
    status: v.union(v.literal("running"), v.literal("failed")) },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    const progress = oferta.matchingProgress;
    if ((oferta.revision ?? 0) !== args.expectedRevision || progress?.runId !== args.runId || progress.status !== "running") return false;
    if (!Number.isInteger(args.completed) || args.completed < 0 || args.completed > progress.total) {
      throw flowError("RETRY", "Progresul căutării nu a putut fi actualizat. Reia procesarea.");
    }
    await ctx.db.patch(args.idGenerare, { matchingProgress: { ...progress, completed: Math.max(progress.completed, args.completed), status: args.status } });
    return true;
  },
});

export const updateMaterialePotrivite = internalMutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    materialePotrivite: v.array(matchedMaterialValidator),
    matchingRunId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (args.matchingRunId !== undefined && (oferta.matchingProgress?.runId !== args.matchingRunId
      || oferta.matchingProgress.status !== "running" || oferta.matchingProgress.completed !== oferta.matchingProgress.total
      || args.materialePotrivite.length !== oferta.matchingProgress.total)) {
      throw flowError("CONFLICT", "Procesarea ofertei a fost reluată sau modificată în altă sesiune. Verifică progresul actualizat.");
    }
    await clearMaterials(ctx, oferta);
    await storeMaterials(ctx, args.idGenerare, args.materialePotrivite);
    await ctx.db.patch(args.idGenerare, {
      excelOutput: undefined,
      matchingProgress: args.matchingRunId && oferta.matchingProgress ? { ...oferta.matchingProgress, status: "completed" as const } : undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const valideazaMaterial = mutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    rand: v.number(),
    sheetName: v.optional(v.string()),
    cantitate: v.number(),
    pretAchizitie: v.number(),
    pretVanzare: v.number(),
    manopera: v.number(),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (!hasValidPrices(args)) throw flowError("VALIDATION", "Cantitatea și prețurile trebuie să fie numere finite, pozitive sau zero. Verifică valorile introduse.");
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în forma curentă a ofertei. Închide corectarea și verifică lista actualizată.");
    const updated = {
      ...material,
      cantitate: args.cantitate,
      pretAchizitie: args.pretAchizitie,
      pretVanzare: salePrice(args),
      manopera: args.manopera,
      validated: true,
    };
    await ctx.db.patch(material._id, { cantitate: updated.cantitate, pretAchizitie: updated.pretAchizitie,
      pretVanzare: updated.pretVanzare, manopera: updated.manopera, validated: true, pending: false, totalVanzareManopera: materialTotal(updated) });
    await ctx.db.patch(args.idGenerare, {
      materialSummary: { ...summary, pendingCount: summary.pendingCount - (material.pending ? 1 : 0),
        total: summary.total - materialTotal(material) + materialTotal(updated) },
      excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
    return null;
  },
});

export const valideazaMaterialeDupaCalitate = mutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), minimumQuality: v.number(), sheetName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    const summary = await ensureMaterials(ctx, oferta);
    const candidates = await bulkValidationCandidates(ctx, args.idGenerare, args.minimumQuality, args.sheetName);
    if (!candidates.length) return { validatedCount: 0 };
    for (const material of candidates) await ctx.db.patch(material._id, { validated: true, pending: false });
    await ctx.db.patch(args.idGenerare, {
      materialSummary: { ...summary, pendingCount: summary.pendingCount - candidates.length },
      excelOutput: undefined, revision: args.expectedRevision + 1,
    });
    return { validatedCount: candidates.length };
  },
});

export const schimbaMaterial = mutation({
  args: {
    idGenerare: v.id("oferte"), expectedRevision: v.number(), rand: v.number(), sheetName: v.optional(v.string()),
    descriere: v.string(), pretAchizitie: v.number(), pretVanzare: v.number(), manopera: v.number(),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale")
      .withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în ofertă. Verifică lista actualizată.");
    if (!args.descriere.trim() || args.descriere.length > 10000 || !hasValidPrices({ ...args, cantitate: material.cantitate })) {
      throw flowError("VALIDATION", "Materialul selectat are date sau prețuri invalide. Alege alt material.");
    }
    const updated = normalizeMaterial({ ...material, descriereGasita: args.descriere, pretAchizitie: args.pretAchizitie,
      pretVanzare: salePrice(args), manopera: args.manopera, validated: false, requiresValidation: true });
    await ctx.db.patch(material._id, { descriereGasita: updated.descriereGasita, pretAchizitie: updated.pretAchizitie,
      pretVanzare: updated.pretVanzare, manopera: updated.manopera, matchScore: updated.matchScore,
      matchedTokens: updated.matchedTokens, validated: false, requiresValidation: true, pending: true, totalVanzareManopera: materialTotal(updated) });
    const currentOferta = await ctx.db.get(args.idGenerare);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: summarizeMaterials(await getMaterials(ctx, currentOferta!) ?? []),
      excelOutput: undefined, revision: args.expectedRevision + 1,
    });
    return null;
  },
});

export const stergeMaterial = mutation({
  args: {
    idGenerare: v.id("oferte"),
    expectedRevision: v.number(),
    rand: v.number(),
    sheetName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale")
      .withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în ofertă. Verifică lista actualizată.");
    await ctx.db.delete(material._id);
    const currentOferta = await ctx.db.get(args.idGenerare);
    const remaining = await getMaterials(ctx, currentOferta!) ?? [];
    await ctx.db.patch(args.idGenerare, {
      materialSummary: summarizeMaterials(remaining),
      materialeExtrase: oferta.materialeExtrase?.filter((row) => row.rand !== args.rand || row.sheetName !== args.sheetName),
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
    allowUnvalidated: v.optional(v.boolean()),
    excelOutput: v.object({
      content: v.id("_storage"),
      fileName: v.string(),
      formatVersion: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    assertReadyForExport(await getMaterials(ctx, oferta), args.allowUnvalidated);
    await ctx.db.patch(args.idGenerare, { excelOutput: args.excelOutput });
  },
});
