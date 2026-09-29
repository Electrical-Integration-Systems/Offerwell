import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "BNR Rates",
  { hourUTC: 11, minuteUTC: 0 }, 
  // Apelăm acțiunea folosind numele fișierului (bnr) și funcția exportată (getBNRRates)
  internal.bnr.getBNRRates
);

crons.daily(
  "Copper Prices",
  { hourUTC: 11, minuteUTC: 0 }, 
  // Apelăm acțiunea folosind numele fișierului (yahooFinance) și funcția exportată (getCopperPrice)
  internal.yahooFinance.getCopperPrice
);

export default crons;
