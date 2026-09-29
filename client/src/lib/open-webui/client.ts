export async function getEmbedding(descriere: string): Promise<number[]> {
    const response = await fetch("/api/embedding", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ descriere }),
    });
    const data = await response.json();

    console.log(data.embedding);

    return data.embedding;
}
