# Database Schema

Velocity Brain uses PostgreSQL (+ pgvector-compatible setup) as its canonical memory and execution store.

## Core Tables

| Table | Purpose |
|---|---|
| `entities` | Canonical brain pages with compiled truth |
| `timeline_events` | Immutable evidence/history events |
| `entity_versions` | Version trail for compiled truth updates |
| `facts` | Structured claims with confidence and provenance |
| `embeddings` | Semantic chunks for retrieval pipelines |
| `relationships` | Typed graph edges + strength/evidence |
| `skills` | Active skill catalog metadata |
| `agent_runs` | Autonomous run-level traces |
| `execution_actions` | Action-level logs per run |
| `optimization_jobs` | Background maintenance and optimization tracking |
| `insights` | Generated patterns, anomalies, and contradictions |
| `user_context` | Preferences, goals, and decision context |
| `plugins` | Extension registry and plugin metadata |
| `audit_events` | Governance and sensitive operation audit stream |

## Memory Model

Velocity Brain follows a two-part memory model:

- Compiled truth in `entities.compiled_truth_md` (mutable synthesis)
- Immutable evidence trail in `timeline_events` (append-only history)

This allows updates to current understanding without losing historical context.

## Access and Governance

- `entities.access_level` enforces `private`, `restricted`, `public`.
- `audit_events` captures sensitive operations for traceability.

## Temporal and Predictive Foundations

- Temporal analysis uses `timeline_events.event_ts` and `entity_versions`.
- Forecasting/simulation features can derive signals from `facts`, `insights`, and `agent_runs`.

## Schema Source

Primary schema bootstrap file:
- `migrations/schema.sql`
