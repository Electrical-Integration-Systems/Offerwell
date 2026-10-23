import type { Metadata } from "next";
import OfertaFlow from "@/components/oferta-flow";

export const metadata: Metadata = { title: "Detalii ofertă" };

export default async function OfertaPage({ params }: { params: Promise<{ idOferta: string }> }) {
    const { idOferta } = await params;
    return <OfertaFlow key={idOferta} idOferta={idOferta} detail />;
}
