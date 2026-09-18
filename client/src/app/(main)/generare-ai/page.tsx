"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OfertaFlow from "@/components/oferta-flow";

function GenerationPage() {
  const idOferta = useSearchParams().get("oferta") ?? undefined;
  return <OfertaFlow idOferta={idOferta} />;
}

export default function GenerareAIPage() {
  return <Suspense fallback={<div role="status" className="p-8 text-center">Se incarca...</div>}><GenerationPage /></Suspense>;
}