"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Button, Input, Label, Modal, Slider, Spinner, Table, ToggleButton, toast } from "@heroui/react";
import { Search, TextSearch, VectorPolygon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchedMaterial } from "../../convex/oferte/review";
import { getFlowError } from "../../convex/oferte/errors";
import { salePrice } from "../../convex/material_prices";
import { normalizeMaterialDescription } from "../../convex/lib/material_description";
import type { MaterialHit } from "@/types";
import { searchTypesense, vectorSearchTypesense, hybridSearchTypesense } from "@/lib/typesense/client";
import { getEmbedding } from "@/lib/open-webui/client";
import { currency } from "@/lib/currency";
import ExpandableText from "./expandable-text";
import { CursorPagination } from "./cursor-pagination";

const PER_PAGE = 9;

export default function ReplaceOfferMaterial({ material, idGenerare, revision, onClose }: {
  material: MatchedMaterial; idGenerare: Id<"oferte">; revision: number; onClose: () => void;
}) {
  const replace = useMutation(api.oferte.mutations.schimbaMaterial);
  const [query, setQuery] = useState(material.descriereOriginala);
  const [textSearch, setTextSearch] = useState(true);
  const [vectorSearch, setVectorSearch] = useState(true);
  const [alpha, setAlpha] = useState(50);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<MaterialHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const alphaSliderProps = {
    value: alpha,
    isDisabled: saving,
    onChange: (value: number | number[]) => { setAlpha(Array.isArray(value) ? value[0] : value); setPage(1); },
  };

  useEffect(() => {
    let cancelled = false;
    const search = async () => {
      setLoading(true);
      setSearchError("");
      setResults([]);
      try {
        const value = normalizeMaterialDescription(query);
        if (!value) { setTotal(0); return; }
        const response = vectorSearch
          ? textSearch
            ? await hybridSearchTypesense<MaterialHit>("materiale", value, await getEmbedding(value), alpha, "embedding", page, PER_PAGE, true)
            : await vectorSearchTypesense<MaterialHit>("materiale", await getEmbedding(value), "embedding", page, PER_PAGE, true)
          : await searchTypesense<MaterialHit>("materiale", value, "descriere", page, PER_PAGE);
        if (cancelled) return;
        setResults(response.results);
        setTotal(response.total);
      } catch {
        if (!cancelled) { setTotal(0); setSearchError("Căutarea nu este disponibilă momentan. Încearcă din nou."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    // Hide the previous query's results immediately; debounce requests while typing.
    void Promise.resolve().then(() => { if (!cancelled) setLoading(true); });
    const timer = setTimeout(() => { void search(); }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, textSearch, vectorSearch, alpha, page, attempt]);

  const choose = async (selected: MaterialHit) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await replace({ idGenerare, expectedRevision: revision, rand: material.rand, sheetName: material.sheetName,
        descriere: selected.descriere, pretAchizitie: selected.pretAchizitie, pretVanzare: selected.pretVanzare ?? 0, manopera: selected.manopera });
      toast.success("Materialul asociat a fost schimbat. Verifică prețurile și validează rândul.");
      onClose();
    } catch (caught) {
      setSaveError(getFlowError(caught, "replacement").message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <Modal isOpen onOpenChange={(open) => { if (!open && !savingRef.current) onClose(); }}>
    <Modal.Backdrop isDismissable={!saving} isKeyboardDismissDisabled={saving}>
      <Modal.Container size="cover"><Modal.Dialog>
        <Modal.Header>
          <Modal.Heading>Schimbă materialul asociat · Rând {material.rand}</Modal.Heading>
          <p className="mt-2 text-sm text-muted-foreground">{material.descriereOriginala}</p>
        </Modal.Header>
        <Modal.Body className="space-y-4">
          <form className="flex w-full flex-row items-end gap-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setAttempt((value) => value + 1); }}>
            <Input autoFocus aria-label="Caută material în catalog" placeholder="Caută după descriere..." value={query} disabled={saving}
              className="h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-3 focus-visible:ring-2 focus-visible:ring-accent" onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            {textSearch && vectorSearch && <Slider className="w-[100px] max-w-xs shrink-0" {...alphaSliderProps}>
              <Label>Alpha</Label>
              <Slider.Output />
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>}
            <ToggleButton aria-label="Căutare text" className="size-12 shrink-0 rounded-full" isSelected={textSearch} isDisabled={saving} onChange={(selected) => {
              setTextSearch(selected); if (!selected) setVectorSearch(true); setPage(1);
            }}><TextSearch className="size-5" /></ToggleButton>
            <ToggleButton aria-label="Căutare vectorială" className="size-12 shrink-0 rounded-full" isSelected={vectorSearch} isDisabled={saving} onChange={(selected) => {
              setVectorSearch(selected); if (!selected) setTextSearch(true); setPage(1);
            }}><VectorPolygon className="size-5" /></ToggleButton>
            <Button type="submit" isIconOnly aria-label="Caută" className="size-12 shrink-0 rounded-full" isDisabled={saving || !query.trim()}><Search className="size-5" /></Button>
          </form>
          {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
          {searchError && <div role="alert" className="text-sm text-danger">{searchError} <Button size="sm" variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Reîncearcă</Button></div>}
          {loading ? <p role="status" className="flex items-center justify-center gap-2 py-8"><Spinner size="sm" />Se caută materiale...</p>
            : !searchError && <>
              <p role="status" className="text-sm text-muted-foreground">{total} rezultate · Prețuri în EUR</p>
              {!results.length ? <p className="py-6 text-sm">Nu s-au găsit materiale. Modifică denumirea sau opțiunile de căutare.</p> : <Table><Table.ScrollContainer>
                <Table.Content aria-label="Alege materialul din catalog" className="min-w-[620px]">
                  <Table.Header><Table.Column isRowHeader>Descriere</Table.Column><Table.Column>Achiziție</Table.Column><Table.Column>Vânzare</Table.Column><Table.Column>Manoperă</Table.Column><Table.Column>Acțiuni</Table.Column></Table.Header>
                  <Table.Body>{results.map((item, index) => <Table.Row key={item.id ?? index}>
                    <Table.Cell className="max-w-80 whitespace-normal"><ExpandableText text={item.descriere} /></Table.Cell>
                    <Table.Cell>{currency.format(item.pretAchizitie)}</Table.Cell><Table.Cell>{currency.format(salePrice(item))}</Table.Cell><Table.Cell>{currency.format(item.manopera)}</Table.Cell>
                    <Table.Cell><Button size="sm" isDisabled={saving} aria-label={`Alege ${item.descriere}`} onPress={() => { void choose(item); }}>Alege</Button></Table.Cell>
                  </Table.Row>)}</Table.Body>
                </Table.Content>
              </Table.ScrollContainer></Table>}
              {total > PER_PAGE && <CursorPagination page={page} pageCount={Math.ceil(total / PER_PAGE)} setPage={setPage} loading={loading} disabled={saving} />}
            </>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" isDisabled={saving} onPress={onClose}>Închide</Button>{saving && <Spinner size="sm" />}</Modal.Footer>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
