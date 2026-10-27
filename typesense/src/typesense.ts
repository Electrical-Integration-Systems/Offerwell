import Typesense from "typesense";
import schema from "./schema";
import type { Material } from "./types";

const client = new Typesense.Client({
    nodes: [
        {
            host: process.env.TYPESENSE_HOST ? process.env.TYPESENSE_HOST : "",
            port: Number(process.env.TYPESENSE_PORT || "443"),
            protocol: process.env.TYPESENSE_PROTOCOL || "https"
        }
    ],
    apiKey: process.env.TYPESENSE_API_KEY ? process.env.TYPESENSE_API_KEY : "",
    connectionTimeoutSeconds: 2
});

export async function ensureCollection(collectionName: string) {
    try {
        await client.collections(collectionName).retrieve();
        console.log(`Collection ${collectionName} already exists`);
    } catch (error) {
        if (error instanceof Typesense.Errors.ObjectNotFound) {
            await client.collections().create(schema);
            console.log(`Collection ${collectionName} created`);
        } else {
            throw error;
        }
    }
}

export async function deleteCollection(collectionName: string) {
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

export async function ensureDocuments(collectionName: string, documents: Material[]) {
    try {
        await client.collections(collectionName).documents().import(documents);
        console.log(`Documents imported into collection ${collectionName}`);
    } catch (error) {
        if (error instanceof Typesense.Errors.ImportError) {
            const reasons = new Map<string, number>();
            for (const result of error.importResults) {
                if (!result.success) {
                    reasons.set(result.error, (reasons.get(result.error) ?? 0) + 1);
                }
            }
            throw new Error(`${error.message}\n${[...reasons].map(([reason, count]) => `${count} documents: ${reason}`).join("\n")}`);
        }
        throw error;
    }
}
