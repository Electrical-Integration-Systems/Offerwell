import { MAX_MATERIAL_IMPORT_BYTES, parseMaterialImport } from "@/lib/material-import";
import { importaMateriale } from "@/lib/typesense/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origine nepermisă." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length")) > MAX_MATERIAL_IMPORT_BYTES + 65536) {
    return Response.json({ error: "Fișierul poate avea maximum 10 MB." }, { status: 413 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Fișierul nu a putut fi citit." }, { status: 400 });
  }
  if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name) || !file.size) {
    return Response.json({ error: "Selectează un fișier CSV sau XLSX valid." }, { status: 400 });
  }
  if (file.size > MAX_MATERIAL_IMPORT_BYTES) {
    return Response.json({ error: "Fișierul poate avea maximum 10 MB." }, { status: 413 });
  }
  let entries;
  try {
    entries = parseMaterialImport(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Datele sunt invalide." }, { status: 400 });
  }
  if (!process.env.TYPESENSE_API_KEY) {
    return Response.json({ error: "Importul materialelor nu este configurat." }, { status: 503 });
  }
  try {
    const results = await importaMateriale(entries.map(({ material }) => material));
    const imported = results.filter((result) => result.success).length;
    const failedRows = entries.flatMap((entry, index) => results[index]?.success ? [] : [entry.row]);
    return Response.json({ imported, total: entries.length, failedRows }, { status: failedRows.length ? 207 : 201 });
  } catch {
    return Response.json({
      error: "Conexiunea cu catalogul a eșuat. Unele materiale pot fi deja salvate; verifică catalogul înainte de a repeta importul.",
    }, { status: 502 });
  }
}
