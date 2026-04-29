# Architecture

This document defines the current architecture of Velocity Brain as a CLI-first and agent-first system.

## System Topology

| Layer | Responsibility |
|---|---|
| Interface | CLI commands, REST API, MCP stdio tools |
| API Layer | FastAPI routes and request/response contracts |
| Cognitive Core | Intent detection, planning, execution orchestration |
| Memory Layer | Entity pages (compiled truth) + immutable timeline |
| Retrieval Layer | Hybrid retrieval and ranking fusion |
| Graph Layer | Relationship inference and neighbor traversal |
| Skill Layer | JSON skill registry and runtime resolution |
| Execution Layer | Workflow/action adapters and run logging |
| Background Layer | Scheduler-driven maintenance and optimization jobs |
| Trust Layer | Confidence scoring, references, auditability, access levels |
| Extension Layer | Plugin manifests and connector hooks |

## Core Design Decisions

- Local-first memory with Postgres as canonical store.
- Compiled truth is mutable synthesis; timeline remains append-only evidence.
- Brain-first behavior: internal retrieval runs before external operations.
- Runs are explainable via confidence, references, and reasoning summary.
- Skills are operational primitives, not static metadata.

## Runtime Boundaries

These modules are structured to be extractable into microservices later:

- `brain-service`: entities, versions, timeline, facts
- `retrieval-service`: search + fusion ranking
- `graph-service`: relationships + traversal APIs
- `skill-service`: skill loading + resolution + policy
- `agent-service`: loop orchestration and intent routing
- `execution-service`: action execution and logging
- `ops-service`: scheduler + optimization + health checks

## Mandatory Data Flow

```text
Signal/Input
  -> Intent + Entity Detection
  -> Brain Retrieval
  -> Plan Construction
  -> Action Execution
  -> Memory Writeback
  -> Re-index + Optimization
```

## Non-Functional Targets

- Retrieval latency target: P95 < 700ms for internal lookups (environment dependent)
- Traceability target: all intelligence responses include confidence + references
- Safety target: no fabricated response when brain has insufficient context
- Operations target: background jobs are idempotent
- Access target: enforce `private`, `restricted`, `public` levels

## Current Entry Points

- CLI: `python velocitybrain.py <command>`
- API: `python velocitybrain.py serve`
- MCP: `python velocitybrain.py serve-mcp`
