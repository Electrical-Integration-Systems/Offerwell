import { query } from "./_generated/server";

export const getCursuriValutare = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("cursuriValutare").collect();
  },
});

export const getPreturiMetale = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("preturiMetale").collect();
  },
});
