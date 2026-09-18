"use client";

import GradientText from "@/components/GradientText";
import Link from "next/link";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { FileSpreadsheet, Plus, ArrowRight, CircleAlert, Check, Clock } from "lucide-react";
import { Spinner, Table } from "@heroui/react";
import { CursorPagination, PAGE_SIZE, useCursorPagination } from "@/components/cursor-pagination";
import { api } from "../../../../convex/_generated/api";

const statusLabels = {
    analysis: "De analizat",
    extraction: "De extras materiale",
    matching: "De căutat prețuri",
    validation: "Validare necesară",
    export: "Gata de export",
    completed: "Excel generat",
};
const dateFormat = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });

export default function OfertePage() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const { results, status, loadMore } = usePaginatedQuery(api.oferte.queries.listOferte,
        isAuthenticated ? {} : "skip", { initialNumItems: PAGE_SIZE });
    const pagination = useCursorPagination(results, status, loadMore);
    const loading = isLoading || status === "LoadingFirstPage";
    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
            <div className="flex flex-wrap justify-between items-end gap-4 mb-8 border-b border-border pb-6">
                <div>
                    <p className="mb-2 text-sm font-medium text-accent">Catalog</p>
                    <h1 className="flex flex-row items-center gap-2 text-3xl font-semibold mb-2">
                        <FileSpreadsheet className="size-5 text-blue-500" aria-hidden="true" />
                        <GradientText 
                            colors={['#88baff', '#00aaf4', '#2d7aff']}
                        >
                            Oferte
                        </GradientText>
                    </h1>
                </div>
                <Link href="/generare-ai" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2">
                    <Plus className="size-4" aria-hidden="true" />
                    Adaugă
                </Link>
            </div>
            {loading ? <div role="status" className="flex items-center gap-3 py-10 text-sm text-muted-foreground"><Spinner size="sm" />Se încarcă ofertele...</div>
                : results.length === 0 ? <div className="border-y border-border py-14 text-center">
                    <FileSpreadsheet className="mx-auto mb-4 size-9 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-lg font-semibold">Nu există oferte</h2>
                    <Link href="/generare-ai" className="mt-4 inline-flex items-center gap-2 text-sm underline"><Plus className="size-4" />Adaugă ofertă</Link>
                </div> : (
                    <Table>
                        <Table.ScrollContainer className="max-w-full">
                            <Table.Content aria-label="Ofertele mele" className="min-w-[760px]">
                                <Table.Header>
                                    <Table.Column isRowHeader>Ofertă</Table.Column>
                                    <Table.Column>Creată</Table.Column>
                                    <Table.Column>Status</Table.Column>
                                    <Table.Column className="text-right">Materiale</Table.Column>
                                    <Table.Column className="text-right">Acțiune</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                    {pagination.items.map((oferta) => (
                                        <Table.Row key={oferta._id} id={oferta._id}>
                                            <Table.Cell className="min-w-48 max-w-72 whitespace-normal break-words">
                                                <Link href={`/oferte/${oferta._id}`} className="font-medium hover:underline">{oferta.fileName}</Link>
                                                {oferta.valuta && <p className="mt-1 text-xs text-muted-foreground">{oferta.valuta}</p>}
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap text-xs text-muted-foreground"><time dateTime={new Date(oferta._creationTime).toISOString()}>{dateFormat.format(oferta._creationTime)}</time></Table.Cell>
                                            <Table.Cell>
                                                <span className={`inline-flex items-center gap-2 whitespace-nowrap text-sm ${oferta.status === "validation" ? "text-warning" : oferta.status === "completed" || oferta.status === "export" ? "text-success" : "text-muted-foreground"}`}>
                                                    {oferta.status === "validation" ? <CircleAlert className="size-4" /> : oferta.status === "completed" || oferta.status === "export" ? <Check className="size-4" /> : <Clock className="size-4" />}
                                                    {statusLabels[oferta.status]}
                                                </span>
                                                {oferta.pendingCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{oferta.pendingCount} de validat</p>}
                                            </Table.Cell>
                                            <Table.Cell className="text-right tabular-nums">{oferta.materialCount || "—"}</Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Link href={`/oferte/${oferta._id}`} aria-label={`${oferta.status === "completed" ? "Deschide" : "Continuă"} ${oferta.fileName}`}
                                                    className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap text-sm font-medium hover:underline">
                                                    {oferta.status === "completed" ? "Deschide" : "Continuă"}<ArrowRight className="size-4" aria-hidden="true" />
                                                </Link>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                )}
            {!loading && results.length > 0 && <CursorPagination {...pagination} />}
        </main>
    );
}
