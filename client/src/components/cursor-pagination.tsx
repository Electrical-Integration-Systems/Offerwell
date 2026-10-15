"use client";

import { useEffect, useState } from "react";
import { Pagination, Spinner } from "@heroui/react";
import { getCursorPage, PAGE_SIZE, type PageStatus } from "@/lib/cursor-pagination";

export { PAGE_SIZE };

export function useCursorPagination<Item>(results: Item[], status: PageStatus, loadMore: (count: number) => void) {
  const [requestedPage, setPage] = useState(1);
  const { shouldLoadMore, ...pagination } = getCursorPage(results, requestedPage, status);

  useEffect(() => {
    if (shouldLoadMore) loadMore(PAGE_SIZE);
  }, [shouldLoadMore, results.length, status, loadMore]);

  return { ...pagination, setPage };
}

export function CursorPagination({ page, pageCount, setPage, loading, loadingNextPage = false, disabled = false }: {
  page: number; pageCount: number; setPage: (page: number) => void; loading: boolean; loadingNextPage?: boolean; disabled?: boolean;
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
    <span role="status" className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
      {(loading || loadingNextPage) && <Spinner size="sm" />}Pagina {page}
      {loadingNextPage && " · Se verifică pagina următoare..."}
    </span>
  </div>;
}
