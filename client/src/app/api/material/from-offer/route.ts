import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { CatalogConflict, saveOfferMaterial } from "@/lib/typesense/offer-catalog";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origine nepermisă." }, { status: 403 });
  const token = await convexAuthNextjsToken();
  if (!token) return Response.json({ error: "Autentificarea este necesară." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Cerere JSON invalidă." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Date invalide." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.idGenerare !== "string" || !data.idGenerare || !Number.isSafeInteger(data.expectedRevision) || (data.expectedRevision as number) < 0
    || !Number.isSafeInteger(data.rand) || (data.rand as number) < 1
    || (data.sheetName !== undefined && typeof data.sheetName !== "string")
    || (data.mode !== "create" && data.mode !== "update")
    || (data.mode === "create" && (typeof data.descriere !== "string" || data.descriere.trim().length < 3 || data.descriere.trim().length > 2000))) {
    return Response.json({ error: "Verifică materialul și descrierea introduse." }, { status: 400 });
  }
  if (!process.env.TYPESENSE_API_KEY) return Response.json({ error: "Salvarea în catalog nu este configurată." }, { status: 503 });
  try {
    // Ownership, revision, validation, and prices come from the authenticated
    // backend. Client-supplied prices and catalog IDs are never trusted.
    const material = await fetchQuery(api.oferte.queries.getCatalogMaterial, {
      idGenerare: data.idGenerare as Id<"oferte">, expectedRevision: data.expectedRevision as number,
      rand: data.rand as number, sheetName: data.sheetName as string | undefined,
    }, { token });
    const source = JSON.stringify([data.idGenerare, data.expectedRevision, data.sheetName, data.rand]);
    const saved = await saveOfferMaterial(material, source, data.mode, data.descriere as string | undefined);
    return Response.json({ id: saved.id, mode: data.mode });
  } catch (error) {
    if (error instanceof CatalogConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof ConvexError && error.data && typeof error.data === "object") {
      const data = error.data as { code?: string; message?: string };
      const status = data.code === "AUTH" ? 401 : data.code === "UNAVAILABLE" ? 403 : data.code === "CONFLICT" ? 409 : 400;
      return Response.json({ error: data.message || "Materialul nu poate fi salvat." }, { status });
    }
    return Response.json({ error: "Catalogul nu a putut fi actualizat. Verifică dacă materialul asociat mai există și încearcă din nou." }, { status: 502 });
  }
}
