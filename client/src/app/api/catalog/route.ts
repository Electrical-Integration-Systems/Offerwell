import { getCatalogPage } from "@/lib/typesense/catalog";
import { isCatalogSort } from "@/lib/catalog";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawPage = params.get("page") ?? "1";
  const page = Number(rawPage);
  const sort = params.get("sort") ?? "descriere";
  const direction = params.get("direction") ?? "asc";
  if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !isCatalogSort(sort) || (direction !== "asc" && direction !== "desc")) {
    return Response.json({ error: "Paginarea sau sortarea catalogului este invalidă." }, { status: 400 });
  }
  if (!process.env.TYPESENSE_API_KEY) return Response.json({ error: "Catalogul nu este disponibil momentan." }, { status: 503 });
  try {
    return Response.json(await getCatalogPage(page, sort, direction), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Materialele nu au putut fi încărcate. Încearcă din nou." }, { status: 502 });
  }
}
