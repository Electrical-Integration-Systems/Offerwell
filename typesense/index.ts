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
  embedding: number[];
};

const schema: CollectionCreateSchema = {
    name: collectionName,
    fields: [
        {'name': 'descriere', 'type': 'string'},
        {'name': 'pretAchizitie', 'type': 'float'},
        {'name': 'pretVanzare', 'type': 'float'},
        {'name': 'manopera', 'type': 'float'},
        {'name': 'embedding', 'type': 'float[]', 'num_dim': 768}
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
                    embedding: [],
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

async function generateVPSEmbedding(text: string): Promise<number[]> {
    const baseURL = process.env.OPEN_WEBUI_BASE_URL || "";
    const apiKey = process.env.OPEN_WEBUI_API_KEY || "";
    
    // Folosim endpoint-ul de ollama expus de Open WebUI
    const endpoint = `${baseURL}/ollama/api/embed`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "nomic-embed-text:latest",
            input: text
        })
    });

    if (!response.ok) {
        throw new Error(`Eroare generare vector (status ${response.status}): ${await response.text()}`);
    }

    const data: any = await response.json();
    
    if (!data.embeddings || data.embeddings.length === 0) {
         throw new Error(`Modelul nu a returnat niciun vector pentru: ${text}`);
    }

    return data.embeddings[0]; 
}

async function run() {
    if (!process.env.TYPESENSE_API_KEY || !process.env.TYPESENSE_HOST) {
        console.error("TYPESENSE_API_KEY or TYPESENSE_HOST is not set in the environment variables.");
        return;
    }

    try {
        const csvData: Material[] = await loadMaterialsFromCSV("collections/materiale.csv");
        
        if (csvData.length === 0) {
            console.warn("No data found in CSV. Aborting import.");
            return;
        }

        console.log(`Generăm vectorii pentru ${csvData.length} materiale...`);
        
        // 1. Generăm toți vectorii
        for (const item of csvData) {
            item.embedding = await generateVPSEmbedding(item.descriere);
        }

        fs.writeFileSync('collections/materiale.json', JSON.stringify(csvData, null, 2));

        await deleteCollection(collectionName);
        await ensureCollection(collectionName);
        await ensureDocuments(collectionName, csvData);
        
    } catch (err) {
        console.error("Error during execution:", err);
    }
}

run();
