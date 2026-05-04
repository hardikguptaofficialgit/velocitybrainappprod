# API Design

Velocity Brain exposes REST APIs under `/v1` and keeps business logic in service modules.

## Endpoint Catalog

### Core Runtime

- `GET /v1/healthz`
- `POST /v1/eval/query`
- `GET /v1/audit/recent`
- `GET /v1/runtime/status`

### OpenClaw Discovery

- `GET /v1/openclaw/profile`
- `GET /v1/openclaw/capabilities`

### Guide and Docs Surfaces

- `GET /` (API root summary)
- `GET /guide` (guide web app)
- `GET /v1/docs/pages`
- `GET /v1/docs/page/{slug}`

### MCP Tool Surface (Stdio)

These are exposed through `velocitybrain serve mcp`, not REST routes:

- `ingest_text`
- `query`
- `run_agent`
- `sync_brain` (policy-gated)
- `put_page` (policy-gated)
- `delete_page` (policy-gated)
- `google_workspace_action`
- `get_identity_spec`
- `list_skills`
- `healthz`

## Response Contract

Intelligence responses are expected to provide:

- `answer`
- `confidence`
- `references`
- `reasoning_summary`

If internal context is insufficient, endpoints should return an explicit insufficiency response rather than fabricating content.

## Retrieval Evaluation

The retrieval evaluation endpoint reports:

- `precision_at_k`
- `recall_at_k`
- `groundedness`
- `hallucination_risk`
- `returned_slugs`
- `expected_slugs`
- `type_distribution`
- `trace_id`

The local benchmark runner lives in `scripts/retrieval_benchmark.py` and uses `data/retrieval_benchmark.json`.

## Audit Viewer

Use `GET /v1/audit/recent` to inspect recent compliance events, including destructive-tool approvals and denials.

Response includes:

- `count`
- `events`
- `trace_id`

## Runtime Status

Use `GET /v1/runtime/status` for a single snapshot of:

- API health summary
- Skill inventory count and categories
- OpenClaw tool and skill capability counts
- Recent audit availability and latest event

Response includes `trace_id` for traceability.

## OpenClaw Profile Discovery

Use:

- `GET /v1/openclaw/profile` for full OpenClaw profile payload
- `GET /v1/openclaw/capabilities` for lightweight tool and skill summary

Both responses include `trace_id` for cross-surface observability.

## API Principles

- Thin routes, service-oriented implementation
- Brain-first retrieval for agentic tasks
- Explainability included by default
- Backward-compatible evolution of request and response schemas

## Local Docs URL

When running `velocitybrain serve`, OpenAPI docs are available at:
- `https://velocitybrain.vercel.app/docs`
