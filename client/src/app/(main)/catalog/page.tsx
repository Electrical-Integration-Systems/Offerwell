import type { Metadata } from "next";
import Catalog from "@/components/catalog";

export const metadata: Metadata = { title: "Catalog materiale" };

export default function CatalogPage() {
  return <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
    <h1 className="text-3xl font-semibold tracking-tight pb-5">Catalog materiale</h1>
    <Catalog />
  </main>;
}
