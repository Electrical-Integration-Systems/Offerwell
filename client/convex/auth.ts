import { convexAuth, createAccount, retrieveAccount, modifyAccountCredentials, invalidateSessions, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { v } from "convex/values";
import { internalAction, query } from "./_generated/server";

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
