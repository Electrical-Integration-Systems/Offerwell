import Typesense from "typesense";
import { type MaterialHit } from "../types";

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: "typesense.bmseis.software",
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_SEARCH_KEY!,
  connectionTimeoutSeconds: 2,
});

export const textSearch = async(query: string) => {
    try {
        const searchResults = await typesenseClient
            .collections<MaterialHit>("materiale")
            .documents()
            .search({
                q: query,
                query_by: "descriere",
                per_page: 1, 
            });
        return searchResults;
    } catch (error) {
        console.error("Error performing text search:", error);
        throw error;
    }
};

export const blendSearch = async (query: string) => {    
    try {
        const searchResults = await typesenseClient
            .collections<MaterialHit>("materiale")
            .documents()
            .search({
                q: query,
                query_by: "embedding,descriere",
                vector_query: `embedding:([], k:1, distance_threshold: 0.8, alpha: 0.9)`,
                per_page: 1,
                prefix: false
            });
            
        return searchResults;
        
    } catch (error) {
        console.error("Error performing blend search:", error);
        throw error;
    }
};
