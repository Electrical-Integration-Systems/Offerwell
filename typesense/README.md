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

For local development, use the host, port, protocol, and development admin key
from [.env.example](./.env.example), and follow the
[local stack setup](../docker/README.md). For production HTTPS connections, set
`TYPESENSE_PROTOCOL=https` and `TYPESENSE_PORT=443` (also the defaults when unset).
The upload command deletes and recreates `materiale` at the configured host.
The development Compose stack automatically initializes
`collections/materiale.csv` during startup without deleting existing data.
Running this standalone upload command is not required for development startup.

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


