"use client";

import OfertaFlowError from "@/components/oferta-flow-error";
import { getFlowError } from "../../../../convex/oferte/errors";
import Link from "next/link";

export default function GenerationError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <h1 className="text-xl font-semibold">Oferta nu a putut fi încărcată</h1>
    <OfertaFlowError error={getFlowError(error, "load")} onRetry={retry} />
    <Link href="/oferte" className="text-sm underline">Toate ofertele</Link>
  </main>;
}
