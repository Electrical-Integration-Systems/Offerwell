import GradientText from "@/components/GradientText";

export default function GenerareAIPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
            <div className="mb-8 border-b border-border pb-6">
                <p className="mb-2 text-sm font-medium text-accent">Unelte</p>
                <h1 className="text-3xl font-semibold mb-2">
                    <GradientText 
                        colors={['#88baff', '#00aaf4', '#2d7aff']}
                    >Generare AI</GradientText>
                </h1>
                <p className="text-muted-foreground">Adaugă lista de cantități pentru estimarea prețurilor folosind inteligență artificială</p>
            </div>
        </main>
    );
}
