"use client";

import { useState } from "react";
import { Button, FieldError, Form, Input, Label, NumberField, Spinner, TextField } from "@heroui/react";
import { Save } from "lucide-react";
import { extractionMappingChanged, type ExcelMapping } from "../../convex/oferte/mapping";

const columnFields = [
  { name: "coloanaDescriere", label: "Coloana cu descrierea materialului", hint: "Alege coloana cu denumirea completă, chiar dacă antetul este «Id Articol».", placeholder: "Ex.: B" },
  { name: "coloanaCantitati", label: "Coloana cu cantitatea", hint: "Coloana cu valorile numerice ale cantităților.", placeholder: "Ex.: D" },
  { name: "coloanaUnitate", label: "Coloana cu unitatea de măsură", hint: "Coloana cu buc, m, m² etc.", placeholder: "Ex.: C" },
  { name: "coloanaSfarsitDate", label: "Ultima coloană a tabelului", hint: "Prețurile noi vor fi adăugate după această coloană, cu o coloană liberă între ele. Modificarea afectează doar Excelul de export.", placeholder: "Ex.: F" },
] as const;

export default function ManualExcelMapping({ initialMapping, sheetName, disabled, error, hasResults, onSubmit, onCancel }: {
  sheetName?: string;
  initialMapping?: ExcelMapping;
  disabled: boolean;
  error?: string;
  hasResults: boolean;
  onSubmit: (mapping: ExcelMapping) => Promise<void>;
  onCancel: () => void;
}) {
  const [mapping, setMapping] = useState<ExcelMapping>(initialMapping ?? {
    randIncepereDate: 2, coloanaDescriere: "", coloanaCantitati: "", coloanaUnitate: "", coloanaSfarsitDate: "", valuta: "RON",
  });
  const [localError, setLocalError] = useState("");
  const reextract = extractionMappingChanged(initialMapping, mapping);

  return (
    <section aria-labelledby="manual-mapping-title" className="mb-8 rounded-xl border border-border bg-secondary/20 p-5 sm:p-6">
      <h2 id="manual-mapping-title" className="text-xl font-semibold">Selectează manual structura Excelului</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Deschide Excelul separat și verifică {sheetName ? `foaia „${sheetName}”` : "prima foaie"}. Introdu literele coloanelor (A, B, AA…) și numărul rândului unde începe primul material, fără rândul de antet.</p>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <Form className="mt-5 w-full" onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        if (new Set([mapping.coloanaDescriere, mapping.coloanaCantitati, mapping.coloanaUnitate]).size !== 3) {
          setLocalError("Descrierea, cantitatea și unitatea de măsură trebuie să fie în coloane diferite.");
          return;
        }
        setLocalError("");
        void onSubmit(mapping);
      }}>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField isRequired minValue={2} maxValue={10000} step={1} value={mapping.randIncepereDate} isDisabled={disabled}
            onChange={(value) => setMapping((current) => ({ ...current, randIncepereDate: value }))}>
            <Label>Primul rând de materiale</Label>
            <NumberField.Group className="border border-border"><NumberField.Input className="tabular-nums" /></NumberField.Group>
            <p className="text-xs text-muted-foreground">Ex.: 7, dacă primul material este pe rândul 7 în Excel.</p>
            <FieldError />
          </NumberField>
          <div className="flex flex-col gap-2">
            <label htmlFor="manual-excel-currency" className="text-sm font-medium">Moneda ofertei</label>
            <select id="manual-excel-currency" value={mapping.valuta} disabled={disabled}
              onChange={(event) => setMapping((current) => ({ ...current, valuta: event.target.value }))}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent">
              <option value="RON">RON — lei</option><option value="EUR">EUR — euro</option>
            </select>
            <p className="text-xs text-muted-foreground">Moneda în care trebuie completat Excelul final.</p>
          </div>
          {columnFields.map(({ name, label, hint, placeholder }) => (
            <TextField key={name} name={name} isRequired isDisabled={disabled} value={mapping[name]}
              onChange={(value) => setMapping((current) => ({ ...current, [name]: value.trim().toUpperCase() }))}
              validate={(value) => /^[A-Z]{1,3}$/.test(value) ? null : "Introdu o literă de coloană Excel, de exemplu B sau AA."}>
              <Label>{label}</Label><Input placeholder={placeholder} maxLength={3} className="uppercase" />
              <p className="text-xs text-muted-foreground">{hint}</p><FieldError />
            </TextField>
          ))}
        </div>
        {localError && <p role="alert" className="mt-4 text-sm text-danger">{localError}</p>}
        {hasResults && <p className={`mt-5 text-sm ${reextract ? "text-warning" : "text-muted-foreground"}`}>{reextract
          ? "Schimbarea coloanelor de materiale, cantitate, unitate sau a primului rând reface extragerea și căutarea prețurilor. Validările anterioare vor fi înlocuite."
          : "Aceste setări afectează doar exportul. Materialele, prețurile și validările sunt păstrate. Generează din nou Excelul pentru a aplica modificările."}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" isDisabled={disabled} onPress={onCancel}>Anulează</Button>
          <Button type="submit" isDisabled={disabled}>{disabled ? <Spinner size="sm" /> : <Save className="size-4" aria-hidden="true" />}{hasResults && !reextract ? "Salvează setările de export" : "Salvează structura și continuă"}</Button>
        </div>
      </Form>
    </section>
  );
}
