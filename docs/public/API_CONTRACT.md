# Public Hosted API Contract

The public distribution layer may call only these endpoints:

- `POST /v1/run`
- `GET /v1/usage`

Public proof response shape:

```json
{
  "result": "string",
  "reused": true,
  "reuse_confidence": 1.0,
  "tokens_saved": 10054,
  "percent_saved": 97.6
}
```
