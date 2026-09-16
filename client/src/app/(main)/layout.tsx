import type { Metadata } from "next";
import Link from "next/link";
import { Layers3, Search, Plus, Sparkles } from "lucide-react";
import { Button } from "@heroui/react";

export const metadata: Metadata = {
  title: "Offerwell",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-background text-foreground [font-family:var(--font-geist-sans)]">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex flex-row items-between max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href="/" className="flex flex-row gap-2 text-xl font-semibold text-foreground no-underline">
            <Layers3 className="size-7 text-accent" aria-hidden="true" />
            Offerwell
          </Link>
          <nav aria-label="Navigare principală" className="flex flex-wrap items-center gap-10 text-sm">
            <Link href="/" className="flex flex-row gap-2"><Search className="size-4" aria-hidden="true" />Materiale</Link>
            <Link href="/adauga-material" className="flex flex-row gap-2"><Plus className="size-4" aria-hidden="true" />Adaugă material</Link>
            <Link href="/generare-ai" className="flex flex-row gap-2">
              <Button><Sparkles className="size-4" aria-hidden="true" />Generare AI</Button>
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
