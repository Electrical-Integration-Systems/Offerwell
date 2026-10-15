import type { Material } from "@/types";

export const CATALOG_PAGE_SIZE = 50;
export const catalogColumns = [
  { key: "descriere", label: "Material" },
  { key: "pretAchizitie", label: "Preț achiziție" },
  { key: "pretVanzare", label: "Preț vânzare" },
  { key: "manopera", label: "Manoperă" },
] as const;

export type CatalogSort = typeof catalogColumns[number]["key"];
export type SortDirection = "asc" | "desc";
export type CatalogMaterial = Material & { id: string };
export type CatalogPage = { materials: CatalogMaterial[]; total: number; page: number; hasMore: boolean };

export function isCatalogSort(value: string): value is CatalogSort {
  return catalogColumns.some((column) => column.key === value);
}

const alphabet = new Intl.Collator("ro", { sensitivity: "base", numeric: true });

export function sortCatalog(materials: CatalogMaterial[], sort: CatalogSort, direction: SortDirection) {
  return [...materials].sort((first, second) => {
    const difference = sort === "descriere" ? alphabet.compare(first.descriere, second.descriere) : first[sort] - second[sort];
    const ordered = difference || alphabet.compare(first.descriere, second.descriere) || first.id.localeCompare(second.id);
    return direction === "asc" ? ordered : -ordered;
  });
}
