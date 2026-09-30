import Typesense from "typesense";

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.NEXT_PUBLIC_TYPESENSE_HOST || "typesense.bmseis.software",
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_KEY || "",
  connectionTimeoutSeconds: 2,
});

/**
 * A reusable function to query any collection with pagination.
 * @param collectionName The name of the collection (e.g., 'materiale')
 * @param searchQuery The text the user is searching for
 * @param queryBy A comma-separated string of fields to search inside (e.g., 'descriere')
 * @param page The page number (1-indexed)
 * @param perPage Number of results per page
 */
export async function searchTypesense<T extends object>(
  collectionName: string,
  searchQuery: string,
  queryBy: string,
  page: number = 1,
  perPage: number = 100
): Promise<{ results: (T & { matchedWords?: string[] })[]; total: number; page: number; perPage: number }> {
    const searchParameters = {
      q: searchQuery,
      query_by: queryBy,
      page: page,
      per_page: perPage,
    };

    const results = await typesenseClient
      .collections<T>(collectionName)
      .documents()
      .search(searchParameters);

    return {
      results: (results.hits || []).map((hit) => {
        const doc = { ...hit.document };
        // Extract matched tokens from highlights
        if (hit.highlights && hit.highlights.length > 0) {
          const matchedTokens = hit.highlights[0].matched_tokens || [];
          console.log("Extracted matched_tokens:", matchedTokens);
          if (matchedTokens.length > 0) {
            (doc as any).matchedWords = matchedTokens;
          }
        }
        return doc as T & { matchedWords?: string[] };
      }),
      total: results.found || 0,
      page,
      perPage,
    };
}

export async function getNumarMateriale(): Promise<number> {
    try {
      const results = await typesenseClient
        .collections("materiale")
        .documents()
        .search({
          q: "*",
          query_by: "descriere",
          per_page: 1
        });

      return results.found || 0;
    } catch (error) {
      console.error("Error fetching material count:", error);
      return 0;
    }
}

export async function vectorSearchTypesense<T extends object>(
  collectionName: string,
  embedding: number[],
  vectorField: string = "embedding",
  page: number = 1,
  perPage: number = 100
): Promise<{ results: (T & { distance?: number })[]; total: number; page: number; perPage: number }> {
    
    try {
      console.log("Vector search params:", { collectionName, embeddingLength: embedding.length, vectorField });
      
      // Typesense limits per_page to max 250
      const maxPerPage = Math.min(250, perPage);
      
      const vectorQuery = `${vectorField}:([${embedding.join(",")}], k:250)`;
      console.log("Vector query preview:", vectorQuery.substring(0, 100) + "...");
      
      const searchRequests = {
        searches: [
          {
            collection: collectionName,
            q: "*",
            vector_query: vectorQuery,
            page: page,
            per_page: maxPerPage
          }
        ]
      };

      const response = await typesenseClient.multiSearch.perform(searchRequests, {});
      console.log("Typesense response:", response);
      
      const results: any = response.results[0];
      
      if (!results) {
        console.error("No results in response:", response);
        return { results: [], total: 0, page, perPage };
      }

      if (results.error) {
        console.error("Typesense error:", results.error);
        return { results: [], total: 0, page, perPage };
      }
      
      console.log("Search results found:", results.found, "hits:", results.hits?.length);
      
      const allHits = results.hits || [];

      return {
        results: allHits.map((hit: any) => {
          const doc = { ...hit.document };
          const vectorDistance = (hit as any).vector_distance;
          if (vectorDistance !== undefined) {
            (doc as any).distance = vectorDistance;
          }
          return doc as T & { distance?: number };
        }),
        total: results.found || 0,
        page,
        perPage
      };
    } catch (error) {
      console.error("Vector search error:", error);
      return { results: [], total: 0, page, perPage };
    }
}

export async function hybridSearchTypesense<T extends object>(
  collectionName: string,
  searchQuery: string, // <-- ADĂUGAT: Textul real pentru componenta hibridă
  embedding: number[],
  alpha: number,
  vectorField: string = "embedding",
  page: number = 1,
  perPage: number = 100
): Promise<{ results: (T & { distance?: number })[]; total: number; page: number; perPage: number }> {
    
    try {
      const maxPerPage = Math.min(250, perPage);
      
      // Adăugăm `distance_threshold`. 
      // La Nomic-Embed, distanța variază între 0 (perfect) și 2 (opus).
      // Un threshold de 0.8 taie rezultatele care nu au nicio legătură semantică.
      // Alpha trebuie să fie între 0 și 1 (convertim din slider 0-100)
      const normalizedAlpha = alpha / 100;
      const vectorQuery = `${vectorField}:([${embedding.join(",")}], k:${maxPerPage}, distance_threshold: 0.8, alpha: ${normalizedAlpha})`;
      
      const searchRequests = {
        searches: [
          {
            collection: collectionName,
            q: searchQuery, // <-- Trimitem cuvântul (ex: "țeavă cupru"), nu "*"
            query_by: "descriere", // <-- Câmpul în care face text search
            vector_query: vectorQuery,
            page: page,
            per_page: maxPerPage
          }
        ]
      };

      const response = await typesenseClient.multiSearch.perform(searchRequests, {});
      const results: any = response.results[0];
      
      if (!results || results.error) {
        return { results: [], total: 0, page, perPage };
      }
      
      return {
        results: (results.hits || []).map((hit: any) => {
          const doc = { ...hit.document };
          
          // Extragem distanța vectorială dacă există
          if (hit.vector_distance !== undefined) {
            (doc as any).distance = hit.vector_distance;
          }
          // Extragem evidențierile textului (highlights) pentru UI
          if (hit.highlights && hit.highlights.length > 0) {
            const matchedTokens = hit.highlights[0].matched_tokens || [];
            if (matchedTokens.length > 0) {
              (doc as any).matchedWords = matchedTokens;
            }
          }
          
          return doc as T & { distance?: number; matchedWords?: string[] };
        }),
        total: results.found || 0,
        page,
        perPage
      };
    } catch (error) {
      console.error("Vector search error:", error);
      return { results: [], total: 0, page, perPage };
    }
}
