"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Table, Spinner, Button } from '@heroui/react';
import { useAction } from "convex/react";

function formatDateUTC3(isoString: string): string {
    const date = new Date(isoString);
    // Format in UTC+3 timezone
    return date.toLocaleString("ro-RO", {
        timeZone: "Europe/Bucharest",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

export default function PreturiPage() {
    const cursuriValutare = useQuery(api.queries.getCursuriValutare);
    const preturiMetale = useQuery(api.queries.getPreturiMetale);

    const updateExchangeRates = useAction(api.bnr.updateExchangeRates);
    const updateCopperPrice = useAction(api.yahooFinance.updateCopperPrice);

    const handleUpdate = async () => {
        await updateExchangeRates();
        await updateCopperPrice();
    };
    
    return(
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
            <div className="flex flex-col md:flex-row mb-10 border-b border-border pb-6 justify-between gap-6 md:gap-0 items-center">
                <div className="flex-shrink-0">
                    <p className="mb-2 text-sm font-medium text-accent whitespace-nowrap">
                        Unelte
                    </p>
                    <h1 className="text-3xl font-semibold">Cursul BNR și prețurile metalelor</h1>
                </div>
                <Button variant="secondary"
                    onClick={handleUpdate}
                >
                    Actualizează
                </Button>
            </div>
            <section>
                <h2 className="text-2xl font-semibold mb-4">Cursuri Valutare</h2>
                <p className="mb-4 text-sm text-muted-foreground">Sursă: Banca Națională a României (BNR)</p>
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content aria-label="Team members" className="min-w-[600px]">
                        <Table.Header>
                            <Table.Column isRowHeader>Moneda</Table.Column>
                            <Table.Column>Valore în RON</Table.Column>
                            <Table.Column>Data</Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {cursuriValutare?.map((curs, index) => (
                                <Table.Row key={index}>
                                    <Table.Cell>{curs.moneda}</Table.Cell>
                                    <Table.Cell>{curs.valoare}</Table.Cell>
                                    <Table.Cell>{formatDateUTC3(curs.dataActualizare)}</Table.Cell>
                                </Table.Row>
                            ))}
                            {!cursuriValutare && (
                                <Table.Row>
                                    <Table.Cell colSpan={3} className="text-center py-8">
                                        <Spinner />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {cursuriValutare?.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3} className="text-center py-2">
                                        <p className="text-sm text-muted-foreground">Nu există cursuri valutare disponibile.</p>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </section>
            <section className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Prețuri Metale</h2>
                <p className="mb-4 text-sm text-muted-foreground">Sursă: Yahoo Finance</p>
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content aria-label="Team members" className="min-w-[600px]">
                        <Table.Header>
                            <Table.Column isRowHeader>Metal</Table.Column>
                            <Table.Column>Valoare RON</Table.Column>
                            <Table.Column>Valoare EUR</Table.Column>
                            <Table.Column>Valoare USD</Table.Column>
                            <Table.Column>Unitate</Table.Column>
                            <Table.Column>Data Actualizare</Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {preturiMetale?.map((metal, index) => (
                                <Table.Row key={index}>
                                    <Table.Cell>{metal.metal}</Table.Cell>
                                    <Table.Cell>{metal.valoareRON}</Table.Cell>
                                    <Table.Cell>{metal.valoareEUR}</Table.Cell>
                                    <Table.Cell>{metal.valoareUSD}</Table.Cell>
                                    <Table.Cell>{metal.unitate}</Table.Cell>
                                    <Table.Cell>{formatDateUTC3(metal.dataActualizare)}</Table.Cell>
                                </Table.Row>
                            ))}
                            {!preturiMetale && (
                                <Table.Row>
                                    <Table.Cell colSpan={6} className="text-center py-8">
                                        <Spinner />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {preturiMetale?.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={6} className="text-center py-4">
                                        <p className="text-sm text-muted-foreground">Nu există prețuri pentru metale disponibile.</p>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </section>
        </main>
    );
}