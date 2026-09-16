import { adaugaMaterial } from "@/lib/typesense/admin";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origine nepermisa." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cererea trebuie sa contina JSON valid." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Datele materialului sunt invalide." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  if (typeof data.descriere !== "string" || data.descriere.trim().length < 3 || data.descriere.trim().length > 500) {
    errors.descriere = "Descrierea trebuie sa aiba intre 3 si 500 de caractere.";
  }
  for (const field of ["pretAchizitie", "pretVanzare", "manopera"] as const) {
    const value = data[field];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2147483647) {
      errors[field] = "Introduceti un numar intreg intre 0 si 2147483647.";
    }
  }
  if (Object.keys(errors).length > 0) {
    return Response.json({ error: "Verificati campurile formularului.", errors }, { status: 400 });
  }

  const apiKey = process.env.TYPESENSE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Salvarea materialelor nu este configurata." }, { status: 503 });
  }

  const material = {
    descriere: (data.descriere as string).trim(),
    pretAchizitie: data.pretAchizitie as number,
    pretVanzare: data.pretVanzare as number,
    manopera: data.manopera as number,
  };

  try {
    const document = await adaugaMaterial(material);
    return Response.json({ material: document }, { status: 201 });
  } catch {
    return Response.json({ error: "Materialul nu a putut fi salvat. Incercati din nou." }, { status: 502 });
  }
}