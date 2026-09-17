import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
 
const schema = defineSchema({
  ...authTables,
  // Your other tables...
  generari: defineTable({
    user: v.id("users"),
    excel: v.string(),
    parsingOptions: v.object({
        randIncepereDate: v.number(),
        coloanaDescriere: v.string(),
        valuta: v.string(),
        coloanaSfarsitDate: v.string(),
    })
  })
});
 
export default schema;
