import Typesense from "typesense";
import type { MaterialHit } from "@/types";

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.NEXT_PUBLIC_TYPESENSE_HOST || "typesense.bmseis.software",
      port: Number(process.env.NEXT_PUBLIC_TYPESENSE_PORT || "443"),
      protocol: process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || "https",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "",
  // Writes can generate embeddings, especially slowly on a cold local CPU model.
  connectionTimeoutSeconds: 30,
});

/**
 * Add a new material to the 'materiale' collection.
 * @param material The material document with descriere, pretAchizitie, pretVanzare, manopera
 * @returns The created document with id
 */
export async function adaugaMaterial(material: MaterialHit) {
  return typesenseClient.collections<MaterialHit>("materiale").documents().create(material);
}

export async function importaMateriale(materials: MaterialHit[]) {
  try {
    return await typesenseClient.collections<MaterialHit>("materiale").documents().import(materials, { action: "create" });
  } catch (error) {
    // The SDK throws even when only some rows fail; preserve every row's result.
    if (error instanceof Typesense.Errors.ImportError) return error.importResults;
    throw error;
  }
}

/**
 * Update an existing material in the 'materiale' collection.
 * @param id The document ID
 * @param material The material data to update
 * @returns The updated document
 */
export async function editeazaMaterial(id: string, material: MaterialHit) {
  return typesenseClient.collections<MaterialHit>("materiale").documents(id).update(material);
}

/**
 * Delete a material from the 'materiale' collection.
 * @param id The document ID
 * @returns The deleted document
 */
export async function stergeMaterial(id: string) {
  return typesenseClient.collections<MaterialHit>("materiale").documents(id).delete();
}
