import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Generare AI" };

export default function GenerationLayout({ children }: { children: ReactNode }) {
  return children;
}
