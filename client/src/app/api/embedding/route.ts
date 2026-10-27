import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const text = body.descriere;
        if (!text) {
            return NextResponse.json(
                { error: "Textul este obligatoriu pentru a genera vectorul." },
                { status: 400 }
            );
        }

        const ollamaURL = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
        const baseURL = process.env.OPEN_WEBUI_BASE_URL?.replace(/\/$/, "") || "";
        if (!ollamaURL && !baseURL) {
            return NextResponse.json({ error: "Serviciul de embedding nu este configurat." }, { status: 503 });
        }
        const apiKey = process.env.OPEN_WEBUI_API_KEY || "";
        const endpoint = ollamaURL ? `${ollamaURL}/api/embed` : `${baseURL}/ollama/api/embed`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(!ollamaURL && apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                model: process.env.OLLAMA_EMBEDDING_MODEL || (ollamaURL ? "nomic-embed-text:v1.5" : "nomic-embed-text:latest"),
                input: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`VPS-ul a returnat o eroare (status ${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (!data.embeddings || data.embeddings.length === 0) {
            throw new Error("Modelul a procesat cererea, dar nu a returnat vectorul.");
        }

        return NextResponse.json({ embedding: data.embeddings[0] }, { status: 200 });

    } catch (error: any) {
        console.error("Eroare la generarea embedding-ului:", error);
        return NextResponse.json(
            { error: error.message || "Eroare internă a serverului la contactarea AI-ului." },
            { status: 500 }
        );
    }
}
