/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { summarizeMaterials, type MatchedMaterial } from "./review";

const modules = import.meta.glob("/convex/**/*.ts");
const first: MatchedMaterial = {
  sheetName: "Foaia 1", rand: 2, descriereOriginala: "Cablu", descriereGasita: "Cablu",
  cantitate: 2, unitate: "m", matchScore: 10, matchedTokens: [],
  pretAchizitie: 10, pretVanzare: 15, manopera: 5, validated: false, requiresValidation: true,
};
const second: MatchedMaterial = { ...first, sheetName: "Foaia 2", validated: true };

async function fixture(legacy = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Owner" });
    const otherUserId = await ctx.db.insert("users", { name: "Other" });
    const content = await ctx.storage.store(new Blob(["xlsx"]));
    const materials = [first, second];
    const idGenerare = await ctx.db.insert("oferte", {
      user: userId, revision: 4,
      excelInput: { content, fileName: "input.xlsx" },
      excelOutput: { content, fileName: "output.xlsx", formatVersion: 2 },
      excelMapping: { randIncepereDate: 2, coloanaDescriere: "A", coloanaCantitati: "B", coloanaUnitate: "C", coloanaSfarsitDate: "C", valuta: "EUR" },
      materialeExtrase: materials.map((m) => ({ sheetName: m.sheetName, rand: m.rand, descriere: m.descriereOriginala, cantitate: m.cantitate, unitate: m.unitate })),
      ...(legacy ? { materialePotrivite: materials } : { materialSummary: summarizeMaterials(materials) }),
    });
    if (!legacy) for (const m of materials) await ctx.db.insert("ofertaMateriale", { ...m, oferta: idGenerare, pending: !m.validated });
    return { userId, otherUserId, idGenerare };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|session` });
  return { t, user, ...ids };
}

test.each([false, true])("deletes only the selected sheet row, updates totals and removes stale exports (legacy=%s)", async (legacy) => {
  const { t, user, idGenerare } = await fixture(legacy);
  await user.mutation(api.oferte.mutations.stergeMaterial, { idGenerare, expectedRevision: 4, rand: 2, sheetName: first.sheetName });
  const offer = await t.run((ctx) => ctx.db.get(idGenerare));
  expect(offer!.materialSummary).toEqual({ pricingVersion: 1, materialCount: 1, pendingCount: 0, total: 40 });
  expect(offer!.materialeExtrase?.map((m) => m.sheetName)).toEqual([second.sheetName]);
  expect(offer!.excelOutput).toBeUndefined();
  expect(offer!.revision).toBe(5);
  const rows = await t.run((ctx) => ctx.db.query("ofertaMateriale").collect());
  expect(rows.map((m) => m.sheetName)).toEqual([second.sheetName]);
});

test("deleting the final material keeps the validation screen empty instead of restarting extraction", async () => {
  const { user, idGenerare } = await fixture();
  await user.mutation(api.oferte.mutations.stergeMaterial, { idGenerare, expectedRevision: 4, rand: 2, sheetName: first.sheetName });
  await user.mutation(api.oferte.mutations.stergeMaterial, { idGenerare, expectedRevision: 5, rand: 2, sheetName: second.sheetName });
  const page = await user.query(api.oferte.queries.getOferta, { idGenerare });
  expect(page).toMatchObject({ hasMatched: true, materialsReady: true, materialCount: 0, pendingCount: 0, total: 0, status: "export" });
});

test("rejects stale revisions, missing rows and access by another account without deleting anything", async () => {
  const { t, user, idGenerare, otherUserId } = await fixture();
  const args = { idGenerare, expectedRevision: 4, rand: 2, sheetName: first.sheetName };
  await expect(user.mutation(api.oferte.mutations.stergeMaterial, { ...args, expectedRevision: 3 })).rejects.toThrow();
  await expect(user.mutation(api.oferte.mutations.stergeMaterial, { ...args, sheetName: "Missing" })).rejects.toThrow();
  await expect(t.withIdentity({ subject: `${otherUserId}|session` }).mutation(api.oferte.mutations.stergeMaterial, args)).rejects.toThrow();
  await expect(t.mutation(api.oferte.mutations.stergeMaterial, args)).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.query("ofertaMateriale").collect())).toHaveLength(2);
  expect((await user.query(api.oferte.queries.getOferta, { idGenerare })).revision).toBe(4);
});
