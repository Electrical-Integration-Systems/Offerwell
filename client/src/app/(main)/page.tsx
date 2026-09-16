"use client";

import { useRef, useState } from "react";
import { Alert, Button, Card, Chip, Form, SearchField, Spinner } from "@heroui/react";
import { PackageSearch, Search, Copy, Check } from "lucide-react"; 
import { searchTypesense } from "@/lib/typesense/client";
import type { MaterialHit } from "@/types";
import { PolaroidStrip } from "@/components/PolaroidStrip";

const currency = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" });

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MaterialHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null); 
  const requestId = useRef(0);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
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

  const handleCopy = async (material: MaterialHit, index: number) => {
    const textToCopy = 
`${material.descriere}
Preț achiziție: ${currency.format(material.pretAchizitie)}
Preț vânzare: ${currency.format(material.pretVanzare)}
Manoperă: ${currency.format(material.manopera)}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedIndex(index);
      
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (err) {
      console.error("Nu s-a putut copia textul: ", err);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-row mb-7 border-b border-border pb-6">
        <div className="">
          <p className="mb-2 text-sm font-medium text-accent">Catalog</p>
          <h1 className="text-3xl font-semibold">Materiale</h1>
        </div>
        <PolaroidStrip />
      </div>
      <Form onSubmit={handleSearch} className="mb-8 flex w-full flex-row items-end gap-3">
        <SearchField aria-label="Caută material" value={query} onChange={(value) => {
          setQuery(value);
          ++requestId.current;
          setIsSearching(false);
          setSearchResults([]);
          setSearchedQuery("");
          setError("");
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
        {error && <Alert status="danger" role="alert"><Alert.Indicator /><Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content></Alert>}
        {!isSearching && !error && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted">
            <PackageSearch className="size-12 stroke-1 text-accent" aria-hidden="true" />
            <p>{searchedQuery ? "Nu s-au găsit materiale." : "Catalog de materiale"}</p>
          </div>
        )}
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
                      className="ml-2 gap-2"
                      onPress={() => handleCopy(material, index)}
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="size-4" /> Copiat!
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Copiază
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <dl className="flex flex-row gap-3 items-center justify-around border-t border-border pt-4">
                  {([
                    ["Preț achiziție", material.pretAchizitie, "text-danger"],
                    ["Preț vânzare", material.pretVanzare, "text-accent"],
                    ["Manoperă", material.manopera, "text-success"],
                  ] as const).map(([label, price, color]) => (
                    <div key={label} className="min-w-0">
                      <dt className="mb-1 text-sm text-muted">{label}</dt>
                      <dd className={`break-words text-lg font-semibold tabular-nums ${color}`}>{currency.format(price)}</dd>
                    </div>
                  ))}
                </dl>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
