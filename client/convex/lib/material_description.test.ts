import { expect, test } from "vitest";
import { normalizeMaterialDescription } from "./material_description";
import { calculateMatchQuality, inferMatchedTokens, isExactMatch, normalizeMaterial, type MatchedMaterial } from "../oferte/review";

test.each([
  ["Tub metalic 20mm", "Tub metalic 20"],
  ["Cablu 3x2,5mmp", "Cablu 3x2,5"],
  ["Cablu 3×2,5 mm²", "Cablu 3x2,5"],
  ["Cablu 3 x 2,5 MM^2", "Cablu 3x2,5"],
  ["Cablu 3 x 2,5 mm2", "Cablu 3x2,5"],
  ["Platbandă 40mmx4mm", "Platbandă 40x4"],
  ["Platbandă 40 x 4 mm", "Platbandă 40x4"],
  ["Cutie 20 cm x 30 cm x 40cm", "Cutie 20x30x40"],
  ["Beton 2,5 mc", "Beton 2,5"],
  ["Suprafață 12m², volum 3m³", "Suprafață 12, volum 3"],
  ["Cablu (mmp) 4x16", "Cablu 4x16"],
  ["Tub 2m, lungime 10 ml", "Tub 2, lungime 10"],
  ["  Cablu\u00a03x2,5\u00a0mmp\n", "Cablu 3x2,5"],
  ["Conector MMCX, cablu N2XH 230V 16A 50Hz IP65 M20 M2", "Conector MMCX, cablu N2XH 230V 16A 50Hz IP65 M20 M2"],
  ["mm mmp", ""],
  ["", ""],
])("normalizes %j without deleting measurement numbers", (input, expected) => {
  expect(normalizeMaterialDescription(input)).toBe(expected);
  expect(normalizeMaterialDescription(expected)).toBe(expected);
});

test("matching quality ignores units while distinct dimensions remain distinct", () => {
  const original = "Cablu 3×2,5 mm²";
  const reference = "Cablu 3x2,5mmp";
  const tokens = inferMatchedTokens(original, reference);
  expect(calculateMatchQuality(original, tokens.length, tokens)).toBe(10);
  expect(isExactMatch(original, reference)).toBe(true);
  expect(isExactMatch(original, "Cablu 3x1,5mmp")).toBe(false);
  expect(isExactMatch("mm", "mmp")).toBe(false);
});

test("normalizing stored match results keeps original descriptions and units for validation", () => {
  const material: MatchedMaterial = {
    rand: 4, descriereOriginala: "Cablu 3×2,5 mm²", descriereGasita: "Cablu 3x2,5", cantitate: 15, unitate: "m",
    matchScore: 1, pretAchizitie: 2, pretVanzare: 3, manopera: 1,
  };
  expect(normalizeMaterial(material)).toMatchObject({ descriereOriginala: "Cablu 3×2,5 mm²", descriereGasita: "Cablu 3x2,5", unitate: "m", cantitate: 15, matchScore: 10 });
});
