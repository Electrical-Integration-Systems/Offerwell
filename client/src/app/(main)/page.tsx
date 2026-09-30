"use client";

import type { MaterialHit } from "@/types";

import { useRef, useState, useEffect } from "react";
import { CursorPagination, PAGE_SIZE } from "@/components/cursor-pagination";
import { PackageSearch, Search, Pencil, VectorPolygon, TextSearch } from "lucide-react"; 
import { searchTypesense, vectorSearchTypesense, hybridSearchTypesense, getNumarMateriale } from "@/lib/typesense/client";
import { getEmbedding } from "@/lib/open-webui/client";
import { PolaroidStrip } from "@/components/react-bits/PolaroidStrip";
import { 
  Button, Chip, Form, SearchField, Spinner,
  TextField, TextArea, NumberField, Label,
  Fieldset, FieldGroup, Drawer, AlertDialog,
  FieldError, ToggleButton, Slider, toast
} from "@heroui/react";
import { MaterialeTable } from "@/components/materiale/MaterialeTable";

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MaterialHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingData, setEditingData] = useState<MaterialHit | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialHit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [numarMateriale, setNumarMateriale] = useState<number | null>(null);

  const [vectorSearch, setVectorSearch] = useState(true);
  const [textSearch, setTextSearch] = useState(true);
  const [alphaHybridSearch, setAlphaHybridSearch] = useState(50);
  
  useEffect(() => {
    const fetchNumarMateriale = async () => {
      try {
        const count = await getNumarMateriale();
        setNumarMateriale(count);
      } catch (err) {
        console.error("Nu s-a putut prelua numarul de materiale: ", err);
      }
    };
    fetchNumarMateriale();
  }, []);

  const requestId = useRef(0);

  const performSearch = async (value: string, page: number = 1) => {
    if (!value.trim()) {
      setSearchResults([]);
      setSearchedQuery("");
      setIsSearching(false);
      setCurrentPage(1);
      setTotalResults(0);
      return;
    }
    
    const currentRequest = ++requestId.current;
    setIsSearching(true);
    try {
      if (vectorSearch && textSearch) {
        const { results, total, page: resultPage } = await hybridSearchTypesense<MaterialHit>("materiale", value, await getEmbedding(value), alphaHybridSearch,  "embedding", page, PAGE_SIZE);
        if (currentRequest !== requestId.current) return;
        setSearchResults(results);

        console.log(results);

        setSearchedQuery(value);
        setCurrentPage(resultPage);
        setTotalResults(total);
        return;
      } else if (vectorSearch) {
        const { results, total, page: resultPage } = await vectorSearchTypesense<MaterialHit>("materiale", await getEmbedding(value), "embedding", page, PAGE_SIZE);
        if (currentRequest !== requestId.current) return;
        setSearchResults(results);

        console.log(results);

        setSearchedQuery(value);
        setCurrentPage(resultPage);
        setTotalResults(total);
        return;
      } else {
        const { results, total, page: resultPage } = await searchTypesense<MaterialHit>("materiale", value, "descriere", page, PAGE_SIZE);
        if (currentRequest !== requestId.current) return;
        setSearchResults(results);
        setSearchedQuery(value);
        setCurrentPage(resultPage);
        setTotalResults(total);
        return;
      }
    } catch {
      if (currentRequest === requestId.current) {
        const id = toast.danger("Căutarea nu este disponibilă momentan. Încearcă din nou.", {
          actionProps: {
            children: "Dismiss",
            onPress: () => toast.close(id)
          }
        });
      }
    } finally {
      if (currentRequest === requestId.current) setIsSearching(false);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    await performSearch(query, 1);
  };

  const handleFacetSelect = (facetQuery: string) => {
    setQuery(facetQuery);
    setCurrentPage(1);
    performSearch(facetQuery, 1);
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    performSearch(query, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyPrice = async (price: number, index: number, field: string) => {
    try {
      await navigator.clipboard.writeText(price.toString());
      setCopiedField(`${index}-${field}`);
      
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (err) {
      console.error("Nu s-a putut copia pretul: ", err);
    }
  };

  const handleEditStart = (material: MaterialHit) => {
    setEditingData(material);
    setIsDrawerOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingData || !editingData.id) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch("/api/material", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingData.id, ...editingData }),
      });
      
      if (!response.ok) {
        try {
          const result = await response.json();
          throw new Error(result.error || "Materialul nu a putut fi editat.");
        } catch (parseErr) {
          throw new Error("Materialul nu a putut fi editat.");
        }
      }
      
      try {
        await response.json();
      } catch (parseErr) {
        console.error("Failed to parse response:", parseErr);
      }
      
      setSearchResults(searchResults.map(m => m.id === editingData.id ? editingData : m));
      setIsDrawerOpen(false);
      setEditingData(null);
      
      const id = toast.success("Material actualizat cu succes.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
    } catch (err) {
      const id = toast.danger(err instanceof Error ? err.message : "Editarea a eșuat. Încearcă din nou.", {
        actionProps: {
          children: "Dismiss",
          onPress: () => toast.close(id)
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStart = (material: MaterialHit) => {
    setDeletingMaterial(material);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMaterial || !deletingMaterial.id) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch("/api/material", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingMaterial.id }),
      });
      
      if (!response.ok) {
        try {
          const result = await response.json();
          throw new Error(result.error || "Materialul nu a putut fi șters.");
        } catch (parseErr) {
          throw new Error("Materialul nu a putut fi șters.");
        }
      }
      
      try {
        await response.json();
      } catch (parseErr) {
        console.error("Failed to parse response:", parseErr);
      }
      
      setSearchResults(searchResults.filter(m => m.id !== deletingMaterial.id));
      setDeleteConfirmOpen(false);
      setDeletingMaterial(null);
      
      const id = toast.success("Material șters cu succes.");
    } catch (err) {
      const id = toast.danger(err instanceof Error ? err.message : "Ștergerea a eșuat. Încearcă din nou.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVectorSearch = (enabled: boolean) => {
    setVectorSearch(enabled);

    if (!enabled && !textSearch) {
      setTextSearch(true);
    }
  };

  const handleToggleTextSearch = (enabled: boolean) => {
    setTextSearch(enabled);

    if (!enabled && !vectorSearch) {
      setVectorSearch(true);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col md:flex-row mb-10 border-b border-border pb-6 justify-between gap-6 md:gap-0">
        <div className="flex-shrink-0">
          <p className="mb-2 text-sm font-medium text-accent whitespace-nowrap">
            Catalog{numarMateriale !== null && ` - Total: ${numarMateriale}`}
          </p>
          <h1 className="text-3xl font-semibold">Materiale</h1>
        </div>
        <div className="flex flex-row items-center gap-3 overflow-visible">
          <PolaroidStrip onSelect={handleFacetSelect} />
        </div>
      </div>
      <Form onSubmit={handleSearch} className="mb-8 flex w-full flex-row items-end gap-3">
        <SearchField aria-label="Caută material" value={query} onChange={(value) => {
          setQuery(value);
          setCurrentPage(1);
          performSearch(value, 1);
        }} className="min-w-0 flex-1">
          <SearchField.Group className="h-12 border border-border bg-surface focus-within:ring-2 focus-within:ring-accent rounded-full px-3">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Caută după descriere..." />
            <SearchField.ClearButton aria-label="Șterge căutarea" />
          </SearchField.Group>
        </SearchField>
        {textSearch && vectorSearch && (
          <Slider className="w-[100px] max-w-xs" defaultValue={50} onChange={(value) => setAlphaHybridSearch(Array.isArray(value) ? value[0] : value)}>
            <Label>Alpha</Label>
            <Slider.Output />
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        )}
        <ToggleButton
          aria-label="Toggle Vector Search" className="size-12 rounded-full" isSelected={textSearch} onChange={(selected) => handleToggleTextSearch(selected)}
        ><TextSearch className="size-5" /></ToggleButton>
        <ToggleButton
          aria-label="Toggle Vector Search" className="size-12 rounded-full" isSelected={vectorSearch} onChange={(selected) => handleToggleVectorSearch(selected)}
        ><VectorPolygon className="size-5" /></ToggleButton>
        <Button type="submit" isIconOnly aria-label="Caută" isDisabled={!query.trim() || isSearching} className="size-12 rounded-full">
          {isSearching ? <Spinner size="sm" /> : <Search className="size-5" />}
        </Button>
      </Form>

      <section aria-label="Rezultate" aria-busy={isSearching}>
        <div role="status" aria-live="polite">
          {isSearching && <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner size="sm" />Se caută materiale...</div>}
          {searchedQuery && <div className="mb-5 flex flex-wrap items-center gap-3"><h2 className="min-w-0 break-words text-lg font-medium">Rezultate pentru „{searchedQuery}"</h2><Chip variant="soft">{totalResults}</Chip></div>}
        </div>

        {!isSearching && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted">
            <PackageSearch className="size-12 stroke-1 text-accent" aria-hidden="true" />
            <p>{searchedQuery ? "Nu s-au găsit materiale." : "Catalog de materiale"}</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <MaterialeTable
            searchResults={searchResults} 
            copiedField={copiedField} 
            handleCopyPrice={handleCopyPrice}
            onEditStart={handleEditStart}
            onDeleteStart={handleDeleteStart}
          />
        )}

        {searchResults.length > 0 && totalResults > PAGE_SIZE && (
          <CursorPagination 
            page={currentPage}
            pageCount={Math.ceil(totalResults / PAGE_SIZE)}
            setPage={handlePageChange}
            loading={isSearching}
            disabled={isSearching}
          />
        )}
        
        <Drawer isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <Drawer.Backdrop>
            <Drawer.Content placement="right">
              <Drawer.Dialog>
                <Drawer.Header>
                  <Drawer.Heading className="flex flex-row items-center gap-2 text-blue-500"><Pencil className="size-4 text-blue-500" aria-hidden="true" />Editează material</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <Fieldset className="w-full gap-6">
                    <FieldGroup className="gap-6 flex flex-col">
                      <TextField isRequired name="descriere" maxLength={500} validate={(value) => value.trim().length < 3 ? "Descrierea trebuie să aibă cel puțin 3 caractere." : null}>
                        <Label>Descriere</Label>
                        <TextArea 
                          value={editingData?.descriere || ""} 
                          onChange={(e) => setEditingData({ ...editingData!, descriere: e.target.value })}
                          placeholder="Descriere material" 
                          rows={5} 
                          className="focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <FieldError />
                      </TextField>
                      <div className="flex flex-col gap-2 items-center justify-between">
                        {(["pretAchizitie", "pretVanzare", "manopera"] as const).map((field) => {
                          const labels: Record<string, string> = {
                            pretAchizitie: "Preț achiziție",
                            pretVanzare: "Preț vânzare",
                            manopera: "Manoperă",
                          };
                          return (
                            <NumberField 
                              key={field}
                              isRequired 
                              minValue={0} 
                              maxValue={2147483647} 
                              step={1} 
                              value={editingData?.[field] || 0} 
                              onChange={(value) => setEditingData((current) => ({ ...current!, [field]: value }))}
                              className="min-w-0"
                            >
                              <Label>{labels[field]} (€)</Label>
                              <NumberField.Group className="border border-border focus-within:ring-2 focus-within:ring-accent">
                                <NumberField.DecrementButton aria-label={`Scade ${labels[field].toLowerCase()}`} />
                                <NumberField.Input className="min-w-0 tabular-nums" />
                                <NumberField.IncrementButton aria-label={`Crește ${labels[field].toLowerCase()}`} />
                              </NumberField.Group>
                              <FieldError />
                            </NumberField>
                          );
                        })}
                      </div>
                    </FieldGroup>
                  </Fieldset>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button slot="close" variant="secondary" isDisabled={isSaving}>
                    Anulează
                  </Button>
                  <Button slot="close" onPress={handleEditSave} isDisabled={isSaving}>
                    {isSaving ? <Spinner size="sm" /> : "Salvează"}
                  </Button>
                </Drawer.Footer>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <AlertDialog isOpen={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialog.Backdrop>
            <AlertDialog.Container>
              <AlertDialog.Dialog className="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>Șterge materialul?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    Aceasta va șterge permanent <strong>{deletingMaterial?.descriere}</strong> și toate datele sale. Această acțiune nu poate fi anulată.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="secondary" isDisabled={isDeleting}>
                    Anulează
                  </Button>
                  <Button slot="close" variant="danger" onPress={handleDeleteConfirm} isDisabled={isDeleting}>
                    {isDeleting ? <Spinner size="sm" /> : "Șterge"}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </section>
    </main>
  );
}
