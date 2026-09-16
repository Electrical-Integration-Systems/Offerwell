```sh
curl "https://search.domeniul-tau.ro/keys" \
  -X POST \
  -H "X-TYPESENSE-API-KEY: cheia_ta_de_admin_super_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Search-only key for NextJS frontend",
    "actions": ["documents:search"],
    "collections": ["*"]
  }'
```