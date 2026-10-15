"use client";

import Link from "next/link";
import OfertaFlowError from "@/components/oferta-flow-error";
import { getFlowError } from "../../../../convex/oferte/errors";

export default function OferteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <h1 className="mb-4 text-xl font-semibold" role="alert">Ofertele nu au putut fi incarcate.</h1>
    <div className="flex flex-wrap items-center gap-4">
      <OfertaFlowError error={getFlowError(error, "load")} onRetry={retry} />
      <Link href="/oferte" className="text-sm underline">Toate ofertele</Link>
    </div>
  </main>;
}
