# Docker

## Prerequisite

* [Docker Engine](https://docs.docker.com/engine/)
* .env (See: [.env.example](./.env.example))

## Environment Variables

* TUNNEL_ID - Cloudflare Tunnel ID (Optional)
* TUNNEL_TOKEN - Cloudflare Tunnel Token to create connction
* TYPESENSE_API_KEY - Generate Typesense API Key

```sh
openssl rand -hex [32/64]
```

## Start containers

* Typsense
* Cloudflare Tunnel

```sh
docker compose up -d
```