# Workflows

This document summarizes core workflow patterns currently supported by Velocity Brain.

## 1) Ingestion Workflow

- Input: note, transcript, or textual signal
- Parse likely entities
- Upsert entity page (compiled truth)
- Append immutable timeline event
- Optionally trigger enrichment follow-up

## 2) Query Workflow

- Input: question (for example, "What do we know about auth and API keys in this repo?")
- Perform hybrid retrieval from internal memory
- Rank and synthesize top results
- Return answer with confidence and references

## 3) Enrichment Workflow

- Identify thin or stale entities
- Gather additional evidence from approved sources/processes
- Update compiled truth snapshot
- Append timeline evidence and relationship updates

## 4) Execution Workflow

- Input: execution-oriented signal
- Classify intent as execution/planning/query/ingestion
- Build action plan
- Execute action adapters/workflows
- Log outcomes and write memory updates

## 5) Background Optimization Workflow

- Run scheduled maintenance cycles
- Perform deduplication and consistency checks
- Repair broken links/citations where applicable
- Generate and persist operational insights
- Record job health in optimization tracking

## 6) Retrieval Evaluation Workflow

- Load benchmark questions and expected slugs
- Optionally seed reference content into the local brain
- Run `POST /v1/eval/query` or `scripts/retrieval_benchmark.py`
- Aggregate precision@k, recall@k, groundedness, and hallucination risk
- Compare scores before and after retrieval changes

## 7) MCP Client Workflow (OpenClaw and Others)

- Configure client MCP server: `velocitybrain serve mcp`
- Validate connection using `healthz`
- Validate capability surface using `list_skills`
- Run memory-backed `query`
- Run orchestration via `run_agent`
- Keep mutating tools policy-gated by default

For OpenClaw-first setup, optionally run `velocitybrain openclaw` to export a profile before wiring client settings.

## 8) Guide Status Workflow

- Start API with `velocitybrain serve api --host 0.0.0.0 --port 8080 --reload`
- Open `https://velocitybrain.vercel.app/guide`
- Validate sidebar status cards for API, docs pages, OpenClaw capabilities, and audit events
- Use guide page links and deep links for reproducible onboarding checks

## Workflow Design Rules

- Internal memory retrieval precedes external reasoning.
- All significant actions should be auditable.
- Write paths should preserve timeline immutability.
- Long-running maintenance should be idempotent.
