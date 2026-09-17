import { query } from "../_generated/server";

export const getGenerari = query(async (ctx) => {
  return ctx.db.query("generari").collect();
});
