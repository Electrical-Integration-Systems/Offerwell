export const PAGE_SIZE = 10;
export type PageStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

export function getCursorPage<Item>(results: Item[], requestedPage: number, status: PageStatus) {
  // A cursor that can advance does not guarantee another nonempty page.
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  const items = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const waitingForCurrentPage = status !== "Exhausted" && items.length < PAGE_SIZE;

  return {
    page,
    pageCount,
    items,
    loading: status === "LoadingFirstPage" || waitingForCurrentPage,
    // Fill the current page and confirm one page ahead before showing its button.
    shouldLoadMore: status === "CanLoadMore" && results.length < (page + 1) * PAGE_SIZE,
    loadingNextPage: status === "LoadingMore" && !waitingForCurrentPage,
  };
}
