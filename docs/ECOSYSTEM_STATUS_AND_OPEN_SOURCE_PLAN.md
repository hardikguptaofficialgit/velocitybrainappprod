# Velocity Brain Ecosystem Status And Open-Source Plan

## Purpose

This document captures:

- what has already been completed across the Velocity Brain ecosystem
- what has been stabilized and hardened recently
- what still remains before private beta is truly production-ready
- what should remain private
- what can be open sourced safely

This is not a redesign plan.

This is a stabilization and boundary document for the existing product direction.

## Product Definition

Velocity Brain is a hosted memory and reuse platform for coding agents.

The core product is:

- persistent memory for coding-agent runs
- retrieval of previous useful context
- reuse of prior artifacts and execution context
- hosted orchestration and usage tracking
- MCP integration
- dashboard and API control plane

The core product is not "generic AI agents".

The core product is reusable intelligence across coding-agent runs.

## Ecosystem Overview

The current ecosystem has three major layers:

### 1. Core Runtime

- Python runtime
- memory engine
- retrieval engine
- reuse engine
- embedding layer
- workflow and execution primitives
- MCP stdio and hosted MCP support

Primary areas:

- `src/services/`
- `src/core/`
- `src/api/`
- `src/core_api/`
- `src/mcp/`

### 2. Hosted Control Plane

- Node.js backend
- user auth
- API key lifecycle
- onboarding
- integrations control plane
- dashboard telemetry support

Primary areas:

- `backend/`

### 3. Public SDK / Tooling Layer

- Python client
- CLI
- MCP bridge
- integration templates
- examples

Primary areas:

- `velocitybrain-open-source/`
- `src/client/`
- `src/cli.py`
- MCP integration templates under `integrations/`

## What Is Already Done Across The Ecosystem

### Core Runtime

- Postgres-backed memory model exists for entities, timeline, embeddings, relationships, skills, runs, and audits.
- Reuse engine is implemented and tested.
- Hosted `run` and `usage` contracts are implemented.
- Hosted query flow exists and degrades safely when retrieval is unavailable.
- MCP bridge and CLI surfaces exist.
- Runtime status and monitoring endpoints exist.

### Hosted Control Plane

- Node backend supports auth, settings, API keys, pairing sessions, usage, and dashboard endpoints.
- Dashboard onboarding and integrations pages exist.
- API key rotation, revocation, and agent pairing flows exist.
- Company integration control plane exists for Slack, Google Workspace, and GitHub.

### Public Distribution Boundary

- Open-source client package boundary already exists.
- Public package includes CLI, client SDK, MCP bridge, templates, and examples.
- Private/public boundary is documented in `docs/REPO_BOUNDARY.md`.

## Hardening Work Completed Recently

### 1. Local JSON Reuse Persistence Removed

Completed:

- reuse state is no longer backed by local mutable JSON files
- reuse persistence now uses PostgreSQL-backed runtime state snapshots
- memory-only fallback is allowed only when persistence is not required

Impact:

- safer for multi-instance deployment
- safer for crashes and restarts
- removes filesystem state dependency from the core reuse path

Relevant areas:

- `src/services/reuse_service.py`
- `migrations/schema.sql`

### 2. In-Memory Python Auth Session Dependency Removed

Completed:

- Python hosted API access tokens are now validated as signed JWTs
- requests re-check API key validity against the backend
- access is no longer tied to one Python process instance

Impact:

- better horizontal scaling behavior
- removes per-process token-store fragility

Relevant areas:

- `src/core_api/auth.py`
- `src/core/config.py`

### 3. Backend / Frontend Contract Drift Reduced

Completed:

- Python backend URL default aligned with the Node backend port
- dashboard stats semantics cleaned up
- backend API key route tests updated to the real contract shape

Impact:

- fewer mismatches between Python runtime, Node backend, and dashboard
- more reliable local and hosted behavior

Relevant areas:

- `src/core/config.py`
- `backend/routes/dashboard.js`
- `backend/__tests__/server.test.js`

### 4. Fake Embeddings Replaced With Real Hosted Embedding Support

Completed:

- OpenAI-compatible embedding provider support added
- deterministic fallback remains for local/offline safety

Impact:

- retrieval can now use real semantic embeddings in proper environments
- keeps developer fallback for offline work

Relevant areas:

- `src/services/embedding_service.py`
- `src/core/config.py`
- `.env.example`
- `.env.prod.example`

### 5. Filesystem Job Queue Removed

Completed:

- `jobs_queue.json` style local queue storage removed
- execution jobs now use a durable `execution_jobs` database table
- queue lifecycle supports `queued`, `running`, `retry`, `completed`, and `failed`

Impact:

- no local filesystem queue dependency
- better recovery and status tracking
- safer execution lifecycle for beta workloads

Relevant areas:

- `src/services/job_queue_service.py`
- `migrations/schema.sql`

### 6. Execution Engine Hardened

Completed:

- execution now creates real durable jobs
- action execution returns honest lifecycle state
- HTTP/webhook actions can execute for real when enough config is provided
- fake "simulated_success" behavior was reduced

Impact:

- more honest execution semantics
- better observability and job tracking
- moves the platform away from pretend-success behavior

Relevant areas:

- `src/services/execution_engine.py`
- `src/plugins/core_connectors.py`
- `src/services/connector_hub.py`

### 7. Workflow Execution History Surface Improved

Completed:

- workflow execution history endpoint now reads actual stored execution records
- placeholder empty execution history was removed

Relevant areas:

- `src/services/visual_workflow.py`
- `src/api/automation_routes.py`

### 8. Demo vs Live Integration Signaling Added

Completed:

- integrations now expose whether a connection is demo or live
- dashboard integrations UI now labels demo integrations honestly

Impact:

- prevents simulated OAuth flows from looking like real source connectivity

Relevant areas:

- `backend/utils/sourceIntegrations.js`
- `backend/routes/integrations.js`
- `dashboard/src/pages/Integrations.js`

## What Still Remains

These are still required before the ecosystem can be called a solid production-ready private beta.

### Execution / Workers

- add a dedicated worker process that continuously processes queued jobs
- move execution off inline request paths where appropriate
- add backoff and dead-letter handling
- add stronger timeout and cancellation handling

### Shared Runtime Infrastructure

- Redis-backed rate limiting
- Redis-backed coordination for distributed runtime behavior
- optional Redis-backed refresh/session controls if needed for hosted scale

### Real Integrations

- email/calendar/messaging connectors still need real provider-backed implementations
- current unwired connectors now fail honestly, but they are not complete
- source sync still needs stronger production ingestion behavior

### Contract Layer

- shared typed API contract between backend and dashboard is still missing
- OpenAPI generation or shared contract types should be added

### Testing

- more frontend integration tests
- onboarding journey coverage
- integrations journey coverage
- API key lifecycle coverage in frontend
- more end-to-end MCP flow coverage

### Observability

- stronger tracing across Python runtime, backend, and queue lifecycle
- better worker/job metrics
- more explicit failure dashboards for beta operations

## Current State Summary

Velocity Brain is no longer just a broad prototype with local-state shortcuts.

It now has:

- database-backed reuse persistence
- database-backed job queue persistence
- JWT-based hosted auth validation
- real semantic embedding support
- cleaner backend/dashboard contracts
- more honest execution and integration semantics

It is still not fully done.

The biggest remaining gaps are:

- dedicated workers
- Redis-backed shared runtime infrastructure
- real provider-backed connector execution
- stronger end-to-end contract/testing coverage

## What Should Remain Private

These areas should remain closed source.

### Core Private IP

- hosted reuse ranking logic
- artifact matching and reuse decision logic
- production savings heuristics
- hosted orchestration internals
- internal observability and operational analytics

### Hosted Control Plane

- account infrastructure
- billing and subscription logic
- hosted usage enforcement
- API key control plane internals
- pairing/session control logic
- company workspace management internals

### Sensitive Integrations

- provider token handling
- encrypted token storage logic
- internal sync pipelines
- private ingestion orchestration

### Internal Operations

- internal dashboards and operational metrics internals
- private deployment workflows
- private runbooks
- internal support tooling

## What Can Be Open Sourced

These areas can be public safely if kept cleanly separated from private runtime internals.

### Public SDK / Developer Tooling

- Python SDK
- public CLI
- MCP bridge
- developer-facing client wrappers

### Integration Templates

- MCP config templates
- setup helpers
- example integration configs
- local bootstrap scripts

### Examples And Documentation

- examples
- getting started docs
- public API usage docs
- CLI usage docs
- MCP setup docs

### Reusable Utility Infrastructure

- public-safe setup tooling
- public-safe contract helpers
- example test fixtures
- boundary checking scripts

## Recommended Open-Source Split

### Keep Private Repository Scope

- `backend/`
- `dashboard/`
- `src/services/` private orchestration internals
- `src/core_api/`
- sensitive production-only docs
- internal monitoring/ops logic

### Good Public Repository Scope

- `velocitybrain-open-source/`
- public CLI/client/MCP code only
- public config templates
- examples
- public docs

### Good Public Candidates For Reusable Infrastructure

- client SDK
- MCP bridge
- CLI bootstrap tooling
- install/config templates
- examples
- setup scripts
- public-safe contract helpers

## Open-Source Decision Rule

If a component reveals:

- how hosted reuse ranking works
- how internal orchestration works
- how account or billing infrastructure works
- how provider tokens are handled internally
- how private monitoring and operations are run

it should remain private.

If a component helps developers integrate with Velocity Brain without exposing private hosted internals, it can be public.

## Immediate Next Execution Priorities

Priority order should remain:

1. reliability
2. consistency
3. correct execution
4. real integrations
5. scalable infrastructure
6. UI polish
7. new features

That means the next implementation work should focus on:

- worker process for durable job execution
- Redis-backed shared runtime coordination
- real connector delivery implementations
- typed contracts between backend and dashboard
- stronger end-to-end testing and monitoring

## Final Position

Velocity Brain should continue evolving as:

- persistent reusable intelligence for coding-agent runs

not as:

- a generic bag of AI features

The right path is to keep hardening the current architecture direction until every visible part works reliably end-to-end.
