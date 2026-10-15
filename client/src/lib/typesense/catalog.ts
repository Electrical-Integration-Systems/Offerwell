import { typesenseClient } from "./admin";
import { CATALOG_PAGE_SIZE, sortCatalog, type CatalogMaterial, type CatalogPage, type CatalogSort, type SortDirection } from "@/lib/catalog";

const fields = "id,descriere,pretAchizitie,pretVanzare,manopera";
let sortingSupport: { expires: number; value: Promise<boolean> } | undefined;
let snapshot: { expires: number; value: Promise<CatalogMaterial[]> } | undefined;

function supportsAlphabeticalSort() {
  if (!sortingSupport || sortingSupport.expires < Date.now()) {
    const value = typesenseClient.collections("materiale").retrieve()
      .then((collection) => collection.fields.some((field) => field.name === "descriere" && field.sort === true))
      .catch((error: unknown) => { sortingSupport = undefined; throw error; });
    sortingSupport = { expires: Date.now() + 60_000, value };
  }
  return sortingSupport.value;
}

// Older collections lack the string sort index. Keep a short-lived, server-only
// snapshot of the public catalog fields so they can still be browsed in order.
// The browser receives only one page; embeddings are never exported here.
function getSnapshot() {
  if (!snapshot || snapshot.expires < Date.now()) {
    const value = typesenseClient.collections<CatalogMaterial>("materiale").documents().export({ include_fields: fields })
      .then((documents) => sortCatalog(documents.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as CatalogMaterial), "descriere", "asc"))
      .catch((error: unknown) => { snapshot = undefined; throw error; });
    snapshot = { expires: Date.now() + 60_000, value };
  }
  return snapshot.value;
}

export async function getCatalogPage(page: number, sort: CatalogSort, direction: SortDirection): Promise<CatalogPage> {
  if (sort === "descriere" && !await supportsAlphabeticalSort()) {
    const materials = await getSnapshot();
    const offset = (page - 1) * CATALOG_PAGE_SIZE;
    const start = direction === "asc" ? offset : Math.max(0, materials.length - offset - CATALOG_PAGE_SIZE);
    const end = direction === "asc" ? offset + CATALOG_PAGE_SIZE : Math.max(0, materials.length - offset);
    const selected = materials.slice(start, end);
    return { materials: direction === "asc" ? selected : selected.reverse(), total: materials.length, page, hasMore: offset + CATALOG_PAGE_SIZE < materials.length };
  }
  const response = await typesenseClient.collections<CatalogMaterial>("materiale").documents().search({
    q: "*", query_by: "descriere", sort_by: `${sort}:${direction},_seq_id:asc`,
    page, per_page: CATALOG_PAGE_SIZE, include_fields: fields,
  });
  return { materials: response.hits?.map((hit) => hit.document) ?? [], total: response.found, page, hasMore: page * CATALOG_PAGE_SIZE < response.found };
}
