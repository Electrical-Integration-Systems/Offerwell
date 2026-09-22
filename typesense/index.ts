import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import Typesense from "typesense";
import fs from "fs";
import csv from "csv-parser";

const collectionName = "materiale";

type Material = {
  descriere: string;
  pretAchizitie: number;
  pretVanzare: number;
  manopera: number;
};

const schema: CollectionCreateSchema = {
    name: collectionName,
    fields: [
        {'name': 'descriere', 'type': 'string'},
        {'name': 'pretAchizitie', 'type': 'float'},
        {'name': 'pretVanzare', 'type': 'float'},
        {'name': 'manopera', 'type': 'float'},
    ]
}

const client = new Typesense.Client({
    nodes: [
        {
            host: process.env.TYPESENSE_HOST ? process.env.TYPESENSE_HOST : "",
            port: 443,
            protocol: "https"
        }
    ],
    apiKey: process.env.TYPESENSE_API_KEY ? process.env.TYPESENSE_API_KEY : "",
    connectionTimeoutSeconds: 2
});

function loadMaterialsFromCSV(filePath: string): Promise<Material[]> {
    return new Promise((resolve, reject) => {
        const results: Material[] = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                results.push({
                    descriere: row.descriere,
                    pretAchizitie: parseFloat(row.pretAchizitie?.replace(/,/g, '') || '0') || 0,
                    pretVanzare: parseFloat(row.pretVanzare?.replace(/,/g, '') || '0') || 0,
                    manopera: parseFloat(row.manopera?.replace(/,/g, '') || '0') || 0,
                });
            })
            .on('end', () => {
                console.log(`CSV read complete. Found ${results.length} materials.`);
                resolve(results);
            })
            .on('error', (error) => reject(error));
    });
}

async function ensureCollection(collectionName: string) {
    try {
        await client.collections(collectionName).retrieve();
        console.log("Collection already exists");
    } catch (error) {
        if (error instanceof Typesense.Errors.ObjectNotFound) {
            await client.collections().create(schema);
            console.log("Collection created");
        } else {
            throw error;
        }
    }
}

async function deleteCollection(collectionName: string) {
    try {
        await client.collections(collectionName).delete();
        console.log(`Collection ${collectionName} deleted`);
    } catch (error) {
        if (error instanceof Typesense.Errors.ObjectNotFound) {
            console.log(`Collection ${collectionName} does not exist`);
        } else {
            throw error;
        }
    }
}

async function ensureDocuments(collectionName: string, documents: Material[]) {
    try {
        await client.collections(collectionName).documents().import(documents);
        console.log(`Documents imported into collection ${collectionName}`);
    } catch (error) {
        console.error(`Error importing documents into collection ${collectionName}:`, error);
    }
}

async function run() {
    if (!process.env.TYPESENSE_API_KEY || !process.env.TYPESENSE_HOST) {
        console.error("TYPESENSE_API_KEY or TYPESENSE_HOST is not set in the environment variables.");
        return;
    }

    try {
        const csvData = await loadMaterialsFromCSV("collections/materiale.csv");
        
        if (csvData.length === 0) {
            console.warn("No data found in CSV. Aborting import.");
            return;
        }

        await deleteCollection(collectionName);
        await ensureCollection(collectionName);
        await ensureDocuments(collectionName, csvData);
        
    } catch (err) {
        console.error("Error during execution:", err);
    }
}

run();
