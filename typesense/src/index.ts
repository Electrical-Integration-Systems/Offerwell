import { ensureCollection, deleteCollection, ensureDocuments } from "./typesense";
import { loadMaterialsFromCSV } from "./csv";
import type { Material } from "./types";

async function run() {
  if (!process.env.TYPESENSE_API_KEY || !process.env.TYPESENSE_HOST) {
    console.error("Variabilele de mediu Typesense lipsesc.");
    return;
  }

  try {
    const csvData: Material[] = await loadMaterialsFromCSV("collections/materiale.csv");

    if (csvData.length === 0) return;
    
    await deleteCollection("materiale");
    await ensureCollection("materiale");
    console.log("Începem importul. Typesense va genera automat vectorii...");
    await ensureDocuments("materiale", csvData);

  } catch (err) {
    console.error("Error during execution:", err);
  }
}

run();
