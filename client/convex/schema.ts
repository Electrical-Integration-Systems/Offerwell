import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { excelMappingValidator } from "./oferte/mapping";

export const matchedMaterialValidator = v.object({
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
    oferte: defineTable({
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
