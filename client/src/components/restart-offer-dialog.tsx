"use client";

import { useRef, useState } from "react";
import { AlertDialog, Button, Input, Spinner } from "@heroui/react";
import { RESTART_CONFIRMATION_TEXT } from "../../convex/oferte/restart_confirmation";
import { getFlowError } from "../../convex/oferte/errors";

export default function RestartOfferDialog({ fileName, onConfirm, onClose }: {
  fileName: string; onConfirm: (confirmation: string) => Promise<void>; onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const confirm = async () => {
    if (confirmation !== RESTART_CONFIRMATION_TEXT || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await onConfirm(confirmation);
    } catch (caught) {
      setError(getFlowError(caught, "analysis").message);
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
          <AlertDialog.Heading>Reiei complet procesarea ofertei?</AlertDialog.Heading>
        </AlertDialog.Header>
        <AlertDialog.Body className="space-y-4">
          <p className="break-words font-medium">{fileName}</p>
          <p>Structura identificată, materialele extrase, potrivirile, prețurile editate, validările și exportul curent vor fi resetate. Aceste modificări nu pot fi anulate.</p>
          <p>Fișierul Excel încărcat și foile selectate sunt păstrate. Vor porni din nou reanalizarea Excelului, extragerea materialelor și potrivirea prețurilor din catalog.</p>
          <label htmlFor="restart-offer-confirmation" className="block text-sm font-medium">Pentru confirmare, tastează exact textul:</label>
          <p className="select-none rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono font-semibold tracking-wide"
            draggable={false} style={{ userSelect: "none", WebkitUserSelect: "none" }}
            onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
            {RESTART_CONFIRMATION_TEXT}
          </p>
          <Input id="restart-offer-confirmation" aria-label="Text de confirmare pentru reluarea completă"
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={saving}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <Button variant="secondary" isDisabled={saving} onPress={onClose}>Renunță</Button>
          <Button variant="danger" isDisabled={saving || confirmation !== RESTART_CONFIRMATION_TEXT} onPress={() => { void confirm(); }}>
            {saving && <Spinner size="sm" />}Resetează și reia procesarea
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Dialog></AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>;
}
