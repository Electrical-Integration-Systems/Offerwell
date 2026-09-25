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
