"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";

function subscribe(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

export default function ScrollToTop() {
  const visible = useSyncExternalStore(subscribe, () => window.scrollY > 400, () => false);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Înapoi sus"
      title="Înapoi sus"
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      })}
      className="fixed right-4 bottom-6 z-40 flex size-12 cursor-pointer items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:right-8"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
