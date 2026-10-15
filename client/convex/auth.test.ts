/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import { Scrypt } from "lucia";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("/convex/**/*.ts");
const oldPassword = "Old-Test-Password";
const newPassword = "New-Test-Password";
const hash = new Scrypt().hash(oldPassword);

async function fixture() {
  const t = convexTest(schema, modules);
  const secret = await hash;
  const ids = await t.run(async (ctx) => {
    // The profile email deliberately differs from the password account ID.
    const userId = await ctx.db.insert("users", { email: "profile@example.com" });
    const accountId = await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: "login@example.com", secret });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3600000 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3600000 });
    const currentToken = await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 3600000 });
    const otherToken = await ctx.db.insert("authRefreshTokens", { sessionId: otherSessionId, expirationTime: Date.now() + 3600000 });
    const otherUserId = await ctx.db.insert("users", { email: "other@example.com" });
    const otherAccountId = await ctx.db.insert("authAccounts", { userId: otherUserId, provider: "password", providerAccountId: "other@example.com", secret });
    return { userId, accountId, sessionId, otherSessionId, currentToken, otherToken, otherAccountId };
  });
  return { t, ...ids, user: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

test("changes only the current user's password, keeps their session and revokes other sessions", async () => {
  const { t, user, accountId, otherAccountId, sessionId, otherSessionId, currentToken, otherToken } = await fixture();
  expect(await user.action(api.auth.changeCurrentPassword, { oldPassword, newPassword })).toBe(true);
  const state = await t.run(async (ctx) => ({
    account: await ctx.db.get(accountId), otherAccount: await ctx.db.get(otherAccountId),
    session: await ctx.db.get(sessionId), otherSession: await ctx.db.get(otherSessionId),
    currentToken: await ctx.db.get(currentToken), otherToken: await ctx.db.get(otherToken),
  }));
  expect(await new Scrypt().verify(state.account!.secret!, newPassword)).toBe(true);
  expect(await new Scrypt().verify(state.account!.secret!, oldPassword)).toBe(false);
  expect(state.otherAccount!.secret).toBe(await hash);
  expect(state.session).not.toBeNull();
  expect(state.currentToken).not.toBeNull();
  expect(state.otherSession).toBeNull();
  expect(state.otherToken).toBeNull();
});

test("does not change credentials or sessions when the current password is wrong", async () => {
  const { t, user, accountId, otherSessionId } = await fixture();
  await expect(user.action(api.auth.changeCurrentPassword, { oldPassword: "wrong-password", newPassword })).rejects.toThrow("incorectă");
  expect((await t.run((ctx) => ctx.db.get(accountId)))!.secret).toBe(await hash);
  expect(await t.run((ctx) => ctx.db.get(otherSessionId))).not.toBeNull();
});

test.each(["short", oldPassword])("rejects an invalid new password (%s)", async (password) => {
  const { t, user, accountId } = await fixture();
  await expect(user.action(api.auth.changeCurrentPassword, { oldPassword, newPassword: password })).rejects.toThrow();
  expect((await t.run((ctx) => ctx.db.get(accountId)))!.secret).toBe(await hash);
});

test("requires authentication and an active session", async () => {
  const { t, user, sessionId, accountId } = await fixture();
  await expect(t.action(api.auth.changeCurrentPassword, { oldPassword, newPassword })).rejects.toThrow("Autentificarea");
  await t.run((ctx) => ctx.db.patch(sessionId, { expirationTime: Date.now() - 1000 }));
  await expect(user.action(api.auth.changeCurrentPassword, { oldPassword, newPassword })).rejects.toThrow("expirat");
  expect((await t.run((ctx) => ctx.db.get(accountId)))!.secret).toBe(await hash);
});

test("does not trust a session belonging to a different user", async () => {
  const { t, user, sessionId, accountId } = await fixture();
  const someoneElse = await t.run((ctx) => ctx.db.insert("users", { email: "third@example.com" }));
  await t.run((ctx) => ctx.db.patch(sessionId, { userId: someoneElse }));
  await expect(user.action(api.auth.changeCurrentPassword, { oldPassword, newPassword })).rejects.toThrow("expirat");
  expect((await t.run((ctx) => ctx.db.get(accountId)))!.secret).toBe(await hash);
});
