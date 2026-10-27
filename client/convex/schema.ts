import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { excelMappingValidator } from "./oferte/mapping";

export const matchedMaterialValidator = v.object({
    salePriceMultiplier: v.optional(v.number()),
    catalogMaterialId: v.optional(v.string()),
    sheetName: v.optional(v.string()),
    rand: v.number(),
    descriereOriginala: v.string(),
    descriereGasita: v.string(),
    cantitate: v.number(),
    unitate: v.string(),
    matchScore: v.number(),
    matchedTokens: v.optional(v.array(v.string())),
    requiresValidation: v.optional(v.boolean()),
    validated: v.optional(v.boolean()),
    pretAchizitie: v.number(),
    pretVanzare: v.number(),
    manopera: v.number(),
});
  
const schema = defineSchema({
  ...authTables,
    ofertaExtrase: defineTable({
      oferta: v.id("oferte"), position: v.number(), sheetName: v.optional(v.string()), rand: v.number(),
      descriere: v.string(), cantitate: v.number(), unitate: v.string(),
    }).index("by_oferta_and_rand", ["oferta", "rand"])
      .index("by_oferta_and_position", ["oferta", "position"])
      .index("by_oferta_and_sheet_and_rand", ["oferta", "sheetName", "rand"]),
    ofertaAcces: defineTable({ oferta: v.id("oferte"), user: v.id("users") })
      .index("by_oferta", ["oferta"]),
    oferte: defineTable({
        salePriceMultiplier: v.optional(v.number()),
        extractedCount: v.optional(v.number()),
        user: v.id("users"),
        materialSortingVersion: v.optional(v.number()),
        matchingProgress: v.optional(v.object({ runId: v.string(), completed: v.number(), total: v.number(),
          status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")) })),
        materialSummary: v.optional(v.object({ materialCount: v.number(), pendingCount: v.number(), total: v.number(), pricingVersion: v.optional(v.number()) })),
            revision: v.optional(v.number()),
        excelInput: v.object({
            content: v.id("_storage"),
            fileName: v.string(),
        }),
        excelOutput: v.optional(v.object({
            content: v.id("_storage"),
            fileName: v.string(),
            formatVersion: v.optional(v.number()),
        })),
        excelMapping: v.optional(excelMappingValidator),
        selectedSheets: v.optional(v.array(v.string())),
        sheetMappings: v.optional(v.array(v.object({ sheetName: v.string(), mapping: excelMappingValidator }))),
        materialeExtrase: v.optional(v.array(v.object({
            sheetName: v.optional(v.string()),
            rand: v.number(),
            descriere: v.string(),
            cantitate: v.number(),
            unitate: v.string(),
        }))),
        materialePotrivite: v.optional(v.array(matchedMaterialValidator))
    }).index("by_user", ["user"]),
    ofertaMateriale: defineTable(matchedMaterialValidator.extend({
        oferta: v.id("oferte"),
        pending: v.boolean(),
        totalVanzareManopera: v.optional(v.number()),
    }))
    .index("by_oferta_and_rand", ["oferta", "rand"])
    .index("by_oferta_and_sheet_and_pretAchizitie", ["oferta", "sheetName", "pretAchizitie", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_pretAchizitie", ["oferta", "sheetName", "pending", "pretAchizitie", "rand"])
    .index("by_oferta_and_pending_and_pretAchizitie", ["oferta", "pending", "pretAchizitie", "rand"])
    .index("by_oferta_and_sheet_and_pretVanzare", ["oferta", "sheetName", "pretVanzare", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_pretVanzare", ["oferta", "sheetName", "pending", "pretVanzare", "rand"])
    .index("by_oferta_and_pending_and_pretVanzare", ["oferta", "pending", "pretVanzare", "rand"])
    .index("by_oferta_and_sheet_and_manopera", ["oferta", "sheetName", "manopera", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_manopera", ["oferta", "sheetName", "pending", "manopera", "rand"])
    .index("by_oferta_and_pending_and_manopera", ["oferta", "pending", "manopera", "rand"])
    .index("by_oferta_and_sheet_and_cantitate", ["oferta", "sheetName", "cantitate", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_cantitate", ["oferta", "sheetName", "pending", "cantitate", "rand"])
    .index("by_oferta_and_pending_and_cantitate", ["oferta", "pending", "cantitate", "rand"])
    .index("by_oferta_and_sheet_and_matchScore", ["oferta", "sheetName", "matchScore", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_matchScore", ["oferta", "sheetName", "pending", "matchScore", "rand"])
    .index("by_oferta_and_pending_and_matchScore", ["oferta", "pending", "matchScore", "rand"])
    .index("by_oferta_and_sheet_and_totalVanzareManopera", ["oferta", "sheetName", "totalVanzareManopera", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_totalVanzareManopera", ["oferta", "sheetName", "pending", "totalVanzareManopera", "rand"])
    .index("by_oferta_and_pending_and_totalVanzareManopera", ["oferta", "pending", "totalVanzareManopera", "rand"])
    .index("by_oferta_and_sheet_and_rand", ["oferta", "sheetName", "rand"])
    .index("by_oferta_and_sheet_and_pending_and_rand", ["oferta", "sheetName", "pending", "rand"])
    .index("by_oferta_and_pretAchizitie", ["oferta", "pretAchizitie", "rand"])
    .index("by_oferta_and_pretVanzare", ["oferta", "pretVanzare", "rand"])
    .index("by_oferta_and_manopera", ["oferta", "manopera", "rand"])
    .index("by_oferta_and_cantitate", ["oferta", "cantitate", "rand"])
    .index("by_oferta_and_matchScore", ["oferta", "matchScore", "rand"])
    .index("by_oferta_and_totalVanzareManopera", ["oferta", "totalVanzareManopera", "rand"])
    .index("by_oferta_and_pending_and_rand", ["oferta", "pending", "rand"]),
    cursuriValutare: defineTable({
        moneda: v.string(),
        valoare: v.number(), 
        dataActualizare: v.string(), 
    }).index("by_moneda", ["moneda"]),
    preturiMetale: defineTable({
    metal: v.string(),
    valoareUSD: v.number(),
    valoareRON: v.number(),
    valoareEUR: v.number(),
    unitate: v.string(),
    dataActualizare: v.string(),
    }).index("by_metal", ["metal"]),
});

export default schema;
