import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Curs valutar și prețuri metale" };

export default function PricesLayout({ children }: { children: ReactNode }) {
  return children;
}
