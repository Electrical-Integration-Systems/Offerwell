export type CursorPage = { continueCursor: string; isDone: boolean };

// Keep only the cursors needed to return to earlier pages, never their rows.
export function navigateCursorPage(cursors: (string | null)[], requestedPage: number, result: CursorPage | undefined) {
  const currentPage = cursors.length;
  if (!result || !Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > currentPage + 1) return cursors;
  if (requestedPage <= currentPage) return requestedPage === currentPage ? cursors : cursors.slice(0, requestedPage);
  if (result.isDone || result.continueCursor === cursors[currentPage - 1]) return cursors;
  return [...cursors, result.continueCursor];
}
