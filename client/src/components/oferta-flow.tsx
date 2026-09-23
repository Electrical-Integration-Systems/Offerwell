"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useConvex, useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { CursorPagination, PAGE_SIZE, useCursorPagination } from "./cursor-pagination";
import GradientText from "@/components/GradientText";
import { Sparkles, UploadCloud, Check, Pencil, Trash, Sheet, Download, RotateCcw, CircleAlert, X, ArrowLeft } from "lucide-react";
import { Table, Button, Input, Spinner, Tooltip, NumberField, Label, Checkbox } from "@heroui/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXCEL_MIME_TYPE, MAX_EXCEL_BYTES, hasValidPrices, needsReview, type MatchedMaterial } from "../../convex/oferte/review";

function ExcelDropzone({ file, disabled, onFileSelected }: {
  file: File | null;
  disabled: boolean;
  onFileSelected: (file: File | null) => void;
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFiles = (files: FileList | null) => {
    if (disabled || !files?.length) return;
    if (files.length !== 1) {
      setError("Selectează un singur fișier Excel.");
      return;
    }
    const candidate = files[0];
    if (!candidate.name.toLowerCase().endsWith(".xlsx") || !candidate.size || candidate.size > MAX_EXCEL_BYTES) {
      setError("Selectează un fișier .xlsx valid, de maximum 10 MB.");
      return;
    }
    setError("");
    onFileSelected(candidate);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    acceptFiles(event.dataTransfer.files);
  };

  return (
    <div className="mb-4">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Selectează fișierul Excel"
        aria-disabled={disabled}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDraggingOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingOver(false);
        }}
        onDrop={handleDrop}
        className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          isDraggingOver ? "border-blue-500 bg-blue-500/10" : "border-border bg-secondary/40 hover:bg-secondary/60"
        }`}
      >
        <UploadCloud className={`size-8 ${isDraggingOver ? "text-accent" : "text-muted-foreground"}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Listă de cantități</p>
          <p className="text-sm text-muted-foreground">Excel .xlsx · Maximum 10 MB</p>
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          tabIndex={-1}
          aria-label="Fișier Excel"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {file && (
        <div className="mt-3 flex flex-row items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-row items-center gap-2 min-w-0">
            <Sheet className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="truncate text-sm font-medium">{file.name}</span>
          </div>
          <Tooltip>
          <Button
            isIconOnly
            variant="danger-soft"
            size="sm"
            aria-label="Elimină fișierul"
            isDisabled={disabled}
            onPress={() => {
              setError("");
              onFileSelected(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <Trash className="size-4" />
          </Button>
          <Tooltip.Content>Elimină fișierul</Tooltip.Content>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

const priceFields = [
  { name: "cantitate", label: "Cantitate" },
  { name: "pretAchizitie", label: "Preț achiziție / UM" },
  { name: "pretVanzare", label: "Preț vânzare / UM" },
  { name: "manopera", label: "Manoperă / UM" },
] as const;
type MaterialEdit = Pick<MatchedMaterial, "rand" | "cantitate" | "pretAchizitie" | "pretVanzare" | "manopera">;
const steps = ["Upload", "Analiză Excel", "Extragere", "Prețuri", "Validare", "Export"];

function HighlightedDescription({ text, matchedTokens = [] }: { text: string; matchedTokens?: string[] }) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ro-RO");
  const matches = new Set(matchedTokens.map(normalize));

  return (
    <p className="font-medium">
      {text.split(/([\p{L}\p{N}]+)/gu).map((part, index) => matches.has(normalize(part))
        ? <mark key={`${part}-${index}`} className="rounded-sm bg-warning/30 px-0.5 text-foreground">{part}</mark>
        : part)}
    </p>
  );
}

function MaterialeTable({ materiale, currency, busy, editing, setEditing, onValidate }: {
  materiale: MatchedMaterial[];
  currency: Intl.NumberFormat;
  busy: boolean;
  editing: MaterialEdit | null;
  setEditing: (value: MaterialEdit | null) => void;
  onValidate: (material: MaterialEdit) => Promise<void>;
}) {
  return (
    <>
      {editing && (
        <form className="mb-6 border-y border-border bg-secondary/30 py-5" onSubmit={(event) => {
          event.preventDefault();
          void onValidate(editing);
        }}>
          <h3 className="mb-4 text-base font-semibold">Corectare material · Rând {editing.rand}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {priceFields.map(({ name, label }) => (
              <NumberField key={name} isRequired minValue={0} step={0.01} value={editing[name]}
                isDisabled={busy} formatOptions={{ maximumFractionDigits: 4 }}
                onChange={(value) => setEditing({ ...editing, [name]: value })}>
                <Label>{label}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton aria-label={`Scade ${label}`} />
                  <NumberField.Input />
                  <NumberField.IncrementButton aria-label={`Crește ${label}`} />
                </NumberField.Group>
              </NumberField>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" isDisabled={busy} onPress={() => setEditing(null)}><X className="size-4" />Anulează</Button>
            <Button type="submit" isDisabled={busy || !hasValidPrices(editing)}><Check className="size-4" />Salvează și validează</Button>
          </div>
        </form>
      )}
      <Table>
        <Table.ScrollContainer className="max-w-full">
          <Table.Content aria-label="Materiale și prețuri finale" className="min-w-[1060px]">
            <Table.Header>
              <Table.Column isRowHeader>Material / Potrivire catalog</Table.Column>
              <Table.Column className="text-right">Achiziție / UM</Table.Column>
              <Table.Column className="text-right">Vânzare / UM</Table.Column>
              <Table.Column className="text-right">Manoperă / UM</Table.Column>
              <Table.Column>Validare</Table.Column>
              <Table.Column className="text-right">Acțiuni</Table.Column>
            </Table.Header>
            <Table.Body>
              {materiale.map((material) => (
                <Table.Row key={material.rand} id={material.rand} className={needsReview(material) ? "bg-warning/5" : ""}>
                  <Table.Cell className="min-w-64 max-w-80 whitespace-normal break-words">
                    <p className="mb-1 text-xs text-muted-foreground">Rând {material.rand}</p>
                    <HighlightedDescription text={material.descriereOriginala} matchedTokens={material.matchedTokens} />
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{currency.format(material.pretAchizitie)}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{currency.format(material.pretVanzare)}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{currency.format(material.manopera)}</Table.Cell>
                  <Table.Cell>
                    <span className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${needsReview(material) ? "text-warning" : "text-success"}`}>
                      {needsReview(material) ? <CircleAlert className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}
                      {needsReview(material) ? "De validat" : material.validated ? "Validat" : "Potrivire exactă"}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground" title="Scor de calitate calculat din acoperire și greșeli de tipar">
                      Calitate: {material.matchScore}/10
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <Button isIconOnly size="sm" variant="secondary" aria-label={`Editează rândul ${material.rand}`}
                          isDisabled={busy || editing !== null} onPress={() => setEditing(material)}><Pencil className="size-4" /></Button>
                        <Tooltip.Content>Editează prețurile</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Button isIconOnly size="sm" variant="primary" aria-label={`Validează rândul ${material.rand}`}
                          isDisabled={busy || editing !== null || !needsReview(material) || !hasValidPrices(material)}
                          onPress={() => { void onValidate(material); }}><Check className="size-4" /></Button>
                        <Tooltip.Content>Confirmă materialul și prețurile</Tooltip.Content>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </>
  );
}

function PrepareMaterialPages({ idGenerare }: { idGenerare: Id<"oferte"> }) {
  const prepare = useMutation(api.oferte.mutations.prepareMaterialPagination);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void prepare({ idGenerare }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Pregatirea materialelor a esuat.");
    });
    return () => { cancelled = true; };
  }, [idGenerare, prepare, attempt]);
  return error ? <div className="py-4"><p role="alert" className="mb-3 text-danger">{error}</p>
    <Button onPress={() => { setError(""); setAttempt((value) => value + 1); }}><RotateCcw className="size-4" />Reincearca</Button>
  </div> : <p role="status" className="flex items-center gap-2 py-4"><Spinner size="sm" />Se pregatesc materialele...</p>;
}

function MaterialePages({ idGenerare, pendingOnly, currency, busy, editing, setEditing, onValidate }: {
  idGenerare: Id<"oferte">;
  pendingOnly: boolean;
  currency: Intl.NumberFormat;
  busy: boolean;
  editing: MaterialEdit | null;
  setEditing: (value: MaterialEdit | null) => void;
  onValidate: (material: MaterialEdit) => Promise<void>;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.oferte.queries.listMateriale,
    { idGenerare, pendingOnly }, { initialNumItems: PAGE_SIZE });
  const pagination = useCursorPagination(results, status, loadMore);
  return <>
    {pagination.loading && pagination.items.length === 0 ? <p role="status" className="flex items-center gap-2 py-8 justify-center"><Spinner size="sm" />Se incarca materialele...</p> : (
      <MaterialeTable materiale={pagination.items} currency={currency} busy={busy || pagination.loading} editing={editing} setEditing={setEditing} onValidate={onValidate} />
    )}
    <CursorPagination {...pagination} disabled={busy || editing !== null} />
  </>;
}

export default function OfertaFlow({ idOferta, detail = false }: { idOferta?: string; detail?: boolean }) {
  const router = useRouter();
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const oferta = useQuery(api.oferte.queries.getOfertaPage, idOferta && isAuthenticated ? { idOferta } : "skip");
  const idGenerare = oferta?._id ?? null;
  const generateUploadUrl = useMutation(api.oferte.mutations.generateUploadUrl);
  const uploadInputExcel = useMutation(api.oferte.mutations.uploadInputExcel);
  const analizaExcel = useAction(api.oferte.actions.analizaExcelInput);
  const extrageMateriale = useAction(api.oferte.actions.extrageMateriale);
  const cautaPreturi = useAction(api.oferte.actions.cautaSiPopuleazaPreturi);
  const valideazaMaterial = useMutation(api.oferte.mutations.valideazaMaterial);
  const genereazaExcel = useAction(api.oferte.actions.genereazaExcelOutput);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<MaterialEdit | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const inFlight = useRef(false);
  const uploadedFile = useRef<Id<"_storage"> | null>(null);
  const currentOffer = useRef<Id<"oferte"> | null>(null);
  const busy = activeStep !== null || saving;
  const materialCount = oferta?.materialCount ?? 0;
  const pendingCount = oferta?.pendingCount ?? 0;
  const currency = new Intl.NumberFormat("ro-RO", { style: "currency", currency: oferta?.excelMapping?.valuta || "RON" });
  const total = oferta?.total ?? 0;
  const completed = [Boolean(oferta), Boolean(oferta?.excelMapping), Boolean(oferta?.hasExtracted), Boolean(oferta?.hasMatched), Boolean(oferta?.hasMatched) && pendingCount === 0, Boolean(oferta?.excelOutput)];

  const processFile = async () => {
    if (inFlight.current || !isAuthenticated) return;
    inFlight.current = true;
    setActiveStep(idGenerare ? 1 : 0);
    setError("");
    try {
      let offerId = idGenerare ?? currentOffer.current;
      if (!offerId) {
        if (!excelFile) throw new Error("Selectează un fișier Excel.");
        setActiveStep(0);
        if (!uploadedFile.current) {
          const uploadUrl = await generateUploadUrl({});
          const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": EXCEL_MIME_TYPE }, body: excelFile });
          if (!response.ok) throw new Error("Uploadul a eșuat. Încearcă din nou.");
          const uploaded: unknown = await response.json();
          if (!uploaded || typeof uploaded !== "object" || !("storageId" in uploaded) || typeof uploaded.storageId !== "string") {
            throw new Error("Răspuns invalid la upload.");
          }
          uploadedFile.current = uploaded.storageId as Id<"_storage">;
        }
        offerId = await uploadInputExcel({ storageId: uploadedFile.current, fileName: excelFile.name });
        currentOffer.current = offerId;
        router.replace(`/generare-ai?oferta=${encodeURIComponent(offerId)}`, { scroll: false });
      }
      const existing = await convex.query(api.oferte.queries.getOferta, { idGenerare: offerId });
      if (!existing.excelMapping) {
        setActiveStep(1);
        await analizaExcel({ idGenerare: offerId });
      }
      if (!existing.hasExtracted) {
        setActiveStep(2);
        await extrageMateriale({ idGenerare: offerId });
      }
      if (!existing.hasMatched) {
        setActiveStep(3);
        await cautaPreturi({ idGenerare: offerId });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Procesarea a eșuat. Încearcă din nou.");
    } finally {
      inFlight.current = false;
      setActiveStep(null);
    }
  };

  const validate = async (material: MaterialEdit) => {
    if (!idGenerare || !oferta || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await valideazaMaterial({ idGenerare, expectedRevision: oferta.revision ?? 0, rand: material.rand,
        cantitate: material.cantitate, pretAchizitie: material.pretAchizitie, pretVanzare: material.pretVanzare, manopera: material.manopera });
      setEditing(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validarea nu a putut fi salvată.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  };

  const exportFile = async () => {
    if (!idGenerare || inFlight.current || editing || !oferta?.hasMatched || pendingCount) return;
    inFlight.current = true;
    setActiveStep(5);
    setError("");
    try {
      await genereazaExcel({ idGenerare });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Exportul a eșuat. Încearcă din nou.");
    } finally {
      inFlight.current = false;
      setActiveStep(null);
    }
  };

  if (idOferta && oferta === undefined) {
    return <main role="status" className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-10 justify-center"><Spinner size="sm" />Se încarcă oferta...</main>;
  }
  if (idOferta && oferta === null) {
    return <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-3 text-2xl font-semibold">Oferta nu este disponibilă</h1>
      <Link href="/oferte" className="inline-flex items-center gap-2 text-sm underline"><ArrowLeft className="size-4" />Înapoi la oferte</Link>
    </main>;
  }

  return (
        <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
            <Link href="/oferte" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Toate ofertele</Link>
            <div className="flex flex-row justify-between items-end mb-8 border-b border-border pb-6">
                <div>
                    <p className="mb-2 text-sm font-medium text-accent">{detail ? "Catalog" : "Unelte"}</p>
                    <h1 className="flex flex-row items-center gap-2 text-3xl font-semibold mb-2">
                        <Sparkles className="size-5 text-blue-500" aria-hidden="true" />
                        <GradientText 
                            colors={['#88baff', '#00aaf4', '#2d7aff']}
                        >
                            {detail ? "Detalii ofertă" : "Generare AI"}
                            {idGenerare && oferta?.excelInput?.fileName ? (" - " + oferta.excelInput.fileName) : null}
                        </GradientText>
                    </h1>
                    {!detail && <p className="text-muted-foreground">Adaugă lista de cantități pentru estimarea prețurilor folosind inteligență artificială</p>}
                </div>
            </div>
            <ol aria-label="Etape generare" className="mb-8 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
              {steps.map((step, index) => (
                <li key={step} aria-current={activeStep === index ? "step" : undefined}
                  className={`flex items-center gap-2 border-b-2 pb-3 ${activeStep === index ? "border-blue-500 text-blue-500" : completed[index] ? "border-success text-success" : "border-border text-muted-foreground"}`}>
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {activeStep === index ? <Spinner size="sm" /> : completed[index] ? <Check className="size-4" /> : index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {idGenerare ? (
              null
            ) : <ExcelDropzone file={excelFile} disabled={busy} onFileSelected={(file) => {
              uploadedFile.current = null;
              currentOffer.current = null;
              setExcelFile(file);
              setError("");
            }} />}
            {error && <p role="alert" className="my-4 break-words rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
            <p role="status" className="mb-4 min-h-5 text-sm text-muted-foreground">
              {activeStep !== null ? `${steps[activeStep]} în curs...` : saving ? "Se salvează validarea..." : ""}
            </p>
            {!oferta?.hasMatched && (
              <Button isDisabled={busy || !isAuthenticated || (idGenerare ? !oferta : !excelFile)} onPress={() => { void processFile(); }}>
                {busy ? <Spinner size="sm" /> : <Sparkles className="size-4" />}
                {idGenerare || error ? "Reia procesarea" : "Analizează Excel"}
              </Button>
            )}
            {oferta?.hasMatched && (
              <section aria-label="Preview ofertă" className="min-w-0">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Materiale și prețuri</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{materialCount} materiale · {pendingCount} de validat · {oferta.excelMapping?.valuta}</p>
                  </div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Total vânzare + manoperă</p><p className="text-xl font-semibold tabular-nums">{currency.format(total)}</p></div>
                </div>
                <div className="mb-4">
                  <Checkbox className="flex flex-row items-center gap-2" isSelected={onlyPending} onChange={setOnlyPending} isDisabled={busy || editing !== null}>
                    <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                    <Checkbox.Content><Label>Doar materiale de validat ({pendingCount})</Label></Checkbox.Content>
                  </Checkbox>
                </div>
                {!oferta.materialsReady ? <PrepareMaterialPages key={oferta._id} idGenerare={oferta._id} /> : onlyPending && pendingCount === 0 ? <p role="status" className="border-y border-border py-8 text-sm text-success">Nu mai există materiale de validat.</p> : (
                  <MaterialePages key={`${oferta._id}:${onlyPending}`} idGenerare={oferta._id} pendingOnly={onlyPending} currency={currency} busy={busy} editing={editing} setEditing={setEditing} onValidate={validate} />
                )}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <p role="status" className={`text-sm ${pendingCount ? "text-warning" : "text-success"}`}>
                    {!materialCount ? "Nu există materiale de exportat." : pendingCount ? `${pendingCount} materiale necesită validare` : "Toate materialele sunt validate"}
                  </p>
                  {oferta.downloadUrl && !editing ? (
                    <a href={oferta.downloadUrl} download={oferta.excelOutput?.fileName} target="_blank" rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2">
                      <Download className="size-4" />Descarcă Excel
                    </a>
                  ) : (
                    <Button isDisabled={busy || editing !== null || !oferta.materialsReady || !materialCount || pendingCount > 0} onPress={() => { void exportFile(); }}>
                      {activeStep === 5 ? <Spinner size="sm" /> : <Sheet className="size-4" />}Generează Excel
                    </Button>
                  )}
                </div>
              </section>
            )}
        </main>
  );
}
