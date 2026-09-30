import fs from "fs";
import csv from "csv-parser";
import type { Material } from "./types";

export function loadMaterialsFromCSV(filePath: string): Promise<Material[]> {
  return new Promise((resolve, reject) => {
    const results: Material[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        results.push({
          descriere: row.descriere,
          pretAchizitie: parseFloat(row.pretAchizitie?.replace(/,/g, "") || "0") || 0,
          pretVanzare: parseFloat(row.pretVanzare?.replace(/,/g, "") || "0") || 0,
          manopera: parseFloat(row.manopera?.replace(/,/g, "") || "0") || 0,
        });
      })
      .on("end", () => {
        console.log(`CSV read complete. Found ${results.length} materials.`);
        resolve(results);
      })
      .on("error", (error) => reject(error));
  });
}
