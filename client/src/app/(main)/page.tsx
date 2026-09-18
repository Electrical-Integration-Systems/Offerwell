"use client";

import { useRef, useState, useEffect } from "react";
import { Alert, Button, Card, Chip, Form, SearchField, Spinner, Tooltip, TextField, TextArea, NumberField, Label, FieldError, Fieldset, FieldGroup, Drawer, AlertDialog } from "@heroui/react";
import { PackageSearch, Search, Copy, Check, Pencil, Trash } from "lucide-react"; 
import { searchTypesense, getNumarMateriale } from "@/lib/typesense/client";
import type { MaterialHit } from "@/types";
import { PolaroidStrip } from "@/components/PolaroidStrip";
import { Table } from "@heroui/react";

const currency = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" });

function MaterialeCards({
  searchResults,
  copiedField,
  handleCopyPrice,
}: {
  searchResults: MaterialHit[];
  copiedField: string | null;
  handleCopyPrice: (price: number, index: number, field: string) => void;
}) {
  return (
    <div className="space-y-2">
        {searchResults.map((material, index) => (
        <Card key={index} className="rounded-4xl bg-surface p-0 shadow-none px-5 hover:shadow-md">
            <Card.Content className="gap-5 p-5 sm:p-6">
            <div className="flex items-center justify-between">
                <h3 className="break-words text-base font-semibold">{material.descriere}</h3>
                <div className="flex flex-row gap-2">
                <Button 
                    variant="primary" 
                    size="sm" 
                    className="gap-2"
                >
                    Edit
                </Button>
                <Button 
                    variant="danger" 
                    size="sm" 
                    className="gap-2"
                >
                    Delete
                </Button>
                </div>
            </div>
            <dl className="flex flex-row gap-3 items-center justify-around border-t border-border pt-4">
                {([
                ["Preț achiziție", material.pretAchizitie, "text-danger", "pretAchizitie"],
                ["Preț vânzare", material.pretVanzare, "text-accent", "pretVanzare"],
                ["Manoperă", material.manopera, "text-success", "manopera"],
                ] as const).map(([label, price, color, field]) => (
                <div key={label} className="min-w-0">
                    <dt className="mb-1 text-sm text-muted">{label}</dt>
                    <div className="flex items-center gap-2">
                      <dd className={`break-words text-lg font-semibold tabular-nums ${color}`}>{currency.format(price)}</dd>
                      <Tooltip delay={0}>
                        <Button
                          isIconOnly
                          size="sm"
                          className="min-w-fit h-fit p-1"
                          onPress={() => handleCopyPrice(price, index, field)}
                        >
                          {copiedField === `${index}-${field}` ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </Button>
                        <Tooltip.Content>
                          <Tooltip.Arrow />
                          Copiază preț
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                </div>
                ))}
            </dl>
            </Card.Content>
        </Card>
        ))}
    </div>
  );
}

function MaterialeTable({
  searchResults,
  copiedField,
  handleCopyPrice,
  onEditStart,
  onDeleteStart,
}: {
  searchResults: MaterialHit[];
  copiedField: string | null;
  handleCopyPrice: (price: number, index: number, field: string) => void;
  onEditStart: (material: MaterialHit) => void;
  onDeleteStart: (material: MaterialHit) => void;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Materiale" className="min-w-[600px]">
          <Table.Header>
                <Table.Column isRowHeader className="text-left">Descriere</Table.Column>
                <Table.Column className="text-center">Preț Achiziție</Table.Column>
                <Table.Column className="text-center">Preț Vânzare</Table.Column>
                <Table.Column className="text-center">Manoperă</Table.Column>
                <Table.Column className="text-center">Acțiuni</Table.Column>
            </Table.Header>
          <Table.Body>
            {searchResults.map((material, index) => (
              <Table.Row key={material.id}>
                <Table.Cell>{material.descriere}</Table.Cell>
                <Table.Cell className="text-danger font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.pretAchizitie)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger-soft"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.pretAchizitie, index, "pretAchizitie")}
                      >
                        {copiedField === `${index}-pretAchizitie` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-accent font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.pretVanzare)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.pretVanzare, index, "pretVanzare")}
                      >
                        {copiedField === `${index}-pretVanzare` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-success font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.manopera)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="tertiary"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.manopera, index, "manopera")}
                      >
                        {copiedField === `${index}-manopera` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                <Table.Cell className="flex flex-row items-center justify-end gap-2">
                  <Button 
                    isIconOnly
                    variant="primary" 
                    size="sm"
                    onPress={() => onEditStart(material)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button 
                    isIconOnly
                    variant="danger" 
                    size="sm"
                    onPress={() => onDeleteStart(material)}
                  >
                    <Trash className="size-4" />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MaterialHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingData, setEditingData] = useState<MaterialHit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialHit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [numarMateriale, setNumarMateriale] = useState<number | null>(null);
  
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

  const performSearch = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([]);
      setSearchedQuery("");
      setError("");
      setIsSearching(false);
      return;
    }
    
    const currentRequest = ++requestId.current;
    setIsSearching(true);
    setError("");
    setSearchResults([]);
    setSearchedQuery("");
    try {
      const results = await searchTypesense<MaterialHit>("materiale", value, "descriere");
      if (currentRequest !== requestId.current) return;
      setSearchResults(results);
      setSearchedQuery(value);
    } catch {
      if (currentRequest === requestId.current) setError("Căutarea nu este disponibilă momentan. Încearcă din nou.");
    } finally {
      if (currentRequest === requestId.current) setIsSearching(false);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await performSearch(query);
  };

  const handleFacetSelect = (facetQuery: string) => {
    setQuery(facetQuery);
    performSearch(facetQuery);
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
    setError("");
    setSuccessMessage("");
    
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
      setSuccessMessage("Material actualizat cu succes.");
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Editarea a eșuat. Încearcă din nou.");
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
    setError("");
    setSuccessMessage("");
    
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
      setSuccessMessage("Material șters cu succes.");
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ștergerea a eșuat. Încearcă din nou.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
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
          performSearch(value);
        }} className="min-w-0 flex-1">
          <SearchField.Group className="h-12 border border-border bg-surface focus-within:ring-2 focus-within:ring-accent rounded-full px-3">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Caută după descriere..." />
            <SearchField.ClearButton aria-label="Șterge căutarea" />
          </SearchField.Group>
        </SearchField>
        <Button type="submit" isIconOnly aria-label="Caută" isDisabled={!query.trim() || isSearching} className="size-12 rounded-full">
          {isSearching ? <Spinner size="sm" /> : <Search className="size-5" />}
        </Button>
      </Form>

      <section aria-label="Rezultate" aria-busy={isSearching}>
        <div role="status" aria-live="polite">
          {isSearching && <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner size="sm" />Se caută materiale...</div>}
          {searchedQuery && <div className="mb-5 flex flex-wrap items-center gap-3"><h2 className="min-w-0 break-words text-lg font-medium">Rezultate pentru „{searchedQuery}”</h2><Chip variant="soft">{searchResults.length}</Chip></div>}
        </div>
        {error && <Alert status="danger" role="alert" className="mb-6"><Alert.Indicator /><Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content></Alert>}
        {successMessage && <Alert status="success" role="status" className="mb-6"><Alert.Indicator /><Alert.Content><Alert.Title>{successMessage}</Alert.Title></Alert.Content></Alert>}
        {!isSearching && !error && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted">
            <PackageSearch className="size-12 stroke-1 text-accent" aria-hidden="true" />
            <p>{searchedQuery ? "Nu s-au găsit materiale." : "Catalog de materiale"}</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <MaterialeTable 
            searchResults={searchResults} 
            copiedField={copiedField} 
            handleCopyPrice={handleCopyPrice}
            onEditStart={handleEditStart}
            onDeleteStart={handleDeleteStart}
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
                  <AlertDialog.Heading>Șterge material permanent?</AlertDialog.Heading>
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
