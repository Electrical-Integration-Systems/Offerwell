# Typesense

## Prerequisite

* .env.local (See: [.env.example](./.env.example))
* [bun](https://bun.com/)

> The API KEY is set during Typesense instance configuration. See: [Typesense Configuration](../docker/docker-compose.yml#L15)

## Install modules

```bash
bun install
```

## To run:

```bash
bun run upload

CSV read complete. Found <number_of_materials_in_csv> materials.
Collection materiale deleted
Collection created
Documents imported into collection materiale
```

## Ollama embedding model

The collection schema uses `nomic-embed-text:v1.5`. Before importing, install
that exact model tag on the Docker host running Ollama. From the repository's
`docker` directory on that host, run:

```bash
docker compose exec ollama ollama pull nomic-embed-text:v1.5
docker compose exec ollama ollama list
```

Then run `bun run upload` from the `typesense` directory again.

If collection creation fails with `JSON Parse error: Expected '}'`, a server
error may be hidden by malformed JSON. For example, a missing Ollama model can
produce an error response containing unescaped quotes around the model name:

```text
OpenAI API error: model "nomic-embed-text:v1.5" not found, try pulling it first
```

Pulling a different tag (such as `latest`) does not satisfy the exact model name
configured in `src/schema.ts`.

## CSV

La parsare, descrierile sunt normalizate înainte de indexare și generarea
embeddingurilor: unitățile de lungime, suprafață și volum (`mm`, `mmp`, `mm²`,
`cm`, `m`, `mp`, `mc` etc.) sunt eliminate, iar valorile numerice sunt păstrate.
De exemplu, `Cablu 3×2,5 mm²` și `Cablu 3x2,5mmp` devin `Cablu 3x2,5`.
Codurile precum `N2XH`, `M20`, tensiunea și curentul rămân în descriere.

Aceeași funcție este folosită pentru matchingul ofertelor. Descrierea originală
din ofertă rămâne în datele extrase, în interfața de validare și în Excelul exportat.
Fișierul CSV sursă nu este modificat. Pentru documentele deja indexate,
normalizarea se aplică la următorul import.

```csv
descriere,pretAchizitie,pretVanzare,manopera
"Descriere",0,0,0
```


