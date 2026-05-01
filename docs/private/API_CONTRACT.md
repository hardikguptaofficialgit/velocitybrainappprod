# Private Hosted API Notes

Internal services may maintain richer payloads, but the public client boundary should normalize responses to:

```json
{
  "result": "string",
  "reused": true,
  "reuse_confidence": 1.0,
  "tokens_saved": 10054,
  "percent_saved": 97.6
}
```

Do not leak internal-only fields from the reuse engine across the public package boundary.

