import { action, internalAction, internalMutation } from "./_generated/server";
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
    
    // Regex pentru RON și USD - același format
    const ronRegex = /currency=['"]RON['"]\s+rate=['"]([0-9.]+)['"]/i;
    const usdRegex = /currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/i;
    
    const ronMatch = ronRegex.exec(xmlText);
    const usdMatch = usdRegex.exec(xmlText);
    
    if (!ronMatch) {
      // Afișăm primele 500 de caractere din XML în loguri pentru a vedea exact structura
      console.error("XML primit de la ECB (primele 500 caractere):", xmlText.substring(0, 500));
      throw new Error("Nu am găsit cursul RON în XML-ul ECB.");
    }
    
    const eurToRon = parseFloat(ronMatch[1]);
    const eurToUsd = usdMatch ? parseFloat(usdMatch[1]) : null;
    
    // Calculez USD->RON din EUR->RON și EUR->USD
    const usdToRon = eurToUsd ? eurToRon / eurToUsd : null;
    
    console.log(`Cursul EUR->RON (Banca Centrala Europeana): ${eurToRon}`);
    if (usdToRon) console.log(`Cursul USD->RON (calculat): ${usdToRon}`);
    
    // Salvăm cursurile în baza de date
    await ctx.runMutation(internal.bnr.salveazaCurs, { moneda: "EUR", valoare: eurToRon });
    if (usdToRon) {
      await ctx.runMutation(internal.bnr.salveazaCurs, { moneda: "USD", valoare: usdToRon });
    }

    const result = [{ currency: "EUR", value: eurToRon, multiplier: 1 }];
    if (usdToRon) result.push({ currency: "USD", value: usdToRon, multiplier: 1 });
    
    return result;
  },
});

export const updateExchangeRates = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.bnr.getBNRRates);
  }
});
