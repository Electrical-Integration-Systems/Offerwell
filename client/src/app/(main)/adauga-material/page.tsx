"use client";

import { useRef, useState } from "react";
import { 
  Button, FieldError, FieldGroup, Fieldset, Form,
  Label, NumberField, Spinner, TextArea, TextField, toast
} from "@heroui/react";
import { HelpCircle, RotateCcw, Save, Upload, ChevronDown, ChevronUp } from "lucide-react";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const priceFields = [
  { name: "pretAchizitie", label: "Preț achiziție" },
  { name: "pretVanzare", label: "Preț vânzare" },
  { name: "manopera", label: "Manoperă" },
] as const;

export default function AdaugaMaterialPage() {
  const [prices, setPrices] = useState({ pretAchizitie: NaN, pretVanzare: NaN, manopera: NaN });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importing = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ error: boolean; text: string } | null>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || importing.current || submitting.current) return;
    setImportMessage(null);
    if (!/\.(csv|xlsx)$/i.test(file.name) || !file.size || file.size > MAX_IMPORT_BYTES) {
      setImportMessage({ error: true, text: "Selectează un fișier CSV sau XLSX valid, de maximum 10 MB." });
      return;
    }
    importing.current = true;
    setIsImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/material/import", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Importul a eșuat.");
      const failedRows: number[] = result.failedRows ?? [];
      const text = failedRows.length
        ? `${result.imported} din ${result.total} materiale importate. Rânduri nesalvate: ${failedRows.join(", ")}. Reimportă doar rândurile nesalvate pentru a evita duplicatele.`
        : `${result.imported} materiale importate cu succes din ${file.name}.`;
      setImportMessage({ error: failedRows.length > 0, text });
    } catch (error) {
      setImportMessage({ error: true, text: error instanceof Error ? error.message : "Conexiunea a eșuat. Verifică catalogul înainte de a repeta importul." });
    } finally {
      importing.current = false;
      setIsImporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || importing.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    submitting.current = true;
    setIsSaving(true);
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
      const id = toast.success("Material adăugat cu succes.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
    } catch (error) {
      const id = toast.danger(error instanceof Error ? error.message : "Conexiunea a eșuat. Încearcă din nou.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrices({ pretAchizitie: NaN, pretVanzare: NaN, manopera: NaN });
    setValidationErrors({});
  };

  const [displayTip, setDisplayTip] = useState(false);
  
  const handleToggleDisplayTip = () => {
    setDisplayTip(prev => !prev);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-row items-center justify-between mb-8 border-b border-border pb-6">
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-accent">Catalog</p>
          <h1 className="text-3xl font-semibold">Adaugă material</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onPress={handleToggleDisplayTip}>
            {displayTip ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            <HelpCircle className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="secondary" isDisabled={isSaving || isImporting} onPress={() => fileInput.current?.click()}>
            {isImporting ? <Spinner size="sm" /> : <Upload className="size-4" aria-hidden="true" />}
            {isImporting ? "Se importă..." : "Importă CSV / XLSX"}
          </Button>
        </div>
      </div>
      {displayTip && (
        <section aria-label="Import materiale" className="mb-8 rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold">Importă materiale din fișier</h2>
              <p className="mt-1 text-sm text-muted-foreground">CSV sau XLSX · maximum 10 MB și 10.000 de rânduri. Pentru XLSX se citește prima foaie.</p>
              <p className="mt-2 text-sm font-medium">Toate prețurile din fișier (achiziție, vânzare și manoperă) trebuie să fie în EURO (EUR).</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium">Exemplu de structură a fișierului</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[600px] text-left text-sm">
              <caption className="sr-only">Prima linie conține antetul, iar a doua un material exemplu. Ultimele două coloane sunt goale.</caption>
              <thead className="bg-secondary">
                <tr>
                  {["descriere", "pretAchizitie", "pretVanzare", "manopera"].map((field) => (
                    <th key={field} scope="col" className="px-4 py-3 font-medium">{field}</th>
                  ))}
                  <th scope="col" className="w-10"><span className="sr-only">Coloană goală opțională 1</span></th>
                  <th scope="col" className="w-10"><span className="sr-only">Coloană goală opțională 2</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border font-mono">
                  {['"Tub metalic 20mm"', '"2.50"', '"0"', '"1.20"'].map((value, index) => (
                    <td key={index} className="whitespace-nowrap px-4 py-3">{value}</td>
                  ))}
                  <td /><td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Primul rând conține numele coloanelor, iar fiecare rând următor un material. În CSV, valorile se pot pune între ghilimele, ca în exemplu; în XLSX nu este nevoie de ghilimele. Coloanele goale de la final sunt acceptate. Prețurile goale sunt 0; prețul de vânzare 0 se calculează ca preț achiziție × 1,25.</p>
        </section>
      )}
      <input ref={fileInput} type="file" accept=".csv,.xlsx" aria-label="Fișier de materiale" className="hidden" onChange={handleImport} disabled={isImporting || isSaving} />
      {importMessage && <p role={importMessage.error ? "alert" : "status"} className={`mb-6 text-sm ${importMessage.error ? "text-danger" : "text-success"}`}>{importMessage.text}</p>}
      <Form onSubmit={handleSubmit} validationErrors={validationErrors} onReset={handleReset} className="w-full">
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
            <Button type="submit" isDisabled={isSaving || isImporting}>
              {isSaving ? <Spinner size="sm" /> : <Save className="size-4" aria-hidden="true" />}
              {isSaving ? "Se salvează..." : "Salvează material"}
            </Button>
            <Button type="reset" variant="secondary" isDisabled={isSaving || isImporting}><RotateCcw className="size-4" aria-hidden="true" />Resetează</Button>
          </Fieldset.Actions>
        </Fieldset>
      </Form>
    </main>
  );
}
