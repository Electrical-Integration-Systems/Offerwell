"use client";

import { useRef, useState } from "react";
import { Alert, Button, FieldError, FieldGroup, Fieldset, Form, Label, NumberField, Spinner, TextArea, TextField } from "@heroui/react";
import { Toast, toast } from '@heroui/react';
import { RotateCcw, Save } from "lucide-react";

const priceFields = [
  { name: "pretAchizitie", label: "Preț achiziție" },
  { name: "pretVanzare", label: "Preț vânzare" },
  { name: "manopera", label: "Manoperă" },
] as const;
const emptyPrices = { pretAchizitie: NaN, pretVanzare: NaN, manopera: NaN };

export default function AdaugaMaterialPage() {
  const [prices, setPrices] = useState(emptyPrices);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    submitting.current = true;
    setIsSaving(true);
    setError("");
    setSuccess(false);
    setValidationErrors({});
    try {
      const response = await fetch("/api/material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriere: String(formData.get("descriere") || "").trim(), ...prices }),
      });
      const result = await response.json();
      if (!response.ok) {
        setValidationErrors(result.errors || {});
        throw new Error(result.error || "Materialul nu a putut fi salvat.");
      }
      form.reset();
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Conexiunea a eșuat. Încearcă din nou.");
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-8 border-b border-border pb-6">
        <p className="mb-2 text-sm font-medium text-accent">Catalog</p>
        <h1 className="text-3xl font-semibold">Adaugă material</h1>
      </div>
      <Form onSubmit={onSubmit} validationErrors={validationErrors} onReset={() => {
        setPrices(emptyPrices);
        setValidationErrors({});
        setError("");
        setSuccess(false);
      }} className="w-full">
        {success && <Alert status="success" role="status" className="mb-6"><Alert.Indicator /><Alert.Content><Alert.Title>Material adăugat.</Alert.Title></Alert.Content></Alert>}
        {error && <Alert status="danger" role="alert" className="mb-6"><Alert.Indicator /><Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content></Alert>}
        <Fieldset className="w-full gap-10">
          <FieldGroup className="gap-6 flex flex-col">
            <TextField isRequired name="descriere" maxLength={500} validate={(value) => value.trim().length < 3 ? "Descrierea trebuie să aibă cel puțin 3 caractere." : null}>
              <Label>Descriere</Label>
              <TextArea placeholder="Cablu 7x1 mm² halogen free, montat aparent in tub PVC/pat cablu" rows={3} className="border border-border focus-visible:ring-2 focus-visible:ring-accent" />
              <FieldError />
            </TextField>
            <div className="flex flex-row gap-2 items-center justify-between">
              {priceFields.map(({ name, label }) => (
                <NumberField key={name} name={name} isRequired minValue={0} maxValue={2147483647} step={1} value={prices[name]} onChange={(value) => setPrices((current) => ({ ...current, [name]: value }))} className="min-w-0">
                  <Label>{label} (€)</Label>
                  <NumberField.Group className="border border-border focus-within:ring-2 focus-within:ring-accent">
                    <NumberField.DecrementButton aria-label={`Scade ${label.toLowerCase()}`} />
                    <NumberField.Input className="min-w-0 tabular-nums" />
                    <NumberField.IncrementButton aria-label={`Crește ${label.toLowerCase()}`} />
                  </NumberField.Group>
                  <FieldError />
                </NumberField>
              ))}
            </div>
          </FieldGroup>
          <Fieldset.Actions className="mt-3 flex flex-wrap gap-3 border-t border-border pt-6 justify-end">
            <Button type="submit" isDisabled={isSaving}>
              {isSaving ? <Spinner size="sm" /> : <Save className="size-4" aria-hidden="true" />}
              {isSaving ? "Se salvează..." : "Salvează material"}
            </Button>
            <Button type="reset" variant="secondary" isDisabled={isSaving}><RotateCcw className="size-4" aria-hidden="true" />Resetează</Button>
          </Fieldset.Actions>
        </Fieldset>
      </Form>
    </main>
  );
}
