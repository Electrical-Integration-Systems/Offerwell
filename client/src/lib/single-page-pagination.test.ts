import { expect, test } from "vitest";
import { navigateCursorPage } from "./single-page-pagination";

test("only visits the next page on explicit navigation and stores cursors instead of material rows", () => {
  const first = [null];
  const next = { continueCursor: "after-first", isDone: false };
  expect(navigateCursorPage(first, 1, next)).toBe(first);
  const second = navigateCursorPage(first, 2, next);
  expect(second).toEqual([null, "after-first"]);
  const third = navigateCursorPage(second, 3, { continueCursor: "after-second", isDone: false });
  expect(third).toEqual([null, "after-first", "after-second"]);
  expect(navigateCursorPage(third, 1, { continueCursor: "end", isDone: true })).toEqual([null]);
});

test("returning to an earlier page discards later cursors so subsequent navigation uses the current live boundary", () => {
  const back = navigateCursorPage([null, "old-first", "old-second"], 2, { continueCursor: "end", isDone: true });
  expect(back).toEqual([null, "old-first"]);
  expect(navigateCursorPage(back, 3, { continueCursor: "updated-second", isDone: false }))
    .toEqual([null, "old-first", "updated-second"]);
});

test("blocks navigation while loading, past the last page, and to unknown cursor positions", () => {
  const first = [null];
  expect(navigateCursorPage(first, 2, undefined)).toBe(first);
  const exhausted = { continueCursor: "end", isDone: true };
  expect(navigateCursorPage(first, 2, exhausted)).toBe(first);
  for (const page of [0, -1, 1.5, 3]) {
    expect(navigateCursorPage(first, page, { continueCursor: "next", isDone: false })).toBe(first);
  }
  const stalled = [null, "same"];
  expect(navigateCursorPage(stalled, 3, { continueCursor: "same", isDone: false })).toBe(stalled);
});
