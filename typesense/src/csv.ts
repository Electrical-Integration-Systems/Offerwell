import fs from "fs";
import csv from "csv-parser";
import { pipeline } from "node:stream/promises";
import type { Material } from "./types";
import { normalizeMaterialDescription } from "../../client/convex/lib/material_description";

export async function loadMaterialsFromCSV(filePath: string): Promise<Material[]> {
    const results: Material[] = [];
    const requiredHeaders = ["descriere", "pretAchizitie", "pretVanzare", "manopera"];
    const parser = csv({
      mapHeaders: ({ header }) => header.replace(/^\uFEFF/, "").trim() || null,
      strict: true,
    });
    parser.on("headers", (headers: string[]) => {
      const missing = requiredHeaders.filter(header => !headers.includes(header));
      if (missing.length) {
        parser.destroy(new Error(`CSV is missing required columns: ${missing.join(", ")}`));
      }
    });

    await pipeline(fs.createReadStream(filePath), parser, async (rows) => {
      for await (const row of rows) {
        const line = results.length + 2;
        // Some spreadsheet exports contain literal quotes inside CSV-quoted cells.
        const descriere = normalizeMaterialDescription((row.descriere ?? "").trim().replace(/^"+|"+$/g, "").trim());
        if (!descriere) throw new Error(`CSV row ${line}: descriere is empty`);
        const price = (field: string): number => {
          const value = (row[field] ?? "").trim().replace(/^["']+|["']+$/g, "").replace(/,/g, "").trim();
          if (!value) return 0;
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            throw new Error(`CSV row ${line}: invalid ${field} value ${JSON.stringify(row[field])}`);
          }
          return parsed;
        };
        const pretAchizitie = price("pretAchizitie");
        const pretVanzare = price("pretVanzare");
        results.push({
          descriere,
          pretAchizitie,
          pretVanzare: pretVanzare === 0 ? pretAchizitie * 1.25 : pretVanzare,
          manopera: price("manopera"),
        });
      }
    });
    console.log(`CSV read complete. Found ${results.length} materials.`);
    return results;
}
