import { mutation, internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import { bulkValidationCandidates, getMaterials, getOwnedOferta } from "./queries";
import { matchedMaterialValidator } from "../schema";
import { assertReadyForExport, hasValidPrices, materialTotal, needsReview, normalizeMaterial, summarizeMaterials, MAX_EXCEL_BYTES, MAX_MATERIALS, type MatchedMaterial } from "./review";
import { salePrice, validSalePriceMultiplier } from "../material_prices";
import { excelMappingValidator, extractionMappingChanged } from "./mapping";
import { flowError, structureError } from "./errors";
import { clearExtractedMaterials, migrateExtractedMaterials, storeExtractedMaterials } from "./extracted";
import { RESTART_CONFIRMATION_TEXT } from "./restart_confirmation";

async function clearMaterials(ctx: MutationCtx, oferta: Doc<"oferte">) {
  if (oferta.materialSummary) {
    const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", oferta._id)).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

async function ensureOfferAccess(ctx: MutationCtx, oferta: Doc<"oferte">) {
  const access = await ctx.db.query("ofertaAcces").withIndex("by_oferta", (index) => index.eq("oferta", oferta._id)).unique();
  if (!access) await ctx.db.insert("ofertaAcces", { oferta: oferta._id, user: oferta.user });
}

async function storeMaterials(ctx: MutationCtx, oferta: Doc<"oferte">, materials: MatchedMaterial[]) {
  const id = oferta._id;
  await ensureOfferAccess(ctx, oferta);
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
  await ensureOfferAccess(ctx, oferta);
  await migrateExtractedMaterials(ctx, oferta);
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
    const summary = await storeMaterials(ctx, oferta, oferta.materialePotrivite ?? []);
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
    await ensureOfferAccess(ctx, oferta);
    if (oferta.materialePotrivite || oferta.materialSummary) await ensureMaterials(ctx, oferta);
    else await migrateExtractedMaterials(ctx, oferta);
    return null;
  },
});

export const deleteOferta = mutation({
  args: { idGenerare: v.id("oferte") },
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    await clearMaterials(ctx, oferta);
    await clearExtractedMaterials(ctx, oferta);
    const access = await ctx.db.query("ofertaAcces").withIndex("by_oferta", (index) => index.eq("oferta", oferta._id)).unique();
    if (access) await ctx.db.delete(access._id);
    await ctx.db.delete(args.idGenerare);
    return null;
  },
});

async function getCurrentOferta(ctx: MutationCtx, args: { idGenerare: Id<"oferte">; expectedRevision: number }) {
  const oferta = await getOwnedOferta(ctx, args.idGenerare);
  if ((oferta.revision ?? 0) !== args.expectedRevision) {
    throw flowError("CONFLICT", "Oferta a fost modificată în altă sesiune. Verifică datele actualizate și încearcă din nou.");
  }
  await migrateExtractedMaterials(ctx, oferta);
  return oferta.materialeExtrase === undefined ? oferta : (await ctx.db.get(oferta._id))!;
}

export const restartOferta = mutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), confirmation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const oferta = await getOwnedOferta(ctx, args.idGenerare);
    if ((oferta.revision ?? 0) !== args.expectedRevision) throw flowError("CONFLICT", "Oferta s-a modificat. Închide dialogul și verifică datele actualizate înainte de reluare.");
    if (args.confirmation !== RESTART_CONFIRMATION_TEXT) throw flowError("VALIDATION", "Tastează exact textul de confirmare afișat.");
    if (!await ctx.db.system.get(oferta.excelInput.content)) throw flowError("FILE_MISSING", "Fișierul Excel nu mai este disponibil. Încarcă-l într-o ofertă nouă.");
    if (!process.env.GROQ_API_KEY) throw flowError("ANALYSIS_UNAVAILABLE", "Reanalizarea automată nu este configurată. Configurează cheia serviciului de analiză înainte de reluare. Rezultatele existente au fost păstrate.");

    // Clear both legacy payloads and normalized rows atomically. Advancing the
    // revision rejects writes/progress from any earlier analysis or matching run.
    for await (const material of ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (q) => q.eq("oferta", oferta._id))) {
      await ctx.db.delete(material._id);
    }
    await clearExtractedMaterials(ctx, oferta);
    await ctx.db.patch(oferta._id, {
      excelMapping: undefined, sheetMappings: undefined,
      materialeExtrase: undefined, extractedCount: undefined,
      materialePotrivite: undefined, materialSummary: undefined, materialSortingVersion: undefined,
      matchingProgress: undefined, excelOutput: undefined,
      revision: args.expectedRevision + 1,
    });
    return null;
  },
});

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
    const id = await ctx.db.insert("oferte", {
      selectedSheets: args.selectedSheets,
        user: userId,
      revision: 0,
        excelInput: {
            content: args.storageId,
            fileName: args.fileName,
        },
    });
    await ctx.db.insert("ofertaAcces", { oferta: id, user: userId });
    return id;
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
    if (reextract) {
      await clearMaterials(ctx, oferta);
      await clearExtractedMaterials(ctx, oferta);
    }
    await ctx.db.patch(args.idGenerare, {
      excelMapping: sheetMappings?.find((entry) => entry.sheetName === oferta.selectedSheets?.[0])?.mapping ?? args.excelMapping,
      sheetMappings,
      matchingProgress: undefined,
      ...(reextract ? { materialSummary: undefined, materialeExtrase: undefined, extractedCount: undefined, materialePotrivite: undefined } : {}),
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
    await storeExtractedMaterials(ctx, oferta, args.materialeExtrase);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: undefined,
      materialeExtrase: undefined,
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
    const total = oferta.extractedCount ?? oferta.materialeExtrase?.length ?? 0;
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
    await storeMaterials(ctx, oferta, args.materialePotrivite.map((material) => oferta.salePriceMultiplier === undefined ? material : {
      ...material, salePriceMultiplier: oferta.salePriceMultiplier,
      pretVanzare: material.pretAchizitie * oferta.salePriceMultiplier,
    }));
    await ctx.db.patch(args.idGenerare, {
      excelOutput: undefined,
      matchingProgress: args.matchingRunId && oferta.matchingProgress ? { ...oferta.matchingProgress, status: "completed" as const } : undefined,
      revision: args.expectedRevision + 1,
    });
  },
});

export const valideazaMaterial = mutation({
  args: {
    salePriceMultiplier: v.optional(v.number()),
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
    if (args.salePriceMultiplier !== undefined && !validSalePriceMultiplier(args.salePriceMultiplier)) throw flowError("VALIDATION", "Multiplicatorul trebuie să fie un număr finit mai mare decât zero.");
    if (!hasValidPrices(args)) throw flowError("VALIDATION", "Cantitatea și prețurile trebuie să fie numere finite, pozitive sau zero. Verifică valorile introduse.");
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în forma curentă a ofertei. Închide corectarea și verifică lista actualizată.");
    const updated = {
      ...material,
      salePriceMultiplier: args.salePriceMultiplier,
      cantitate: args.cantitate,
      pretAchizitie: args.pretAchizitie,
      pretVanzare: salePrice(args),
      manopera: args.manopera,
      validated: true,
    };
    await ctx.db.patch(material._id, { cantitate: updated.cantitate, pretAchizitie: updated.pretAchizitie,
      salePriceMultiplier: updated.salePriceMultiplier,
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

export const aplicaMultiplicatorVanzare = mutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), salePriceMultiplier: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    if (!validSalePriceMultiplier(args.salePriceMultiplier)) throw flowError("VALIDATION", "Multiplicatorul trebuie să fie un număr finit mai mare decât zero.");
    if (oferta.matchingProgress?.status === "running") throw flowError("CONFLICT", "Așteaptă finalizarea procesării înainte de modificarea prețurilor.");
    if (!oferta.materialSummary && !oferta.materialePotrivite?.length) throw flowError("VALIDATION", "Procesează materialele înainte de modificarea prețurilor.");
    const summary = await ensureMaterials(ctx, oferta);
    const rows = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_rand", (q) => q.eq("oferta", oferta._id)).collect();
    let total = 0;
    for (const material of rows) {
      const updated = { ...material, salePriceMultiplier: args.salePriceMultiplier,
        pretVanzare: material.pretAchizitie * args.salePriceMultiplier };
      if (!hasValidPrices(updated)) throw flowError("VALIDATION", `Prețul calculat pentru rândul ${material.rand} nu este valid. Verifică prețul de achiziție și multiplicatorul.`);
      total += materialTotal(updated);
      await ctx.db.patch(material._id, { salePriceMultiplier: args.salePriceMultiplier,
        pretVanzare: updated.pretVanzare, totalVanzareManopera: materialTotal(updated) });
    }
    if (!Number.isFinite(total)) throw flowError("VALIDATION", "Totalul calculat este prea mare. Alege un multiplicator mai mic.");
    await ctx.db.patch(oferta._id, { salePriceMultiplier: args.salePriceMultiplier,
      materialSummary: { ...summary, total }, excelOutput: undefined, revision: args.expectedRevision + 1 });
    return null;
  },
});

export const nevalideazaMaterial = mutation({
  args: { idGenerare: v.id("oferte"), expectedRevision: v.number(), sheetName: v.optional(v.string()), rand: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale").withIndex("by_oferta_and_sheet_and_rand", (q) => q.eq("oferta", args.idGenerare).eq("sheetName", args.sheetName).eq("rand", args.rand)).unique();
    if (!material || material.validated !== true) throw flowError("CONFLICT", "Materialul nu mai este validat. Verifică oferta actualizată.");
    await ctx.db.patch(material._id, { validated: false, requiresValidation: true, pending: true });
    await ctx.db.patch(oferta._id, {
      materialSummary: { ...summary, pendingCount: summary.pendingCount + (material.pending ? 0 : 1) },
      excelOutput: undefined, revision: args.expectedRevision + 1,
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
    catalogMaterialId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const oferta = await getCurrentOferta(ctx, args);
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale")
      .withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în ofertă. Verifică lista actualizată.");
    if (!args.descriere.trim() || args.descriere.length > 10000 || !hasValidPrices({ ...args, cantitate: material.cantitate })) {
      throw flowError("VALIDATION", "Materialul selectat are date sau prețuri invalide. Alege alt material.");
    }
    const salePriceMultiplier = material.salePriceMultiplier ?? oferta.salePriceMultiplier;
    const updated = normalizeMaterial({ ...material, salePriceMultiplier, descriereGasita: args.descriere, pretAchizitie: args.pretAchizitie,
      pretVanzare: salePrice({ ...args, salePriceMultiplier }), manopera: args.manopera, validated: false, requiresValidation: true });
    if (!hasValidPrices(updated)) throw flowError("VALIDATION", "Prețurile calculate nu sunt valide.");
    await ctx.db.patch(material._id, { salePriceMultiplier, catalogMaterialId: args.catalogMaterialId, descriereGasita: updated.descriereGasita, pretAchizitie: updated.pretAchizitie,
      pretVanzare: updated.pretVanzare, manopera: updated.manopera, matchScore: updated.matchScore,
      matchedTokens: updated.matchedTokens, validated: false, requiresValidation: true, pending: true, totalVanzareManopera: materialTotal(updated) });
    await ctx.db.patch(args.idGenerare, {
      materialSummary: { ...summary, pendingCount: summary.pendingCount + (material.pending ? 0 : 1), total: summary.total - materialTotal(material) + materialTotal(updated) },
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
    const summary = await ensureMaterials(ctx, oferta);
    const material = await ctx.db.query("ofertaMateriale")
      .withIndex("by_oferta_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("rand", args.rand))
      .filter((q) => q.eq(q.field("sheetName"), args.sheetName)).unique();
    if (!material) throw flowError("CONFLICT", "Materialul nu mai există în ofertă. Verifică lista actualizată.");
    await ctx.db.delete(material._id);
    const extracted = await ctx.db.query("ofertaExtrase").withIndex("by_oferta_and_sheet_and_rand", (index) => index.eq("oferta", args.idGenerare).eq("sheetName", args.sheetName).eq("rand", args.rand)).unique();
    if (extracted) await ctx.db.delete(extracted._id);
    await ctx.db.patch(args.idGenerare, {
      materialSummary: { ...summary, materialCount: summary.materialCount - 1, pendingCount: summary.pendingCount - (material.pending ? 1 : 0), total: summary.total - materialTotal(material) },
      materialeExtrase: undefined,
      extractedCount: (oferta.extractedCount ?? oferta.materialeExtrase?.length ?? 0) - (extracted ? 1 : 0),
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
