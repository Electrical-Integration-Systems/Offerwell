import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "BNR Rates",
  { hourUTC: 11, minuteUTC: 0 }, 
  // Apelăm acțiunea folosind numele fișierului (bnr) și funcția exportată (getBNRRates)
  internal.bnr.getBNRRates
);

export default crons;
