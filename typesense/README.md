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
bun run index.ts

CSV read complete. Found <number_of_materials_in_csv> materials.
Collection materiale deleted
Collection created
Documents imported into collection materiale
```


## CSV

```csv
descriere,pretAchizitie,pretVanzare,manopera
"Descriere",0,0,0
```


