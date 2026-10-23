import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Oferte",
    template: "%s | Offerwell",
  },
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return children;
}
