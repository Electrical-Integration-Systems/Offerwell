import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const matchedMaterialValidator = v.object({
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
        materialSummary: v.optional(v.object({ materialCount: v.number(), pendingCount: v.number(), total: v.number() })),
            revision: v.optional(v.number()),
        excelInput: v.object({
            content: v.id("_storage"),
            fileName: v.string(),
        }),
        excelOutput: v.optional(v.object({
            content: v.id("_storage"),
            fileName: v.string(),
        })),
        excelMapping: v.optional(v.object({
            randIncepereDate: v.number(),
            coloanaDescriere: v.string(),
            coloanaCantitati: v.string(),
            coloanaUnitate: v.string(),
            valuta: v.string(),
            coloanaSfarsitDate: v.string(),
        })),
        materialeExtrase: v.optional(v.array(v.object({
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
    }))
    .index("by_oferta_and_rand", ["oferta", "rand"])
    .index("by_oferta_and_pending_and_rand", ["oferta", "pending", "rand"]),
  cursuriValutare: defineTable({
      moneda: v.string(),
      valoare: v.number(), 
      dataActualizare: v.string(), 
  }).index("by_moneda", ["moneda"]),
});

export default schema;
