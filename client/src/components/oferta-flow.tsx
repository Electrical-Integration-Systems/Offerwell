"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useConvex, useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { CursorPagination, PAGE_SIZE, useCursorPagination } from "./cursor-pagination";
import GradientText from "@/components/react-bits/GradientText";
import { Sparkles, UploadCloud, Check, Pencil, Trash, Sheet, Download, CircleAlert, ArrowLeft, Eye, Replace, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Table, Button, Input, Spinner, Tooltip, NumberField, Label, Checkbox, Drawer, AlertDialog, Fieldset, FieldGroup, FieldError, toast } from "@heroui/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXCEL_MIME_TYPE, MAX_EXCEL_BYTES, hasValidPrices, needsReview, type MatchedMaterial } from "../../convex/oferte/review";
import { salePrice, SALE_PRICE_MULTIPLIER } from "../../convex/material_prices";
import { convertEuroAmount, euroConversionRate, type OfferCurrency } from "../../convex/oferte/currency";
import ManualExcelMapping from "./manual-excel-mapping";
import type { ExcelMapping } from "../../convex/oferte/mapping";
import { flowError, getFlowError, type FlowError, type FlowStage } from "../../convex/oferte/errors";
import OfertaFlowError from "./oferta-flow-error";
import ExpandableText from "./expandable-text";
import ExcelSheetSelect from "./excel-sheet-select";
import ReplaceOfferMaterial from "./replace-offer-material";

type PriceSortField = "pretAchizitie" | "pretVanzare" | "manopera" | "cantitate" | "matchScore" | "totalVanzareManopera";
type PriceSort = { field: PriceSortField; direction: "asc" | "desc" };
type MaterialTableActions = {
  sort: PriceSort | null;
  onSort: (field: PriceSortField) => void;
  onReplace: (material: MatchedMaterial) => void;
};

function ExcelDropzone({ file, disabled, onFileSelected, onAnalyze, children, canAnalyze = true }: {
  children?: ReactNode;
  canAnalyze?: boolean;
  file: File | null;
  disabled: boolean;
  onFileSelected: (file: File | null) => void;
  onAnalyze?: () => void;
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
          {file ? (
            <>
              <p className="text-sm font-medium text-success">Fișier selectat</p>
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Listă de cantități</p>
              <p className="text-sm text-muted-foreground">Excel .xlsx · Maximum 10 MB</p>
            </>
          )}
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
      {children}
      {file && (
        <div className="mt-2 flex gap-2 justify-center items-center flex-wrap">
          <Button
            isDisabled={disabled}
            onPress={() => {
              setError("");
              onFileSelected(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            variant="danger-soft"
            size="sm"
            aria-label="Elimină fișierul"
          >
            <Trash className="size-4" />Elimină
          </Button>
          {onAnalyze && (
            <Button
              isDisabled={disabled || !canAnalyze}
              onPress={onAnalyze}
              size="sm"
            >
              <Sparkles className="size-4" />Analizează Excel
            </Button>
          )}
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
type MaterialEdit = Pick<MatchedMaterial, "sheetName" | "rand" | "cantitate" | "pretAchizitie" | "pretVanzare" | "manopera">;
const steps = ["Upload", "Analiză Excel", "Extragere", "Prețuri", "Validare", "Export"];

function HighlightedDescription({ text, matchedTokens = [] }: { text: string; matchedTokens?: string[] }) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ro-RO");
  const matches = new Set(matchedTokens.map(normalize));

  return (
    <ExpandableText text={text}><span className="font-medium">
      {text.split(/([\p{L}\p{N}]+)/gu).map((part, index) => matches.has(normalize(part))
        ? <mark key={index} className="rounded-sm bg-warning/30 px-0.5 text-foreground">{part}</mark>
        : part)}
    </span></ExpandableText>
  );
}

function MaterialeTable({ materiale, busy, editing, setEditing, onValidate, onDelete, onReplace, sort, onSort, conversionRate, displayCurrency, displayCurrencyFormatter }: MaterialTableActions & {
  materiale: MatchedMaterial[];
  busy: boolean;
  editing: MaterialEdit | null;
  setEditing: (material: MatchedMaterial) => void;
  onValidate: (material: MaterialEdit) => Promise<void>;
  onDelete: (material: MatchedMaterial) => Promise<void>;
  conversionRate: number | null;
  displayCurrency: "EUR" | "RON";
  displayCurrencyFormatter: Intl.NumberFormat;
}) {
  const displayMultiplier = displayCurrency === "EUR" ? 1 : conversionRate;
  const formatPrice = (price: number) => displayMultiplier === null ? "—" : displayCurrencyFormatter.format(price * displayMultiplier);
  const quantityFormatter = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 20 });
  return (
    <Table>
      <Table.ScrollContainer className="max-w-full">
        <Table.Content aria-label="Materiale și prețuri finale" className="min-w-[1060px]">
          <Table.Header>
            <Table.Column isRowHeader>Material / Potrivire catalog</Table.Column>
            {([
              { field: "cantitate", label: "Cantitate" },
              { field: "pretAchizitie", label: "Achiziție / UM" },
              { field: "pretVanzare", label: "Vânzare / UM" },
              { field: "manopera", label: "Manoperă / UM" },
              { field: "totalVanzareManopera", label: "Total vânzare + manoperă" },
              { field: "matchScore", label: "Validare / Calitate" },
            ] as const).map(({ field, label }) => (
              <Table.Column key={field} className="text-right" aria-sort={sort?.field === field ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
                <button type="button" disabled={busy || editing !== null} onClick={() => onSort(field)}
                  className="ml-auto flex cursor-pointer items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  aria-label={`Sortează după ${label.toLowerCase()}, ${sort?.field === field && sort.direction === "asc" ? "descrescător" : "crescător"}`}>
                  {label}{sort?.field !== field ? <ArrowUpDown className="size-3" /> : sort.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                </button>
              </Table.Column>
            ))}
            <Table.Column className="text-right">Acțiuni</Table.Column>
          </Table.Header>
          <Table.Body>
            {materiale.map((material) => (
              <Table.Row key={JSON.stringify([material.sheetName, material.rand])} id={JSON.stringify([material.sheetName, material.rand])} className={needsReview(material) ? "bg-warning/5" : ""}>
                <Table.Cell className="min-w-64 max-w-80 whitespace-normal break-words">
                  <div className="mb-2 flex items-center justify-between">
                  <p className="mb-1 text-xs text-muted-foreground">Rând {material.rand}</p>
                  <div className="flex items-center gap-2"><Tooltip delay={50}>
                    <Tooltip.Trigger>
                        <Eye className="size-5 cursor-pointer" />
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p>{material.descriereGasita}</p>
                      <Tooltip.Arrow />
                    </Tooltip.Content>
                  </Tooltip>
                  <Tooltip>
                    <Button isIconOnly size="sm" variant="tertiary" aria-label={`Schimbă materialul asociat rândului ${material.rand}`}
                      isDisabled={busy || editing !== null} onPress={() => onReplace(material)}><Replace className="size-4" /></Button>
                    <Tooltip.Content>Schimbă materialul asociat</Tooltip.Content>
                  </Tooltip></div>
                  </div>
                  <HighlightedDescription text={material.descriereOriginala} matchedTokens={material.matchedTokens} />
                  {material.descriereGasita === "Eroare la căutare" && <p className="mt-2 text-xs text-warning">Prețurile nu au putut fi căutate. Completează-le manual și validează rândul.</p>}
                  {material.descriereGasita === "Nu a fost găsit în baza de date" && <p className="mt-2 text-xs text-warning">Material negăsit în catalog. Alege manual un material sau completează prețurile.</p>}
                </Table.Cell>
                <Table.Cell className="text-right tabular-nums whitespace-nowrap">
                  {quantityFormatter.format(material.cantitate)} {material.unitate}
                </Table.Cell>
                <Table.Cell className="text-right tabular-nums">{formatPrice(material.pretAchizitie)}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{formatPrice(material.pretVanzare)}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{formatPrice(material.manopera)}</Table.Cell>
                <Table.Cell className="text-right font-semibold whitespace-nowrap tabular-nums">{formatPrice(material.cantitate * (salePrice(material) + material.manopera))}</Table.Cell>
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
                    <Tooltip>
                      <Button isIconOnly size="sm" variant="secondary" className="text-danger" aria-label={`Șterge materialul de pe rândul ${material.rand}`}
                        isDisabled={busy || editing !== null} onPress={() => { void onDelete(material); }}><Trash className="size-4" /></Button>
                      <Tooltip.Content>Șterge materialul din ofertă</Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function PrepareMaterialPages({ idGenerare }: { idGenerare: Id<"oferte"> }) {
  const prepare = useMutation(api.oferte.mutations.prepareMaterialPagination);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<FlowError | null>(null);
  useEffect(() => {
    let cancelled = false;
    void prepare({ idGenerare }).catch((caught: unknown) => {
      if (!cancelled) {
        setError(getFlowError(caught, "load"));
      }
    });
    return () => { cancelled = true; };
  }, [idGenerare, prepare, attempt]);
  return error ? <OfertaFlowError error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} />
    : <p role="status" className="flex items-center gap-2 py-4"><Spinner size="sm" />Se pregătesc materialele...</p>;
}

function MaterialePages({ idGenerare, sheetName, pendingOnly, busy, editing, setEditing, onValidate, onDelete, onReplace, sort, onSort, conversionRate, displayCurrency, displayCurrencyFormatter }: MaterialTableActions & {
  sheetName?: string;
  idGenerare: Id<"oferte">;
  pendingOnly: boolean;
  busy: boolean;
  editing: MaterialEdit | null;
  setEditing: (material: MatchedMaterial) => void;
  onValidate: (material: MaterialEdit) => Promise<void>;
  onDelete: (material: MatchedMaterial) => Promise<void>;
  conversionRate: number | null;
  displayCurrency: "EUR" | "RON";
  displayCurrencyFormatter: Intl.NumberFormat;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.oferte.queries.listMateriale,
    { idGenerare, pendingOnly, sheetName, sortBy: sort?.field, sortDirection: sort?.direction }, { initialNumItems: PAGE_SIZE });
  const pagination = useCursorPagination(results, status, loadMore);
  return <>
    {pagination.loading && pagination.items.length === 0 ? <p role="status" className="flex items-center gap-2 py-8 justify-center"><Spinner size="sm" />Se incarca materialele...</p> : (
      <MaterialeTable materiale={pagination.items} busy={busy || pagination.loading} editing={editing} setEditing={setEditing} onValidate={onValidate} onDelete={onDelete} onReplace={onReplace} sort={sort} onSort={onSort} conversionRate={conversionRate} displayCurrency={displayCurrency} displayCurrencyFormatter={displayCurrencyFormatter} />
    )}
    <CursorPagination {...pagination} disabled={busy || editing !== null} />
  </>;
}

export default function OfertaFlow({ idOferta, detail = false }: { idOferta?: string; detail?: boolean }) {
  const router = useRouter();
  const convex = useConvex();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const oferta = useQuery(api.oferte.queries.getOfertaPage, idOferta && isAuthenticated ? { idOferta } : "skip");
  const idGenerare = oferta?._id ?? null;
  const exchangeRate = useQuery(api.oferte.queries.getExchangeRate, oferta?.hasMatched ? { moneda: "EUR" } : "skip");
  const generateUploadUrl = useMutation(api.oferte.mutations.generateUploadUrl);
  const uploadInputExcel = useMutation(api.oferte.mutations.uploadInputExcel);
  const analizaExcel = useAction(api.oferte.actions.analizaExcelInput);
  const salveazaStructuraExcel = useAction(api.oferte.actions.salveazaStructuraExcel);
  const extrageMateriale = useAction(api.oferte.actions.extrageMateriale);
  const cautaPreturi = useAction(api.oferte.actions.cautaSiPopuleazaPreturi);
  const valideazaMaterial = useMutation(api.oferte.mutations.valideazaMaterial);
  const valideazaMaterialeDupaCalitate = useMutation(api.oferte.mutations.valideazaMaterialeDupaCalitate);
  const stergeMaterial = useMutation(api.oferte.mutations.stergeMaterial);
  const genereazaExcel = useAction(api.oferte.actions.genereazaExcelOutput);
  const materialCount = oferta?.materialCount ?? 0;
  const pendingCount = oferta?.pendingCount ?? 0;
  const [sheetChoice, setSheetChoice] = useState<string | null>(null);
  const activeSheet = oferta?.selectedSheets?.includes(sheetChoice ?? "") ? sheetChoice! : oferta?.selectedSheets?.[0];
  const [minimumQuality, setMinimumQuality] = useState(7);
  const [bulkValidating, setBulkValidating] = useState(false);
  const [exportConfirmationOpen, setExportConfirmationOpen] = useState(false);
  const validQuality = Number.isFinite(minimumQuality) && minimumQuality >= 1 && minimumQuality <= 10;
  const bulkValidationCount = useQuery(api.oferte.queries.countBulkValidation,
    idGenerare && oferta?.materialsReady && validQuality ? { idGenerare, minimumQuality, sheetName: activeSheet } : "skip");
  const activeMapping = oferta?.sheetMappings?.find((entry) => entry.sheetName === activeSheet)?.mapping ?? (!oferta?.selectedSheets ? oferta?.excelMapping : undefined);
  const baseValuta = activeMapping?.valuta || "RON";
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [fileSheets, setFileSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [readingSheets, setReadingSheets] = useState(false);
  const [fileError, setFileError] = useState("");
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MaterialEdit | null>(null);
  const [failedDeletion, setFailedDeletion] = useState<MatchedMaterial | null>(null);
  const [replacing, setReplacing] = useState<MatchedMaterial | null>(null);
  const [priceSort, setPriceSort] = useState<PriceSort | null>(null);
  const changeSort = (field: PriceSortField) => setPriceSort((previous) => ({ field, direction: previous?.field === field && previous.direction === "asc" ? "desc" : "asc" }));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const [manualMappingOffer, setManualMappingOffer] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<{ offerId: string; message: string } | null>(null);
  const [operationError, setOperationError] = useState<{ error: FlowError; stage: FlowStage } | null>(null);
  const [matchingWarning, setMatchingWarning] = useState<string | null>(null);
  const [currencyChoice, setCurrencyChoice] = useState<{ offerKey: string; currency: OfferCurrency } | null>(null);
  const inFlight = useRef(false);
  const uploadedFile = useRef<Id<"_storage"> | null>(null);
  const currentOffer = useRef<Id<"oferte"> | null>(null);
  
  const offerKey = `${idGenerare}:${baseValuta}`;
  const displayCurrency = currencyChoice?.offerKey === offerKey ? currencyChoice.currency : baseValuta === "EUR" ? "EUR" : "RON";
  const conversionRate = euroConversionRate(displayCurrency, exchangeRate);
  const eurToRonRate = euroConversionRate("RON", exchangeRate);
  const busy = activeStep !== null || saving || replacing !== null || Boolean(idGenerare && manualMappingOffer === idGenerare) || (Boolean(oferta?.hasMatched) && conversionRate === null);
  const displayedTotal = convertEuroAmount(oferta?.total ?? 0, displayCurrency, exchangeRate);
  const displayCurrencyFormatter = new Intl.NumberFormat("ro-RO", { style: "currency", currency: displayCurrency === "EUR" ? "EUR" : "RON" });
  const hasMappings = Boolean(oferta?.excelMapping) && !oferta?.selectedSheets?.some((name) => !oferta.sheetMappings?.some((entry) => entry.sheetName === name));
  const showStructureCorrection = hasMappings && activeStep === null && !saving
    && manualMappingOffer !== idGenerare && operationError?.error.recovery !== "structure";
  const completed = [Boolean(oferta), hasMappings, Boolean(oferta?.hasExtracted), Boolean(oferta?.hasMatched), Boolean(oferta?.hasMatched) && pendingCount === 0, Boolean(oferta?.downloadUrl)];

  const processFile = async (manualMapping?: ExcelMapping) => {
    if (inFlight.current || !isAuthenticated) return;
    setOperationError(null);
    setMatchingWarning(null);
    inFlight.current = true;
    setActiveStep(idGenerare ? 1 : 0);
    let processingStep = idGenerare ? 1 : 0;
    let offerId = idGenerare ?? currentOffer.current;
    try {
      if (!offerId) {
        if (!excelFile) throw flowError("INVALID_FILE", "Selectează un fișier Excel.");
        if (readingSheets || !selectedSheets.length) throw flowError("INVALID_FILE", "Selectează cel puțin o foaie cu materiale și cantități.");
        setActiveStep(0);
        if (!uploadedFile.current) {
          const uploadUrl = await generateUploadUrl({});
          const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": EXCEL_MIME_TYPE }, body: excelFile });
          if (!response.ok) throw flowError("RETRY", "Fișierul nu a putut fi încărcat. Verifică conexiunea și încearcă din nou.");
          const uploaded: unknown = await response.json();
          if (!uploaded || typeof uploaded !== "object" || !("storageId" in uploaded) || typeof uploaded.storageId !== "string") {
            throw flowError("RETRY", "Încărcarea fișierului nu a fost confirmată. Încearcă din nou.");
          }
          uploadedFile.current = uploaded.storageId as Id<"_storage">;
        }
        offerId = await uploadInputExcel({ storageId: uploadedFile.current, fileName: excelFile.name, selectedSheets });
        currentOffer.current = offerId;
        router.replace(`/generare-ai?oferta=${encodeURIComponent(offerId)}`, { scroll: false });
      }
      let existing = await convex.query(api.oferte.queries.getOferta, { idGenerare: offerId });
      setStructureError(null);
      if (manualMapping) {
        processingStep = 1;
        setActiveStep(1);
        await salveazaStructuraExcel({ idGenerare: offerId, expectedRevision: existing.revision, excelMapping: manualMapping, sheetName: activeSheet });
        existing = await convex.query(api.oferte.queries.getOferta, { idGenerare: offerId });
      }
      if (!existing.excelMapping || existing.selectedSheets?.some((name) => !existing.sheetMappings?.some((entry) => entry.sheetName === name))) {
        processingStep = 1;
        setActiveStep(1);
        await analizaExcel({ idGenerare: offerId });
      }
      if (!existing.hasExtracted && !existing.hasMatched) {
        processingStep = 2;
        setActiveStep(2);
        await extrageMateriale({ idGenerare: offerId });
      }
      setManualMappingOffer(null);
      if (!existing.hasMatched) {
        processingStep = 3;
        setActiveStep(3);
        const result = await cautaPreturi({ idGenerare: offerId });
        if (result.failedCount) setMatchingWarning(`Prețurile nu au putut fi căutate pentru ${result.failedCount} materiale. Verifică rândurile marcate „Eroare la căutare” și completează manual prețurile înainte de validare.`);
      }
    } catch (caught) {
      const stage: FlowStage = processingStep === 0 ? "upload" : processingStep === 1 ? "analysis" : processingStep === 2 ? "extraction" : "matching";
      const error = getFlowError(caught, stage);
      setOperationError({ error, stage });
      if (offerId && error.recovery === "structure") {
        if (error.sheetName) setSheetChoice(error.sheetName);
        setStructureError({ offerId, message: error.message });
        setManualMappingOffer(offerId);
      }
    } finally {
      inFlight.current = false;
      setActiveStep(null);
    }
  };

  const validate = async (material: MaterialEdit) => {
    if (!idGenerare || !oferta || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setOperationError(null);
    try {
      await valideazaMaterial({ idGenerare, expectedRevision: oferta.revision ?? 0, rand: material.rand, sheetName: material.sheetName,
        cantitate: material.cantitate, pretAchizitie: material.pretAchizitie, pretVanzare: material.pretVanzare, manopera: material.manopera });
      setEditing(null);
      setIsDrawerOpen(false);
      const id = toast.success("Material validat cu succes.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
    } catch (caught) {
      setOperationError({ error: getFlowError(caught, "validation"), stage: "validation" });
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  };

  const bulkValidate = async () => {
    if (!idGenerare || !oferta || inFlight.current || editing || !validQuality) return;
    inFlight.current = true;
    setSaving(true);
    setBulkValidating(true);
    setOperationError(null);
    try {
      const result = await valideazaMaterialeDupaCalitate({ idGenerare, expectedRevision: oferta.revision, minimumQuality, sheetName: activeSheet });
      toast.success(result.validatedCount ? `${result.validatedCount} materiale validate cu succes.` : "Nu există materiale eligibile pentru pragul ales.");
    } catch (caught) {
      setOperationError({ error: getFlowError(caught, "bulkValidation"), stage: "bulkValidation" });
    } finally {
      setSaving(false);
      setBulkValidating(false);
      inFlight.current = false;
    }
  };

  const deleteMaterial = async (material: MatchedMaterial) => {
    if (!idGenerare || !oferta || inFlight.current || editing) return;
    inFlight.current = true;
    setSaving(true);
    setOperationError(null);
    try {
      await stergeMaterial({ idGenerare, expectedRevision: oferta.revision, rand: material.rand, sheetName: material.sheetName });
      setFailedDeletion(null);
      toast.success("Material șters din ofertă.");
    } catch (caught) {
      setFailedDeletion(material);
      setOperationError({ error: getFlowError(caught, "deletion"), stage: "deletion" });
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  };

  const handleEditStart = (material: MatchedMaterial) => {
    setEditing(material);
    setIsDrawerOpen(true);
  };

  const exportFile = async (allowUnvalidated = false) => {
    if (!idGenerare || inFlight.current || editing || !oferta?.hasMatched || !materialCount) return;
    if (pendingCount && !allowUnvalidated) { setExportConfirmationOpen(true); return; }
    setExportConfirmationOpen(false);
    inFlight.current = true;
    setActiveStep(5);
    setOperationError(null);
    try {
      const generated = await genereazaExcel({ idGenerare, allowUnvalidated });
      const id = toast.success("Excel generat cu succes.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
      try {
        if (!generated.downloadUrl) throw new Error("Missing download URL");
        const response = await fetch(generated.downloadUrl);
        if (!response.ok) throw new Error("Download failed");
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = generated.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        toast.danger("Excelul a fost generat, dar descărcarea automată a eșuat. Folosește butonul „Descarcă Excel”.");
      }
    } catch (caught) {
      const error = getFlowError(caught, "export");
      setOperationError({ error, stage: "export" });
      if (error.recovery === "structure") {
        if (error.sheetName) setSheetChoice(error.sheetName);
        setStructureError({ offerId: idGenerare, message: error.message });
        setManualMappingOffer(idGenerare);
      }
    } finally {
      inFlight.current = false;
      setActiveStep(null);
    }
  };

  if (authLoading) return <main role="status" className="p-8 text-center">Se verifică autentificarea...</main>;
  if (!isAuthenticated) return <main className="mx-auto max-w-5xl px-4 py-10"><OfertaFlowError error={getFlowError(flowError("AUTH", "Conectează-te pentru a genera sau relua o ofertă."), "load")} /></main>;
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
        <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-8 sm:py-14">
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
            {idGenerare && (
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
            )}
            {idGenerare ? (
              null
            ) : <ExcelDropzone file={excelFile} disabled={busy || readingSheets} canAnalyze={selectedSheets.length > 0 && !fileError} onFileSelected={(file) => {
              uploadedFile.current = null;
              currentOffer.current = null;
              setExcelFile(file);
              setOperationError(null);
              setFileSheets([]);
              setSelectedSheets([]);
              setFileError("");
              if (!file) return;
              setReadingSheets(true);
              void (async () => {
                try {
                  const XLSX = await import("xlsx");
                  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", bookSheets: true });
                  if (!workbook.SheetNames.length) throw new Error("Fișierul nu conține foi Excel.");
                  setFileSheets(workbook.SheetNames);
                  setSelectedSheets(workbook.SheetNames.length === 1 ? workbook.SheetNames : []);
                } catch {
                  setFileError("Nu am putut citi foile. Selectează un fișier .xlsx valid.");
                } finally {
                  setReadingSheets(false);
                }
              })();
            }} onAnalyze={() => { void processFile(); }}>
              {readingSheets && <p role="status" className="mt-3 text-sm text-muted-foreground">Se citesc foile Excel...</p>}
              {fileError && <p role="alert" className="mt-3 text-sm text-danger">{fileError}</p>}
              {fileSheets.length > 1 && <fieldset className="my-4 rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold">Ce foi conțin materiale și cantități?</legend>
                <p className="mb-3 text-sm text-muted-foreground">Selectează foile de analizat. Fiecare foaie va fi analizată separat.</p>
                <div className="flex flex-wrap gap-3">
                  {fileSheets.map((name) => <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={selectedSheets.includes(name)} disabled={busy}
                      onChange={(event) => setSelectedSheets((current) => event.target.checked ? fileSheets.filter((sheet) => sheet === name || current.includes(sheet)) : current.filter((sheet) => sheet !== name))} />
                    {name}
                  </label>)}
                </div>
                {!selectedSheets.length && <p className="mt-3 text-sm text-muted-foreground">Selectează cel puțin o foaie pentru a continua.</p>}
              </fieldset>}
            </ExcelDropzone>}
            <p role="status" className="mb-4 min-h-5 text-sm text-muted-foreground">
              {activeStep !== null ? `${steps[activeStep]} în curs...` : saving ? "Se salvează modificările..." : ""}
            </p>
            {activeStep === 3 && <div className="mb-6 rounded-xl border border-border bg-secondary/40 p-4">
              <p role="status" aria-live="polite" className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Spinner size="sm" />
                {oferta?.matchingProgress?.status === "running" || oferta?.matchingProgress?.status === "completed" ? oferta.matchingProgress.completed : 0}
                {" din "}{oferta?.matchingProgress?.total ?? oferta?.extractedCount ?? 0} materiale procesate
              </p>
              <progress className="h-2 w-full accent-accent" aria-label="Progresul căutării potrivirilor"
                value={oferta?.matchingProgress?.status === "running" || oferta?.matchingProgress?.status === "completed" ? oferta.matchingProgress.completed : 0}
                max={Math.max(1, oferta?.matchingProgress?.total ?? oferta?.extractedCount ?? 0)} />
              <p className="mt-2 text-xs text-muted-foreground">Se caută referințe și prețuri pentru fiecare material. Procesarea listelor mari poate dura câteva minute.</p>
            </div>}
            {operationError && !(operationError.error.recovery === "structure" && manualMappingOffer === idGenerare) && !(operationError.stage === "validation" && isDrawerOpen) && <OfertaFlowError
              error={operationError.error} disabled={activeStep !== null || saving}
              onRetry={() => {
                if (operationError.stage === "export") void exportFile();
                else if (operationError.stage === "bulkValidation") void bulkValidate();
                else if (operationError.stage === "deletion" && failedDeletion) void deleteMaterial(failedDeletion);
                else if (operationError.stage === "validation" && editing) void validate(editing);
                else void processFile();
              }}
              onStructure={idGenerare ? () => {
                if (operationError.error.sheetName) setSheetChoice(operationError.error.sheetName);
                setStructureError({ offerId: idGenerare, message: operationError.error.message });
                setManualMappingOffer(idGenerare);
              } : undefined}
              onNewFile={() => {
                uploadedFile.current = null;
                currentOffer.current = null;
                setExcelFile(null);
                setFileSheets([]);
                setSelectedSheets([]);
                setFileError("");
                setOperationError(null);
                setManualMappingOffer(null);
                setStructureError(null);
              }} />}
            {matchingWarning && <p role="alert" className="my-4 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">{matchingWarning}</p>}
            {idGenerare && (showStructureCorrection || (oferta?.selectedSheets?.length ?? 0) > 1) && <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {oferta?.selectedSheets && oferta.selectedSheets.length > 1 && <ExcelSheetSelect sheets={oferta.selectedSheets} value={activeSheet}
                disabled={activeStep !== null || saving || editing !== null} onChange={setSheetChoice} />}
              {showStructureCorrection && <div className="flex flex-1 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Coloanele au fost identificate greșit?</p>
                <Button variant="secondary" isDisabled={activeStep !== null || saving || editing !== null} onPress={() => setManualMappingOffer(idGenerare)}>
                  <Pencil className="size-4" aria-hidden="true" />Corectează structura Excelului
                </Button>
              </div>}
            </div>}
            {idGenerare && (
              manualMappingOffer === idGenerare ? (
                <div hidden={activeStep !== null}>
                <ManualExcelMapping key={`${idGenerare}:${activeSheet}:${oferta?.revision ?? 0}`} initialMapping={activeMapping} sheetName={activeSheet}
                  disabled={activeStep !== null || saving} hasResults={Boolean(oferta?.hasExtracted || oferta?.hasMatched)}
                  error={structureError?.offerId === idGenerare ? structureError.message : undefined}
                  onSubmit={processFile} onCancel={() => { setManualMappingOffer(null); setStructureError(null); }} />
                </div>
              ) : null
            )}
            {idGenerare && activeStep === null && !operationError && !oferta?.hasMatched && manualMappingOffer !== idGenerare && (
              <div className="flex justify-center">
                <Button isDisabled={busy || !isAuthenticated || !oferta} onPress={() => { void processFile(); }}>
                  {busy ? <Spinner size="sm" /> : <Sparkles className="size-4" />}
                  Reia procesarea
                </Button>
              </div>
            )}
            
            <AlertDialog isOpen={exportConfirmationOpen} onOpenChange={setExportConfirmationOpen}>
              <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
                <AlertDialog.Container><AlertDialog.Dialog>
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning" />
                    <AlertDialog.Heading>Generezi Excelul cu materiale nevalidate?</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p>Oferta conține {pendingCount} materiale nevalidate, din toate foile selectate. Excelul va include cantitățile și prețurile curente, inclusiv valori zero pentru materialele fără prețuri completate.</p>
                    <p className="mt-2">Materialele vor rămâne nevalidate și le poți verifica ulterior.</p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="secondary" slot="close">Continuă validarea</Button>
                    <Button onPress={() => { void exportFile(true); }} isDisabled={busy || editing !== null || !oferta?.materialsReady || !materialCount}>Confirmă generarea</Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog></AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
            {replacing && idGenerare && oferta && <ReplaceOfferMaterial
              key={JSON.stringify([idGenerare, replacing.sheetName, replacing.rand])} material={replacing}
              idGenerare={idGenerare} revision={oferta.revision} onClose={() => setReplacing(null)} />}
            <Drawer isOpen={isDrawerOpen} onOpenChange={(open) => {
              setIsDrawerOpen(open);
              if (!open) {
                setEditing(null);
              }
            }}>
              <Drawer.Backdrop>
                <Drawer.Content placement="right">
                  <Drawer.Dialog>
                    <Drawer.Header>
                      <Drawer.Heading className="flex flex-row items-center gap-2 text-blue-500"><Pencil className="size-4 text-blue-500" aria-hidden="true" />Corectare material · Rând {editing?.rand}</Drawer.Heading>
                    </Drawer.Header>
                    <Drawer.Body>
                      {operationError?.stage === "validation" && <OfertaFlowError error={operationError.error} disabled={saving}
                        onRetry={editing ? () => { void validate(editing); } : undefined} />}
                      {editing && !hasValidPrices(editing) && <p role="alert" className="mb-4 text-sm text-danger">Verifică toate câmpurile: cantitatea și prețurile trebuie să fie numere finite, pozitive sau zero.</p>}
                      <Fieldset className="w-full gap-6">
                        <FieldGroup className="gap-6 flex flex-col">
                          {priceFields.map(({ name, label }) => (
                            <NumberField 
                              key={name}
                              isRequired 
                              minValue={0} 
                              step={0.01} 
                              value={editing ? editing[name] * (name === "cantitate" ? 1 : conversionRate ?? 1) : 0}
                              isDisabled={saving || conversionRate === null}
                              formatOptions={{ maximumFractionDigits: 4 }}
                              onChange={(value) => {
                                if (!editing || conversionRate === null) return;
                                const updated = { ...editing, [name]: value / (name === "cantitate" ? 1 : conversionRate) };
                                if (name === "pretAchizitie" && salePrice(editing) === editing.pretAchizitie * SALE_PRICE_MULTIPLIER) {
                                  updated.pretVanzare = updated.pretAchizitie * SALE_PRICE_MULTIPLIER;
                                }
                                setEditing(updated);
                              }}
                            >
                              <Label>{name === "cantitate" ? label : `${label} (${displayCurrency})`}</Label>
                              <NumberField.Group className="border border-border focus-within:ring-2 focus-within:ring-accent">
                                <NumberField.DecrementButton aria-label={`Scade ${label.toLowerCase()}`} />
                                <NumberField.Input className="min-w-0 tabular-nums" />
                                <NumberField.IncrementButton aria-label={`Crește ${label.toLowerCase()}`} />
                              </NumberField.Group>
                              <FieldError />
                            </NumberField>
                          ))}
                        </FieldGroup>
                      </Fieldset>
                    </Drawer.Body>
                    <Drawer.Footer>
                      <Button slot="close" variant="secondary" isDisabled={saving}>
                        Anulează
                      </Button>
                      <Button onPress={() => { if (editing) void validate(editing); }} isDisabled={saving || !editing || !hasValidPrices(editing)}>
                        {saving ? <Spinner size="sm" /> : <Check className="size-4" />}Salvează și validează
                      </Button>
                    </Drawer.Footer>
                  </Drawer.Dialog>
                </Drawer.Content>
              </Drawer.Backdrop>
            </Drawer>
            
            {oferta?.hasMatched && (
              <section aria-label="Preview ofertă" className="min-w-0">
                {oferta.needsExportRefresh && <p role="status" className="mb-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm">Formatul exportului a fost actualizat. Generează din nou Excelul pentru a aplica culorile textului și a elimina bordurile și coloana Total final. Materialele și validările sunt păstrate.</p>}
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Materiale și prețuri</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{materialCount} materiale în ofertă{activeSheet ? ` · Foaia „${activeSheet}”` : ""}</p>
                  </div>
                  <Button variant="secondary" onPress={() => setCurrencyChoice({ offerKey, currency: displayCurrency === "EUR" ? "RON" : "EUR" })} className="flex flex-col items-end gap-1">
                    <p className="text-xs text-muted-foreground">Total ofertă · vânzare + manoperă</p>
                    <p className="text-xl font-semibold tabular-nums">{displayedTotal === null ? "—" : displayCurrencyFormatter.format(displayedTotal)}</p>
                  </Button>
                </div>
                {displayCurrency === "RON" && eurToRonRate === null && (
                  <p role="status" className="mb-3 text-sm text-warning">{exchangeRate === undefined ? "Se încarcă cursul EUR/RON..." : "Cursul EUR/RON nu este disponibil. Totalul poate fi afișat în EUR."} {exchangeRate !== undefined && <Link href="/preturi" className="underline">Verifică cursul valutar</Link>}</p>
                )}
                <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <div className="mb-4 flex flex-row gap-5">
                    <Checkbox className="flex flex-row items-center gap-2" isSelected={onlyPending} onChange={setOnlyPending} isDisabled={busy || editing !== null}>
                      <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                      <Checkbox.Content><Label>Afișează doar materiale nevalidate</Label></Checkbox.Content>
                    </Checkbox>
                    <p role="status" className={`text-sm ${pendingCount ? "text-warning" : "text-success"}`}>
                      {!materialCount ? "Nu există materiale de exportat." : pendingCount ? `${pendingCount} materiale necesită validare` : "Toate materialele sunt validate"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  {oferta.downloadUrl && !editing && (
                    <a href={oferta.downloadUrl} download={oferta.excelOutput?.fileName} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary">
                        <Download className="size-4" />Descarcă Excel
                      </Button>
                    </a>
                  )}
                    <Button isDisabled={busy || editing !== null || !oferta.materialsReady || !materialCount} onPress={() => { void exportFile(); }}>
                      {activeStep === 5 ? <Spinner size="sm" /> : <Sheet className="size-4" />}{oferta.excelOutput ? "Regenerează Excel" : "Generează Excel"}
                    </Button>
                  </div>
                </div>
                {pendingCount > 0 && <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-secondary/40 p-4">
                  <label className="flex flex-col gap-1 text-sm font-medium">Calitate minimă (1–10)
                    <Input type="number" min={1} max={10} step={0.1} aria-label="Calitate minimă pentru validare multiplă"
                      className="w-28 border border-border" value={Number.isFinite(minimumQuality) ? minimumQuality : ""}
                      disabled={busy || editing !== null} onChange={(event) => setMinimumQuality(event.target.value === "" ? NaN : Number(event.target.value))} />
                  </label>
                  <Button variant="secondary" isDisabled={busy || editing !== null || !oferta.materialsReady || !validQuality || !bulkValidationCount}
                    onPress={() => { void bulkValidate(); }}>
                    {bulkValidating ? <Spinner size="sm" /> : <Check className="size-4" />}
                    Validează {bulkValidationCount ?? 0} materiale cu calitate ≥ {validQuality ? minimumQuality : "—"}
                  </Button>
                  <p role={validQuality ? "status" : "alert"} className={`w-full text-xs ${validQuality ? "text-muted-foreground" : "text-danger"}`}>
                    {validQuality ? `Se aplică tuturor paginilor${activeSheet ? ` din foaia „${activeSheet}”` : ""}. Materialele fără potrivire, cu erori sau cu valori nevalide necesită verificare manuală.` : "Alege o calitate minimă între 1 și 10."}
                  </p>
                </div>}
                {!oferta.materialsReady ? <PrepareMaterialPages key={oferta._id} idGenerare={oferta._id} /> : materialCount === 0 ? <p role="status" className="border-y border-border py-8 text-sm text-muted-foreground">Toate materialele au fost șterse din ofertă. Nu există materiale de exportat.</p> : onlyPending && pendingCount === 0 ? <p role="status" className="border-y border-border py-8 text-sm text-success">Nu mai există materiale de validat.</p> : (
                  <MaterialePages key={`${oferta._id}:${activeSheet}:${onlyPending}:${priceSort?.field}:${priceSort?.direction}`} idGenerare={oferta._id} sheetName={activeSheet} pendingOnly={onlyPending} busy={busy} editing={editing} setEditing={handleEditStart} onValidate={validate} onDelete={deleteMaterial} onReplace={setReplacing} sort={priceSort} onSort={changeSort} conversionRate={conversionRate} displayCurrency={displayCurrency} displayCurrencyFormatter={displayCurrencyFormatter} />
                )}
              </section>
            )}
        </main>
  );
}
