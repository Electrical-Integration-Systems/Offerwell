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
    const response = await fetch("https://curs.bnr.ro/nbrfxrates.xml");
    
    if (!response.ok) {
      throw new Error("Failed to fetch BNR rates");
    }
    
    const xmlText = await response.text();
    
    // Regex pentru EUR și USD - noua structură: <Rate currency="EUR">5.3447</Rate>
    const eurRegex = /<Rate currency=["']EUR["']>([0-9.]+)<\/Rate>/i;
    const usdRegex = /<Rate currency=["']USD["']>([0-9.]+)<\/Rate>/i;
    
    const eurMatch = eurRegex.exec(xmlText);
    const usdMatch = usdRegex.exec(xmlText);
    
    if (!eurMatch) {
      // Afișăm primele 500 de caractere din XML în loguri pentru a vedea exact structura
      console.error("XML primit de la BNR (primele 500 caractere):", xmlText.substring(0, 500));
      throw new Error("Nu am găsit cursul EUR în XML-ul BNR.");
    }
    
    const eurToRon = parseFloat(eurMatch[1]);
    const usdToRon = usdMatch ? parseFloat(usdMatch[1]) : null;
    
    console.log(`Cursul EUR->RON (Banca Națională a României): ${eurToRon}`);
    if (usdToRon) console.log(`Cursul USD->RON (Banca Națională a României): ${usdToRon}`);
    
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
