"use client";

import { useEffect, useState } from "react";
import { Pagination, Spinner } from "@heroui/react";

export const PAGE_SIZE = 10;
type PageStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

export function useCursorPagination<Item>(results: Item[], status: PageStatus, loadMore: (count: number) => void, maxPagesToKeep = 3) {
  const [requestedPage, setPage] = useState(1);
  
  // Keep a sliding window to avoid memory bloat
  const maxItemsToKeep = PAGE_SIZE * maxPagesToKeep;
  const windowedResults = results.slice(0, maxItemsToKeep);
  
  const loadedPages = Math.ceil(windowedResults.length / PAGE_SIZE);
  const pageCount = Math.max(1, loadedPages + (status === "CanLoadMore" || status === "LoadingMore" ? 1 : 0));
  const page = Math.min(requestedPage, pageCount);
  
  useEffect(() => {
    if (status === "CanLoadMore" && windowedResults.length < page * PAGE_SIZE) loadMore(PAGE_SIZE);
  }, [page, windowedResults.length, status, loadMore]);
  
  const loading = status === "LoadingFirstPage" || status === "LoadingMore"
    || (status === "CanLoadMore" && windowedResults.length < page * PAGE_SIZE);
  
  return { page, pageCount, setPage, loading, items: windowedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export function CursorPagination({ page, pageCount, setPage, loading, disabled = false }: {
  page: number; pageCount: number; setPage: (page: number) => void; loading: boolean; disabled?: boolean;
}) {
  const first = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pages = Array.from({ length: Math.min(3, pageCount) }, (_, index) => first + index);
  return <div className="mt-5 flex flex-col items-center gap-2">
    <Pagination aria-label="Paginare" className="justify-center">
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous aria-label="Pagina anterioara" isDisabled={disabled || loading || page === 1} onPress={() => setPage(page - 1)}>
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {pages.map((number) => <Pagination.Item key={number}>
          <Pagination.Link aria-label={`Pagina ${number}`} isActive={number === page} isDisabled={disabled || loading} onPress={() => setPage(number)}>{number}</Pagination.Link>
        </Pagination.Item>)}
        <Pagination.Item>
          <Pagination.Next aria-label="Pagina urmatoare" isDisabled={disabled || loading || page === pageCount} onPress={() => setPage(page + 1)}>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
    <span role="status" className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">{loading && <Spinner size="sm" />}Pagina {page}</span>
  </div>;
}