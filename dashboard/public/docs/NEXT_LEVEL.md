# Next Level Roadmap

This roadmap defines concrete, high-impact upgrades to move Velocity Brain from a strong local-first runtime to a production-grade autonomous memory platform.

## Phase 1: Reliability and Safety (Immediate)

### 1) Strong MCP Guardrails

- Add allowlists per tool and per actor identity.
- Require explicit approval tokens for mutating tools.
- Add structured denial reasons in all policy rejections.

Success metrics:
- Zero unintended mutating calls in production logs.
- 100% of mutating calls include auditable approval context.

### 2) End-to-End Tool Observability

- Add request IDs and run IDs across CLI, API, MCP, and scheduler flows.
- Persist tool latency, status, and error class for each call.
- Expose MCP and agent-loop health counters in dashboard metrics.

Success metrics:
- P95 query latency and run latency tracked continuously.
- Every failed tool call linked to a traceable run ID.

### 3) Deterministic Regression Pack

- Add fixture-driven tests for `query`, `run_agent`, and policy gates.
- Add schema-conformance tests for all skill manifests.
- Add smoke tests for MCP list/call lifecycle.

Success metrics:
- CI blocks release on skill-conformance failures.
- Core workflow smoke suite remains green before every release.

## Phase 2: Intelligence Quality (Near Term)

### 1) Retrieval Evaluation Harness

- Add benchmark sets for entity recall, ranking quality, and contradiction detection.
- Track precision@k and recall@k by query class.
- Add automated comparison of retrieval changes before merge.

Success metrics:
- Quantified retrieval quality trend over time.
- No quality regression merged without explicit approval.

Implemented in this repo:

- `POST /v1/eval/query`
- `GET /v1/audit/recent`
- `scripts/retrieval_benchmark.py`
- `data/retrieval_benchmark.json`
- Destructive MCP approval audit trail
- FastAPI lifespan startup handler

### 2) Skill Routing Quality

- Add confidence scoring to skill selection.
- Log top candidate skills and selected skill for explainability.
- Add fallback routing behavior when confidence is low.

Success metrics:
- Reduced wrong-skill dispatch rate.
- Improved intent-to-skill match consistency.

### 3) Meeting and Communication Loop

- Expand meeting copilot outputs with owner and due-date extraction.
- Add follow-up draft scoring and conflict checks.
- Connect output directly into task creation workflows.

Success metrics:
- Higher action-item capture rate.
- Fewer manual follow-up corrections.

## Phase 3: Runtime Scale (Mid Term)

### 1) Queue-Backed Execution Service

- Move long-running actions from inline execution to queued workers.
- Add retry backoff policy and dead-letter queue handling.
- Make workflow execution idempotent with operation keys.

Success metrics:
- Stable execution under burst load.
- No duplicate side effects from retries.

### 2) Connector Hardening

- Replace simulated connectors with provider-backed adapters behind feature flags.
- Add per-connector rate-limit and error budget controls.
- Add sandbox mode for dry-run verification.

Success metrics:
- Connector success rate and retries tracked by provider.
- Controlled rollout with rollback switches.

### 3) Storage and Index Lifecycle

- Add embedding refresh windows and chunked re-index jobs.
- Add compaction strategy for timeline-heavy entities.
- Add archival tiers for long-tail events.

Success metrics:
- Stable query latency as dataset grows.
- Predictable storage growth and retention behavior.

## Recommended Execution Order

1. MCP guardrails and observability
2. Skill-conformance and deterministic regression pack
3. Retrieval evaluation harness
4. Queue-backed execution and connector hardening
5. Storage/index lifecycle upgrades

## What Can Be Implemented Next in This Repo

The following upgrades can be implemented immediately with current architecture:

1. Add a skill-manifest conformance validator in tests and CLI.
2. Add trace IDs to MCP tool responses and agent runs.
3. Add OpenClaw-specific integration smoke script in `scripts/`.
4. Add policy test cases for destructive-tool approval paths.
5. Add a lightweight benchmark dataset for retrieval evaluation.
