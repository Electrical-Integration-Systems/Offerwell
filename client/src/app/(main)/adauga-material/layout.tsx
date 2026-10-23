import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Adaugă material" };

export default function AddMaterialLayout({ children }: { children: ReactNode }) {
  return children;
}
