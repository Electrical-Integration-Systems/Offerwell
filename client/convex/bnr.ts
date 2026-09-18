import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Mutația internă care scrie cursul în DB
export const salveazaCurs = internalMutation({
  args: { 
    moneda: v.string(), 
    valoare: v.number() 
  },
  handler: async (ctx, args) => {
    const existent = await ctx.db
      .query("cursuriValutare")
      .withIndex("by_moneda", (q) => q.eq("moneda", args.moneda))
      .first();

    const now = new Date().toISOString();

    if (existent) {
      await ctx.db.patch(existent._id, { valoare: args.valoare, dataActualizare: now });
    } else {
      await ctx.db.insert("cursuriValutare", { 
        moneda: args.moneda, 
        valoare: args.valoare, 
        dataActualizare: now 
      });
    }
  },
});

export const getBNRRates = internalAction({
  args: {},
  handler: async (ctx) => {
    const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
    
    if (!response.ok) {
      throw new Error("Failed to fetch ECB rates");
    }
    
    const xmlText = await response.text();
    
    // Regex flexibil: caută currency='RON' sau currency="RON" și extrage rata
    const ronRegex = /currency=['"]RON['"]\s+rate=['"]([0-9.]+)['"]/i;
    const match = ronRegex.exec(xmlText);
    
    if (!match) {
      // Afișăm primele 500 de caractere din XML în loguri pentru a vedea exact structura
      console.error("XML primit de la ECB (primele 500 caractere):", xmlText.substring(0, 500));
      throw new Error("Nu am găsit cursul RON în XML-ul ECB.");
    }
    
    const eurToRon = parseFloat(match[1]);
    console.log(`Cursul EUR->RON (Banca Centrala Europeana): ${eurToRon}`);
    
    // Aici apelezi mutatia pentru a-l salva in baza de date
    await ctx.runMutation(internal.bnr.salveazaCurs, { moneda: "EUR", valoare: eurToRon });

    return [{ currency: "EUR", value: eurToRon, multiplier: 1 }];
  },
});
