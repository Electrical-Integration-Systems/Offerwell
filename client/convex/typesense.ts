import Typesense, { type SearchResponse } from "typesense";
import { type MaterialHit } from "./types";

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

export const textSearch = async(query: string): Promise<SearchResponse<MaterialHit>> => {
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

/**
 * Perform a blend search on the 'materiale' collection using both embedding and description.
 * @param query The search query string.
 * @returns The search results.
 */
export const blendSearch = async (query: string, k: number = 1, distance_threshold: number = 0.8, alpha: number = 0.9): Promise<SearchResponse<MaterialHit>> => {    
    try {
        const searchResults = await typesenseClient
            .collections<MaterialHit>("materiale")
            .documents()
            .search({
                q: query,
                query_by: "embedding,descriere",
                vector_query: `embedding:([], k: ${k}, distance_threshold: ${distance_threshold}, alpha: ${alpha})`,
                per_page: k,
                prefix: false
            });
            
        return searchResults;
        
    } catch (error) {
        console.error("Error performing blend search:", error);
        throw error;
    }
};
