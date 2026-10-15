"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { Button, FieldError, Form, Input, Label, Modal, Spinner, TextField, toast } from "@heroui/react";
import { KeyRound } from "lucide-react";
import { api } from "../../convex/_generated/api";

export default function ChangePasswordDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const changePassword = useAction(api.auth.changeCurrentPassword);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const oldPassword = String(values.get("oldPassword") ?? "");
    const newPassword = String(values.get("newPassword") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    const errors: Record<string, string> = {};
    if (newPassword.length < 8) errors.newPassword = "Parola nouă trebuie să aibă cel puțin 8 caractere.";
    else if (newPassword === oldPassword) errors.newPassword = "Alege o parolă diferită de cea actuală.";
    if (confirmation !== newPassword) errors.confirmation = "Parolele nu coincid.";
    setValidationErrors(errors);
    setError("");
    if (Object.keys(errors).length) return;
    submitting.current = true;
    setIsSaving(true);
    try {
      await changePassword({ oldPassword, newPassword });
      form.reset();
      toast.success("Parola a fost schimbată cu succes.");
      onClose();
    } catch (caught) {
      setError(caught instanceof ConvexError && typeof caught.data === "string"
        ? caught.data : "Parola nu a putut fi schimbată. Încearcă din nou.");
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <Modal.Backdrop isDismissable={!isSaving} isKeyboardDismissDisabled={isSaving}>
        <Modal.Container size="sm"><Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="flex items-center gap-2"><KeyRound className="size-5 text-accent" aria-hidden="true" />Schimbă parola</Modal.Heading>
            <p className="mt-2 text-sm text-muted-foreground mb-4">Schimbă parola contului tău. Parola nouă trebuie să aibă cel puțin 8 caractere.</p>
          </Modal.Header>
          <Form onSubmit={handleSubmit} validationErrors={validationErrors} aria-busy={isSaving}>
            <Modal.Body className="space-y-4">
              <TextField name="oldPassword" type="password" isRequired isDisabled={isSaving}>
                <Label>Parola actuală</Label><Input autoComplete="current-password" autoFocus /><FieldError />
              </TextField>
              <TextField name="newPassword" type="password" isRequired minLength={8} isDisabled={isSaving}>
                <Label>Parola nouă</Label><Input autoComplete="new-password" /><FieldError />
              </TextField>
              <TextField name="confirmation" type="password" isRequired isDisabled={isSaving}>
                <Label>Confirmă parola nouă</Label><Input autoComplete="new-password" /><FieldError />
              </TextField>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" variant="secondary" isDisabled={isSaving} onPress={onClose}>Anulează</Button>
              <Button type="submit" isDisabled={isSaving}>{isSaving && <Spinner size="sm" />}{isSaving ? "Se salvează..." : "Schimbă parola"}</Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog></Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
