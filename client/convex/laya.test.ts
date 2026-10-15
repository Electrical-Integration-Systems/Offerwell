import { expect, test, vi } from "vitest";
import { alegePret } from "./laya";
import { NO_MATERIAL_MATCH } from "./oferte/matching";

const { systemOne } = vi.hoisted(() => ({ systemOne: vi.fn() }));
vi.mock("@typesafe-ai/sdk", async (importOriginal) => ({
  ...await importOriginal<typeof import("@typesafe-ai/sdk")>(),
  TypeSafeClient: class { systemOne = systemOne; },
}));

test("Laya receives an explicit no-match option alongside the catalog candidates", async () => {
  systemOne.mockResolvedValue({ answers: { price: { choice: NO_MATERIAL_MATCH } } });
  const response = await alegePret("Robinet", [{ descriere: "Cablu", pretAchizitie: 10, pretVanzare: 15, manopera: 2 }]);
  const request = systemOne.mock.calls.at(-1)![0];
  expect(request.state.material).toBe("Robinet");
  expect(request.questions.price.type).toBe("choice");
  expect(request.questions.price.criteria).toMatchObject({
    Cablu: expect.stringContaining("pretAchizitie=10"),
    [NO_MATERIAL_MATCH]: expect.stringContaining("Niciun material nu se potrivește"),
  });
  expect(request.questions.price.instructions).toContain(NO_MATERIAL_MATCH);
  expect(request.questions.price.instructions).toContain("Nu forța o potrivire");
  expect(response.answers.price.choice).toBe(NO_MATERIAL_MATCH);
});
