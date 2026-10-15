"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { CircleAlert } from "lucide-react";
import type { FlowError } from "../../convex/oferte/errors";

export default function OfertaFlowError({ error, disabled, onRetry, onStructure, onNewFile }: {
  error: FlowError;
  disabled?: boolean;
  onRetry?: () => void;
  onStructure?: () => void;
  onNewFile?: () => void;
}) {
  return <div role="alert" className="my-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
    <p className="flex items-start gap-2 text-sm leading-relaxed"><CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />{error.message}</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {onRetry && (error.recovery === "retry" || error.code === "ANALYSIS_UNAVAILABLE") && <Button size="sm" variant="secondary" isDisabled={disabled} onPress={onRetry}>Încearcă din nou</Button>}
      {onStructure && error.recovery === "structure" && <Button size="sm" variant="secondary" isDisabled={disabled} onPress={onStructure}>Corectează structura manual</Button>}
      {error.recovery === "file" && <Link href="/generare-ai" onClick={onNewFile} className="text-sm underline">Încarcă alt fișier</Link>}
      {error.recovery === "auth" && <Link href="/auth" className="text-sm underline">Conectează-te din nou</Link>}
      {error.recovery === "offers" && <Link href="/oferte" className="text-sm underline">Toate ofertele</Link>}
      {error.recovery === "rate" && <Link href="/preturi" className="text-sm underline">Verifică cursul EUR/RON</Link>}
    </div>
  </div>;
}
