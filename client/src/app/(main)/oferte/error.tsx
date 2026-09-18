"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { RotateCcw } from "lucide-react";

export default function OferteError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <h1 className="mb-4 text-xl font-semibold" role="alert">Ofertele nu au putut fi incarcate.</h1>
    <div className="flex flex-wrap items-center gap-4">
      <Button onPress={reset}><RotateCcw className="size-4" />Reincearca</Button>
      <Link href="/oferte" className="text-sm underline">Toate ofertele</Link>
    </div>
  </main>;
}