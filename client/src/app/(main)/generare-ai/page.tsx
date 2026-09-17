"use client";

import { useState } from "react";
import GradientText from "@/components/GradientText";
import { Sparkles } from "lucide-react";
import { Table, Button } from "@heroui/react";
import { Material } from "@/types";
import { Check, Pencil, Trash, Sheet } from "lucide-react";

const currency = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" });

const mockMaterialeExtraseEXCEL: Material[] = [
    {
        id: "1",
        descriere: "Material 1",
        pretAchizitie: 100,
        pretVanzare: 150,
        manopera: 50,
    },
    {
        id: "2",
        descriere: "Material 2",
        pretAchizitie: 200,
        pretVanzare: 300,
        manopera: 75,
    },
];

function MaterialeTable({ materiale }: { materiale: Material[] }) {
    return (
        <Table>
        <Table.ScrollContainer>
            <Table.Content aria-label="Materiale" className="min-w-[600px]">
            <Table.Header>
                <Table.Column isRowHeader className="text-left">Descriere</Table.Column>
                <Table.Column className="text-right">Preț Achiziție</Table.Column>
                <Table.Column className="text-right">Preț Vânzare</Table.Column>
                <Table.Column className="text-right">Manoperă</Table.Column>
                <Table.Column className="text-right">Scor</Table.Column>
                <Table.Column className="text-right">Acțiuni</Table.Column>
            </Table.Header>
            <Table.Body>
                {materiale.map((material, index) => (
                <Table.Row key={material.id}>
                    <Table.Cell>{material.descriere}</Table.Cell>
                    <Table.Cell className="text-danger font-semibold">
                    <div className="flex items-center gap-2 justify-end">
                        {currency.format(material.pretAchizitie)}
                    </div>
                    </Table.Cell>
                    <Table.Cell className="text-accent font-semibold">
                    <div className="flex items-center gap-2 justify-end">
                        {currency.format(material.pretVanzare)}
                    </div>
                    </Table.Cell>
                    <Table.Cell className="text-success font-semibold">
                    <div className="flex items-center gap-2 justify-end">
                        {currency.format(material.manopera)}
                    </div>
                    </Table.Cell>
                    <Table.Cell className="text-right font-semibold">
                    <div className="flex items-center gap-2 justify-end text-muted">
                        {"N/A"}
                    </div>
                    </Table.Cell>
                    <Table.Cell className="flex flex-row items-center justify-end gap-2">
                        <Button
                        isIconOnly
                        variant="danger-soft"
                        size="sm"
                        onPress={() => {}}
                    >
                        <Trash className="size-4" />
                    </Button>
                    <Button 
                        isIconOnly
                        variant="secondary"
                        size="sm"
                        onPress={() => {}}
                    >
                        <Pencil className="size-4" />
                    </Button>
                    <Button
                        isIconOnly
                        variant="primary"
                        size="sm"
                        onPress={() => {}}
                    >
                        <Check className="size-4" />
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

export default function GenerareAIPage() {
    const [materiale, setMateriale] = useState([]);

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
            <div className="flex flex-row justify-between items-end mb-8 border-b border-border pb-6">
                <div>
                    <p className="mb-2 text-sm font-medium text-accent">Unelte</p>
                    <h1 className="flex flex-row items-center gap-2 text-3xl font-semibold mb-2">
                        <Sparkles className="size-5 text-blue-500" aria-hidden="true" />
                        <GradientText 
                            colors={['#88baff', '#00aaf4', '#2d7aff']}
                        >
                            Generare AI
                        </GradientText>
                    </h1>
                    <p className="text-muted-foreground">Adaugă lista de cantități pentru estimarea prețurilor folosind inteligență artificială</p>
                </div>
                <Button
                    variant="primary"
                    size="lg"
                    className="bg-green-500"
                    onPress={() => console.log('clicked')}
                >
                    <Sheet className="size-4 mr-2" aria-hidden="true" />
                    Adaugă
                </Button>
            </div>

            {
                materiale.length > 0 && <MaterialeTable materiale={materiale} />
            }
        </main>
    );
}
