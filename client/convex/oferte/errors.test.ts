import { expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { flowError, getFlowError, structureError, type FlowStage } from "./errors";

test("empty extraction gives an actionable structure error with its sheet", () => {
  const error = getFlowError(structureError("Materiale"), "extraction");
  expect(error.recovery).toBe("structure");
  expect(error.sheetName).toBe("Materiale");
  expect(error.message).toContain("Structura identificată a Excelului poate fi greșită");
  expect(error.message).toContain("Corectează structura manual");
  expect(error.message).not.toContain("2000");
});

test.each([
  ["LIMIT", "file"], ["INVALID_FILE", "file"], ["FILE_MISSING", "file"],
  ["AUTH", "auth"], ["UNAVAILABLE", "offers"], ["CONFLICT", "retry"],
  ["ANALYSIS_UNAVAILABLE", "structure"], ["SEARCH_UNAVAILABLE", "retry"],
  ["VALIDATION", "validation"], ["EXCHANGE_RATE", "rate"],
] as const)("maps %s to the appropriate recovery", (code, recovery) => {
  expect(getFlowError(flowError(code, "Mesaj pentru utilizator"), "analysis")).toMatchObject({ code, recovery, message: "Mesaj pentru utilizator" });
});

test.each<FlowStage>(["upload", "analysis", "extraction", "matching", "validation", "bulkValidation", "deletion", "replacement", "export", "load"])("unknown %s failures do not expose internals or imply bad structure", (stage) => {
  for (const raw of [new Error("GROQ_API_KEY / stack / secret"), new ConvexError("Request failed / stack"), null, { data: { code: "STRUCTURE", message: "untrusted" } }]) {
    const error = getFlowError(raw, stage);
    expect(error.recovery).toBe("retry");
    expect(error.message).not.toMatch(/secret|stack|Request failed|untrusted/);
  }
});

test("unrecognized application errors fall back safely", () => {
  expect(getFlowError(new ConvexError({ code: "toString", message: "internal" }), "export").code).toBe("RETRY");
  expect(getFlowError(new ConvexError({ code: "STRUCTURE", message: 42 }), "analysis").code).toBe("RETRY");
});
