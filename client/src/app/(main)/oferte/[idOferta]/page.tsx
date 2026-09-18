import OfertaFlow from "@/components/oferta-flow";

export default async function OfertaPage({ params }: { params: Promise<{ idOferta: string }> }) {
    const { idOferta } = await params;
    return <OfertaFlow key={idOferta} idOferta={idOferta} detail />;
}
