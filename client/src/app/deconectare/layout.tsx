import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Deconectare" };

export default function SignOutLayout({ children }: { children: ReactNode }) {
  return children;
}
