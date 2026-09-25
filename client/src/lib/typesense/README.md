# Base structure of a Typesense response

```sh
{
  "facet_counts": [],
  "found": 42,
  "out_of": 1050,
  "page": 1,
  "search_time_ms": 3,
  "hits": [
    {
      "document": {
        "id": "123",
        "nume_material": "Țeavă cupru izolat",
        "categorie": "Instalații"
      },
      "highlights": [
        {
          "field": "nume_material",
          "matched_tokens": ["cupru"],
          "snippet": "Țeavă <mark>cupru</mark> izolat"
        }
      ],
      "text_match": 8734324,
      "text_match_info": {
        "best_field_score": "1108094976",
        "best_field_weight": 15,
        "fields_matched": 1,
        "score": "1108094976",
        "tokens_matched": 1
      }
    }
  ]
}
```