"use client";

import Link from "next/link";
import { Layers3, Search, Plus, Sparkles } from "lucide-react";
import { Button, Avatar, Tooltip } from "@heroui/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function Header() {
    const user = useQuery(api.auth.currentUser);
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    const nameParts = name?.split(/\s+/);
    const initials = nameParts && nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : (name || email?.split("@")[0] || "").slice(0, 2);

    return (
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
            <Tooltip aria-label="Menu" delay={0}>
                <Button aria-label="Menu" isIconOnly>
                <Avatar aria-label={name || email || "User"}>
                    <Avatar.Fallback>{initials.toUpperCase() || "?"}</Avatar.Fallback>
                </Avatar>
                </Button>
                <Tooltip.Content>
                    <Tooltip.Arrow />
                    <div className="flex flex-col">
                        <Link href="/" className="px-4 py-2 hover:bg-secondary border-border rounded-full text-muted">Profil</Link>
                        <Link href="/" className="px-4 py-2 hover:bg-secondary border-border rounded-full text-muted">Setări</Link>
                        <Link href="/deconectare" className="px-4 py-2 hover:bg-secondary border-border rounded-full">
                            Deconectare
                        </Link>
                    </div>
                </Tooltip.Content>
            </Tooltip>
          </nav>
        </div>
      </header>
    );
}