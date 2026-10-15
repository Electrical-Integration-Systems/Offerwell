"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { catalogColumns, type CatalogMaterial, type CatalogPage, type CatalogSort, type SortDirection } from "@/lib/catalog";
import { currency } from "@/lib/currency";
import ExpandableText from "./expandable-text";

function CatalogResults({ sort, direction, onSort }: { sort: CatalogSort; direction: SortDirection; onSort: (sort: CatalogSort) => void }) {
  const [materials, setMaterials] = useState<CatalogMaterial[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const nextPage = useRef(1);
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const lifetime = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    if (inFlight.current) return;
    const request = ++requestId.current;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog?page=${nextPage.current}&sort=${sort}&direction=${direction}`, { signal, cache: "no-store" });
      if (response.status === 401 || (response.redirected && new URL(response.url).pathname === "/auth")) throw new Error("Sesiunea a expirat. Reîncarcă pagina pentru a te conecta din nou.");
      if (!response.ok) throw new Error("Materialele nu au putut fi încărcate. Încearcă din nou.");
      const data = await response.json() as CatalogPage;
      if (signal.aborted) return;
      setMaterials((current) => {
        const existing = new Set(current.map((material) => material.id));
        return [...current, ...data.materials.filter((material) => !existing.has(material.id))];
      });
      setTotal(data.total);
      setHasMore(data.hasMore);
      nextPage.current += 1;
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error && caught.message.includes("Sesiunea") ? caught.message : "Materialele nu au putut fi încărcate. Încearcă din nou.");
    } finally {
      if (request === requestId.current) inFlight.current = false;
      if (!signal.aborted) setLoading(false);
    }
  }, [sort, direction]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void load(controller.signal);
    return () => { controller.abort(); inFlight.current = false; };
  }, [load]);

  useEffect(() => {
    if (!hasMore || loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && lifetime.current) void load(lifetime.current.signal);
    }, { rootMargin: "300px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, hasMore, loading, error]);

  return <>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[700px] text-sm">
        <caption className="sr-only">Catalog materiale. Antetele permit sortarea crescătoare și descrescătoare.</caption>
        <thead className="bg-secondary"><tr>{catalogColumns.map(({ key, label }) => <th key={key} scope="col"
          aria-sort={sort === key ? direction === "asc" ? "ascending" : "descending" : "none"}
          className={`px-4 py-3 ${key === "descriere" ? "w-1/2 text-left" : "text-right"}`}>
          <button type="button" onClick={() => onSort(key)} className={`inline-flex cursor-pointer items-center gap-2 rounded py-1 font-semibold focus-visible:outline-2 focus-visible:outline-ring ${sort === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}{sort === key ? direction === "asc" ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" /> : <ArrowUpDown className="size-4" aria-hidden="true" />}
          </button>
        </th>)}</tr></thead>
        <tbody className="divide-y divide-border">{materials.map((material) => <tr key={material.id} className="hover:bg-secondary/40">
          <td className="max-w-lg px-4 py-4 font-medium"><ExpandableText text={material.descriere} /></td>
          <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">{currency.format(material.pretAchizitie)}</td>
          <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">{currency.format(material.pretVanzare)}</td>
          <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">{currency.format(material.manopera)}</td>
        </tr>)}</tbody>
      </table>
      {!loading && !error && total === 0 && <p className="p-8 text-center text-muted-foreground">Catalogul nu conține încă materiale.</p>}
    </div>
    <div ref={sentinel} className="flex min-h-24 flex-col items-center justify-center gap-3 py-5">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{loading && <Spinner size="sm" />}{loading ? "Se încarcă materialele..." : total === null ? "" : `${materials.length} din ${total} materiale${hasMore ? "" : " · Sfârșitul catalogului"}`}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!loading && (error || hasMore) && <Button variant="secondary" onPress={() => { if (lifetime.current) void load(lifetime.current.signal); }}>{error ? "Încearcă din nou" : "Încarcă mai multe"}</Button>}
    </div>
  </>;
}

export default function Catalog() {
  const [order, setOrder] = useState<{ sort: CatalogSort; direction: SortDirection }>({ sort: "descriere", direction: "asc" });
  return <CatalogResults key={`${order.sort}:${order.direction}`} {...order} onSort={(sort) => setOrder((current) => ({ sort, direction: current.sort === sort && current.direction === "asc" ? "desc" : "asc" }))} />;
}
