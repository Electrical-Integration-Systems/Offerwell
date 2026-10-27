"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { AlertDialog, Button, Input, Spinner, toast } from "@heroui/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchedMaterial } from "../../convex/oferte/review";
import { getFlowError } from "../../convex/oferte/errors";

export type OfferMaterialAction = { kind: "unvalidate" | "catalog"; material: MatchedMaterial; revision: number; offerId: Id<"oferte"> };

export default function OfferMaterialActionDialog({ action, idGenerare, onClose }: {
  action: OfferMaterialAction; idGenerare: Id<"oferte">; onClose: () => void;
}) {
  const { material, revision, kind } = action;
  const unvalidate = useMutation(api.oferte.mutations.nevalideazaMaterial);
  const canUpdate = Boolean(material.catalogMaterialId) || !["Nu a fost găsit în baza de date", "Eroare la căutare", ""].includes(material.descriereGasita);
  const [mode, setMode] = useState<"update" | "create">(canUpdate ? "update" : "create");
  const [description, setDescription] = useState(material.descriereOriginala);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const currency = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const args = { idGenerare, expectedRevision: revision, sheetName: material.sheetName, rand: material.rand };
      if (kind === "unvalidate") {
        await unvalidate(args);
        toast.success("Validarea materialului a fost anulată.");
      } else {
        const response = await fetch("/api/material/from-offer", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...args, mode, ...(mode === "create" ? { descriere: description.trim() } : {}) }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Materialul nu a putut fi salvat în catalog.");
        toast.success(mode === "update" ? "Prețurile materialului din catalog au fost actualizate." : "Materialul a fost adăugat în catalog.");
      }
      onClose();
    } catch (caught) {
      setError(kind === "unvalidate" ? getFlowError(caught, "validation").message : caught instanceof Error ? caught.message : "Salvarea a eșuat. Încearcă din nou.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return <AlertDialog isOpen onOpenChange={(open) => { if (!open && !inFlight.current) onClose(); }}>
    <AlertDialog.Backdrop isDismissable={!saving} isKeyboardDismissDisabled={saving}>
      <AlertDialog.Container><AlertDialog.Dialog>
        <AlertDialog.Header>
          <AlertDialog.Icon status="warning" />
          <AlertDialog.Heading>{kind === "unvalidate" ? "Anulezi validarea materialului?" : "Salvezi materialul în catalog?"}</AlertDialog.Heading>
        </AlertDialog.Header>
        <AlertDialog.Body className="space-y-4">
          <p className="break-words font-medium">{material.descriereOriginala}</p>
          <p className="text-sm text-muted-foreground">{material.sheetName ? `Foaia „${material.sheetName}” · ` : ""}Rând {material.rand}</p>
          {kind === "unvalidate" ? <p>Sigur dorești să anulezi validarea acestui material din ofertă? Prețurile sunt păstrate, iar materialul va necesita din nou verificare. Fișierul exportat va trebui regenerat.</p> : <>
            <fieldset disabled={saving} className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Alege cum salvezi materialul</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
                <input type="radio" name="catalog-mode" value="update" checked={mode === "update"} disabled={!canUpdate} onChange={() => setMode("update")} className="mt-1" />
                <span><span className="block font-medium">Actualizează prețurile materialului asociat</span><span className="text-sm text-muted-foreground">{canUpdate ? material.descriereGasita : "Asociază mai întâi un material din catalog."}</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
                <input type="radio" name="catalog-mode" value="create" checked={mode === "create"} onChange={() => setMode("create")} className="mt-1" />
                <span><span className="block font-medium">Adaugă un material nou</span><span className="text-sm text-muted-foreground">Materialul asociat existent își păstrează prețurile.</span></span>
              </label>
              {mode === "create" && <label className="flex flex-col gap-2 text-sm">Descrierea materialului nou
                <Input aria-label="Descrierea materialului nou" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
              </label>}
            </fieldset>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <p className="mb-2 font-medium">Prețuri unitare salvate în EUR</p>
              <p>Achiziție: {currency.format(material.pretAchizitie)}</p>
              <p>Vânzare: {currency.format(material.pretVanzare)}</p>
              <p>Manoperă: {currency.format(material.manopera)}</p>
            </div>
            <p className="text-sm text-muted-foreground">Modificarea catalogului se aplică viitoarelor căutări. Ofertele existente își păstrează prețurile.</p>
          </>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <Button variant="secondary" isDisabled={saving} onPress={onClose}>Renunță</Button>
          <Button variant={kind === "unvalidate" ? "danger" : "primary"} onPress={() => { void confirm(); }}
            isDisabled={saving || (kind === "catalog" && mode === "create" && description.trim().length < 3)}>
            {saving && <Spinner size="sm" />}{kind === "unvalidate" ? "Da, anulează validarea" : mode === "update" ? "Confirmă actualizarea prețurilor" : "Confirmă adăugarea"}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Dialog></AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>;
}
