import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const salveazaPretMetal = internalMutation({
  args: { 
    metal: v.string(), 
    valoareUSD: v.number(),
    valoareRON: v.number(),
    valoareEUR: v.number(),
    unitate: v.string()     
  },
  handler: async (ctx, args) => {
    const existent = await ctx.db
      .query("preturiMetale")
      .withIndex("by_metal", (q) => q.eq("metal", args.metal))
      .first();

    const now = new Date().toISOString();

    if (existent) {
      await ctx.db.patch(existent._id, { 
        valoareUSD: args.valoareUSD,
        valoareRON: args.valoareRON,
        valoareEUR: args.valoareEUR,
        dataActualizare: now 
      });
    } else {
      await ctx.db.insert("preturiMetale", { 
        metal: args.metal, 
        valoareUSD: args.valoareUSD,
        valoareRON: args.valoareRON,
        valoareEUR: args.valoareEUR,
        unitate: args.unitate,
        dataActualizare: now 
      });
    }
  },
});

export const getCopperPrice = internalAction({
  args: {},
  handler: async (ctx) => {
    // URL-ul corect care returnează strict JSON cu datele bursiere ale cuprului (HG=F)
    const url = "https://query2.finance.yahoo.com/v8/finance/chart/HG=F";
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo API a raspuns cu status: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    try {
      // Structura corectă a obiectului JSON returnat de endpoint-ul /v8/finance/chart/
      const regularMarketPrice = data.chart.result[0].meta.regularMarketPrice;
      
      if (!regularMarketPrice) {
        throw new Error("Campul regularMarketPrice nu a fost gasit in structura metalului.");
      }

      // Convertim din dolari/livră (Lbs) în USD/kg
      // Yahoo returnează deja în dolari/lb, nu în cenți
      // Formula: Dolari/lb * (lb/kg) = Dolari/kg
      const pretDolariperLbs = regularMarketPrice;
      const pretUSDperKg = pretDolariperLbs / 0.45359237;

      console.log(`[SUCCES] Preț Cupru: ${pretDolariperLbs} dolari/lbs (~${pretUSDperKg.toFixed(4)} USD/kg)`);
      
      // Fetchăm cursurile valutare pentru a face conversiile
      const cursuri = await ctx.runQuery(internal.oferte.queries.getCursuriValutare);
      const usdToRonRate = cursuri.find((c: any) => c.moneda === "USD")?.valoare || 1; // USD->RON
      const eurToRonRate = cursuri.find((c: any) => c.moneda === "EUR")?.valoare || 1; // EUR->RON
      
      const pretUSDperKgFinal = parseFloat(pretUSDperKg.toFixed(4));
      const pretRONperKg = parseFloat((pretUSDperKg * usdToRonRate).toFixed(4));
      const pretEURperKg = parseFloat((pretUSDperKg * usdToRonRate / eurToRonRate).toFixed(4));
      
      // Apelăm mutația internă folosind numele corect al exportului (yahooFinance)
      await ctx.runMutation(internal.yahooFinance.salveazaPretMetal, {
        metal: "Cupru", 
        valoareUSD: pretUSDperKgFinal,
        valoareRON: pretRONperKg,
        valoareEUR: pretEURperKg,
        unitate: "kg"
      });

      return { 
        metal: "Cupru", 
        valoareUSDperKg: pretUSDperKgFinal,
        valoareRONperKg: pretRONperKg,
        valoareEURperKg: pretEURperKg
      };
    } catch (error) {
      console.error("Structura JSON primita de la Yahoo:", JSON.stringify(data).substring(0, 500));
      throw new Error(`Eroare la parsarea datelor Yahoo: ${error}`);
    }
  },
});

export const updateCopperPrice = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.yahooFinance.getCopperPrice);
  }
});
