import { convexAuth, createAccount, retrieveAccount, modifyAccountCredentials, invalidateSessions, getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid email address.");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address.");
  }
  return email;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow !== "signIn") {
          throw new Error("Only sign-in is allowed. Contact an administrator for an account.");
        }
        return { email: normalizeEmail(params.email) };
      },
    }),
  ],
});

export const currentUser = query({
  args: {},
  returns: v.union(v.null(), v.object({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return { name: user.name, email: user.email };
  },
});

export const createUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });
    return user._id;
  },
});

export const changePassword = internalAction({
  args: {
    email: v.string(),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (args.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    const { user } = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.oldPassword },
    });
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId: user._id });
    return true;
  },
});

export const currentPasswordAccount = internalQuery({
  args: {},
  returns: v.object({ userId: v.id("users"), sessionId: v.id("authSessions"), accountId: v.string() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) throw new ConvexError("Autentificarea este necesară.");
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId || session.expirationTime <= Date.now()) {
      throw new ConvexError("Sesiunea a expirat. Autentifică-te din nou.");
    }
    const account = await ctx.db.query("authAccounts")
      .withIndex("userIdAndProvider", (index) => index.eq("userId", userId).eq("provider", "password")).unique();
    if (!account) throw new ConvexError("Contul curent nu folosește autentificarea cu parolă.");
    return { userId, sessionId, accountId: account.providerAccountId };
  },
});

export const changeCurrentPassword = action({
  args: { oldPassword: v.string(), newPassword: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const current = await ctx.runQuery(internal.auth.currentPasswordAccount, {});
    if (!args.oldPassword) throw new ConvexError("Introdu parola actuală.");
    if (args.newPassword.length < 8) throw new ConvexError("Parola nouă trebuie să aibă cel puțin 8 caractere.");
    if (args.newPassword === args.oldPassword) throw new ConvexError("Alege o parolă diferită de cea actuală.");
    let verified;
    try {
      verified = await retrieveAccount(ctx, { provider: "password", account: { id: current.accountId, secret: args.oldPassword } });
    } catch (error) {
      if (error instanceof Error && error.message === "InvalidSecret") throw new ConvexError("Parola actuală este incorectă.");
      if (error instanceof Error && error.message === "TooManyFailedAttempts") throw new ConvexError("Prea multe încercări. Așteaptă puțin înainte de a încerca din nou.");
      throw new ConvexError("Parola actuală nu a putut fi verificată. Încearcă din nou.");
    }
    if (verified.user._id !== current.userId) throw new ConvexError("Contul curent nu a putut fi verificat.");
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: current.accountId, secret: args.newPassword } });
    await invalidateSessions(ctx, { userId: current.userId, except: [current.sessionId] });
    return true;
  },
});

export const deleteUserById = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.userId);
    return true;
  },
});

export const deleteAccount = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    
    // Verify credentials before deletion
    const { user } = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
    });
    
    // Invalidate all sessions for this user
    await invalidateSessions(ctx, { userId: user._id });
    
    // Delete the user document from the database via mutation
    await ctx.runMutation(internal.auth.deleteUserById, { userId: user._id });
    
    return true;
  },
});
