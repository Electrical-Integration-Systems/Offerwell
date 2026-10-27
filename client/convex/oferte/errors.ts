import { ConvexError } from "convex/values";

const recoveries = {
  STRUCTURE: "structure",
  INVALID_FILE: "file",
  FILE_MISSING: "file",
  LIMIT: "file",
  AUTH: "auth",
  UNAVAILABLE: "offers",
  CONFLICT: "retry",
  ANALYSIS_UNAVAILABLE: "structure",
  SEARCH_UNAVAILABLE: "retry",
  VALIDATION: "validation",
  EXCHANGE_RATE: "rate",
  RETRY: "retry",
} as const;

export type FlowErrorCode = keyof typeof recoveries;
export type FlowStage = "upload" | "analysis" | "extraction" | "matching" | "validation" | "bulkValidation" | "pricing" | "deletion" | "replacement" | "export" | "load";
export type FlowError = { code: FlowErrorCode; message: string; sheetName?: string; recovery: typeof recoveries[FlowErrorCode] };

export function flowError(code: FlowErrorCode, message: string, sheetName?: string) {
  return new ConvexError({ code, message, ...(sheetName === undefined ? {} : { sheetName }) });
}

export function structureError(sheetName?: string) {
  return flowError("STRUCTURE", `Nu au fost identificate materiale${sheetName ? ` în foaia „${sheetName}”` : ""}. Structura identificată a Excelului poate fi greșită. Corectează structura manual: verifică coloana materialelor și primul rând de date.`, sheetName);
}

const fallbackMessages: Record<FlowStage, string> = {
  pricing: "Prețurile de vânzare nu au putut fi actualizate. Verifică multiplicatorul și încearcă din nou.",
  upload: "Fișierul nu a putut fi încărcat. Verifică conexiunea și încearcă din nou.",
  analysis: "Analiza automată nu a putut fi finalizată. Încearcă din nou sau selectează manual structura Excelului.",
  extraction: "Materialele nu au putut fi extrase. Încearcă din nou. Dacă problema persistă, verifică manual structura Excelului.",
  matching: "Căutarea prețurilor nu a putut fi finalizată. Încearcă din nou; fișierul încărcat este păstrat.",
  validation: "Validarea nu a putut fi salvată. Valorile introduse sunt păstrate. Încearcă din nou.",
  bulkValidation: "Validarea multiplă nu a putut fi salvată. Verifică lista actualizată și încearcă din nou.",
  deletion: "Materialul nu a putut fi șters. Verifică lista actualizată și încearcă din nou.",
  replacement: "Materialul asociat nu a putut fi schimbat. Verifică lista actualizată și încearcă din nou.",
  export: "Excelul nu a putut fi generat. Încearcă din nou; materialele validate sunt păstrate.",
  load: "Oferta nu a putut fi încărcată. Verifică conexiunea și încearcă din nou.",
};

export function getFlowError(error: unknown, stage: FlowStage): FlowError {
  if (error instanceof ConvexError && error.data && typeof error.data === "object") {
    const data = error.data as Record<string, unknown>;
    if (typeof data.code === "string" && Object.hasOwn(recoveries, data.code) && typeof data.message === "string") {
      const code = data.code as FlowErrorCode;
      return { code, message: data.message, recovery: recoveries[code], ...(typeof data.sheetName === "string" ? { sheetName: data.sheetName } : {}) };
    }
  }
  return { code: "RETRY", message: fallbackMessages[stage], recovery: "retry" };
}
