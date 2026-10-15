import { expect, test } from "vitest";
import { getCursorPage } from "./cursor-pagination";

const results = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

test("does not expose a phantom fourth page when the next cursor returns no results", () => {
  const before = getCursorPage(results(30), 3, "CanLoadMore");
  expect(before.pageCount).toBe(3);
  expect(before.items).toEqual(results(30).slice(20));
  expect(before.shouldLoadMore).toBe(true);
  const fetching = getCursorPage(results(30), 3, "LoadingMore");
  expect(fetching.pageCount).toBe(3);
  expect(fetching.loading).toBe(false);
  expect(fetching.loadingNextPage).toBe(true);
  const end = getCursorPage(results(30), 3, "Exhausted");
  expect(end.page).toBe(3);
  expect(end.pageCount).toBe(3);
  expect(end.shouldLoadMore).toBe(false);
});

test("allows navigation beyond three pages and back to the first page", () => {
  expect(getCursorPage(results(40), 4, "CanLoadMore").items).toEqual(results(40).slice(30));
  expect(getCursorPage(results(51), 6, "Exhausted")).toMatchObject({ page: 6, pageCount: 6, items: [51], loading: false });
  expect(getCursorPage(results(51), 1, "Exhausted").items).toEqual(results(10));
});

test("confirms one page ahead without fetching the entire list", () => {
  expect(getCursorPage(results(10), 1, "CanLoadMore").shouldLoadMore).toBe(true);
  expect(getCursorPage(results(20), 1, "CanLoadMore").shouldLoadMore).toBe(false);
  expect(getCursorPage(results(20), 2, "CanLoadMore").shouldLoadMore).toBe(true);
  expect(getCursorPage(results(30), 2, "CanLoadMore").shouldLoadMore).toBe(false);
});

test("waits for partial pages until the cursor is exhausted", () => {
  expect(getCursorPage(results(13), 2, "CanLoadMore")).toMatchObject({ pageCount: 2, loading: true, shouldLoadMore: true });
  expect(getCursorPage(results(13), 2, "LoadingMore")).toMatchObject({ loading: true, shouldLoadMore: false });
  expect(getCursorPage(results(13), 2, "Exhausted")).toMatchObject({ loading: false, items: [11, 12, 13] });
});

test("handles empty cursor batches and exhausted empty lists", () => {
  expect(getCursorPage([], 1, "LoadingFirstPage")).toMatchObject({ page: 1, pageCount: 1, loading: true, shouldLoadMore: false });
  expect(getCursorPage([], 1, "CanLoadMore").shouldLoadMore).toBe(true);
  expect(getCursorPage([], 1, "Exhausted")).toMatchObject({ page: 1, pageCount: 1, items: [], loading: false });
});

test("keeps the selected page in bounds when filtering or deleting results", () => {
  expect(getCursorPage(results(21), 4, "Exhausted")).toMatchObject({ page: 3, pageCount: 3, items: [21] });
  expect(getCursorPage(results(8), 3, "Exhausted")).toMatchObject({ page: 1, pageCount: 1, items: results(8) });
});
