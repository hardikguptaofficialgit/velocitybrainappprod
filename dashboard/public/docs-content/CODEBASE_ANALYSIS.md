# Velocity Brain Codebase Analysis

## Executive Summary

Velocity Brain is a multi-part platform built around one central idea:

- provide a memory and reuse layer for coding agents
- retrieve prior useful context before the agent works
- reduce repeated prompt tokens and repeated reasoning cost
- expose the same core capability through CLI, API, and MCP interfaces

This repository is not a tiny single-service app. It is closer to a product monorepo with four main surfaces:

1. a Python core runtime for memory, retrieval, orchestration, and APIs
2. a Python CLI and MCP bridge for agent/tool integration
3. a Node.js backend for user accounts, API keys, dashboard data, and commercial product operations
4. a React dashboard for documentation, usage analytics, and account management

There is also an embedded `velocitybrain-open-source/` package that represents the public/open-source distribution boundary for the hosted client SDK and MCP bridge.

## What The Product Does

At a product level, Velocity Brain is trying to be the "memory layer" that sits between a coding agent and its work.

Instead of making an agent re-read the same repository context or regenerate the same answer repeatedly, the system:

- ingests notes, text, documents, and derived artifacts into memory
- stores structured entity pages and timeline events
- indexes content for keyword and vector-style retrieval
- performs brain-first lookup before answering or acting
- tracks reuse and token savings
- exposes that capability to local tools and hosted clients

In simple terms:

- users or agents put knowledge in
- the system stores it in a structured, searchable way
- future runs query the stored memory first
- the system returns reused context, answers, or run outputs with savings-oriented reporting

## High-Level Architecture

```text
                        +-----------------------------+
                        |      React Dashboard        |
                        | dashboard/                  |
                        +-------------+---------------+
                                      |
                                      v
                        +-----------------------------+
                        |    Node Backend (Express)   |
                        | backend/                    |
                        | auth, api keys, usage       |
                        +-------------+---------------+
                                      |
                                      v
+------------------+      +-----------------------------+      +------------------+
| Python CLI       | ---> | Python Core Runtime         | <--- | MCP Clients      |
| src/cli.py       |      | src/main.py + src/services/ |      | src/mcp_stdio.py |
| src/cli/main.py  |      | memory, retrieval, agent    |      | src/mcp/server.py|
+------------------+      +-------------+---------------+      +------------------+
                                      |
                                      v
                        +-----------------------------+
                        | PostgreSQL + pgvector       |
                        | migrations/schema.sql       |
                        +-----------------------------+
```

## Main Architectural Layers

### 1. Interface Layer

This is how external users or agents talk to the system.

- `src/cli.py`: the main Python CLI implementation for local and hosted workflows
- `src/cli/main.py`: a separate hosted/open-source-style CLI implementation
- `src/main.py`: FastAPI application entry point
- `src/mcp_stdio.py`: local stdio JSON-RPC MCP server
- `src/mcp/server.py`: hosted product-facing MCP server using the client SDK
- `backend/server.js`: Node backend for auth, API keys, dashboard data
- `dashboard/`: React UI

### 2. Application/API Layer

This layer turns requests into service calls.

- `src/api/routes.py`: core v1 routes like health, eval, audit, OpenClaw profile, runtime status
- `src/api/advanced_routes.py`: semantic, analytics, graph, multimodal routes
- `src/api/automation_routes.py`: workflow, rule, schedule, automation routes
- `src/api/enhanced_routes.py`: repository indexing, call graph, multi-agent, token optimization routes

The API layer is intended to stay thin and delegate work into `src/services/`.

### 3. Core Runtime/Domain Layer

This is the real engine of the product.

- `src/services/memory_engine.py`: writes and updates entities, timeline events, relationships, embeddings
- `src/services/retrieval_engine.py`: keyword, vector, and hybrid retrieval
- `src/services/agent_loop.py`: intent detection, planning, execution orchestration, persistence
- `src/services/skill_registry.py`: loads and validates JSON skills
- `src/services/execution_engine.py`: executes or simulates action plans
- many supporting services for analytics, graph, automation, compliance, context, monitoring, and reuse

### 4. Persistence Layer

This layer manages the canonical data model.

- `src/core/db.py`: connection management, schema bootstrap, vector serialization
- `migrations/schema.sql`, `enhanced_schema.sql`, `schema_constraints.sql`: relational schema
- Postgres is the canonical store
- pgvector is used for embeddings and nearest-neighbor retrieval

### 5. Configuration / Cross-Cutting Layer

- `src/core/config.py`: environment-driven configuration with validation
- `src/core/security.py`: validation, sanitization, token manager placeholder, rate limiter
- `src/core/logging_config.py`: structured logging
- `src/background/scheduler.py`: periodic maintenance jobs
- `src/monitoring/health_monitor.py`: health and metrics support

### 6. Commercial Product Layer

This is separate from the Python core and handles account/business features.

- `backend/`: Express backend with Firebase-backed user and API-key management
- `dashboard/`: customer dashboard and docs UI

### 7. Public/Open-Source Distribution Boundary

- `velocitybrain-open-source/`: public client package
- this contains the hosted client SDK, CLI, MCP bridge, examples, tests, and integrations
- `docs/REPO_BOUNDARY.md` explicitly says the public package must not import private core runtime modules

This means the repo mixes:

- private or full product runtime code
- hosted product wrappers
- open-source client distribution code

## Core Runtime Flow

The intended system flow is:

```text
Input/Signal
  -> detect intent
  -> retrieve existing internal memory
  -> create plan
  -> execute actions
  -> write useful memory back
  -> expose output through CLI/API/MCP
```

In code, the clearest path is:

1. input arrives through CLI, API, or MCP
2. `RetrievalEngine.hybrid_search()` looks for internal matches first
3. `AgentLoop` classifies the request into query/planning/execution/ingestion
4. a step plan is built
5. `ExecutionEngine` runs or simulates actions
6. `MemoryEngine` may persist updates
7. runs and actions are stored for traceability

## Important Core Components

### Memory Engine

`src/services/memory_engine.py` is one of the most central files.

It currently:

- converts text into an entity page
- creates or updates `entities`
- writes immutable `timeline_events`
- stores compiled truth
- creates embeddings for retrieval
- optionally infers a simple company/person relationship

Conceptually, this is the knowledge write path.

### Retrieval Engine

`src/services/retrieval_engine.py` is the main read path.

It supports:

- keyword search over titles, slugs, and compiled truth
- vector search over stored embeddings
- hybrid fusion and reranking
- small query expansion rules for better recall

This is the code that enforces the "brain-first lookup" idea.

### Agent Loop

`src/services/agent_loop.py` is the orchestrator.

It:

- detects intent
- fetches context from retrieval
- produces a plan
- runs actions
- stores memory updates
- persists run history

It is the closest thing in this repo to the "application brain".

### Skill Registry

`src/services/skill_registry.py` loads `skills/**/*.json`.

It:

- validates skill structure
- normalizes manifest shapes
- lists the available skills
- resolves a user intent to matching skills

The architecture choice here is content-driven capability definition rather than hardcoding every workflow in Python.

### Execution Engine

`src/services/execution_engine.py` is intentionally lightweight right now.

It mainly:

- simulates deterministic execution steps
- returns structured action logs
- acts as a placeholder for real adapters

This suggests the product direction is larger than the current concrete implementation in some areas.

## API Architecture

## v1 Core API

In `src/api/routes.py`, the main exposed concerns are:

- health
- evaluation
- audit access
- OpenClaw profile/capabilities
- runtime status

This file feels like the operational/control API rather than the main user product API.

## v2 Advanced API

The v2 routes expand the system significantly:

- semantic analysis
- semantic search
- KPI and forecast analytics
- knowledge graph traversal and inference
- multimodal processing
- visual workflows
- rules and decision trees
- schedules and event-driven automation
- repository indexing
- call graph analysis
- intelligent context expansion
- multi-agent collaboration
- token optimization

Architecturally, this means the repository contains both:

- a focused memory/reuse product core
- a broader "AI operating system" style ambition with many advanced modules

## MCP Architecture

There are effectively two MCP stories in this repo.

### Local/Core MCP

`src/mcp_stdio.py` exposes local tools such as:

- `ingest_text`
- `query`
- `lookup_memory`
- `run_agent`
- `sync_brain`
- policy-gated mutation tools
- connector actions

This server talks directly to local services like `MemoryEngine`, `RetrievalEngine`, `AgentLoop`, and `SkillRegistry`.

### Hosted/Public MCP

`src/mcp/server.py` is product-facing and much smaller.

It exposes hosted tools like:

- `run_agent`
- `usage`

This one talks to `VelocityBrainClient` instead of the local service layer.

This distinction is important:

- one MCP surface is local/self-hosted/core-runtime oriented
- the other is hosted-SDK/product oriented

## CLI Architecture

There are also two CLI paths.

### Main CLI

`src/cli.py` is the richer CLI and supports runtime-mode selection:

- `auto`
- `cloud`
- `self-hosted`

It includes:

- cloud client normalization
- local doctor/smoke behaviors
- schema bootstrap
- skill inventory and validation
- caveman tooling
- sync and reuse features

### Hosted/Open-Source CLI

`src/cli/main.py` is a cleaner SDK-style CLI built around `VelocityBrainClient`.

This looks closer to the public distribution model and mirrors what exists in `velocitybrain-open-source/`.

## Data Model Overview

From the code and migrations, the major concepts are:

- `entities`: the main knowledge unit
- `entity_versions`: change history of compiled truth
- `timeline_events`: append-only evidence/events
- `embeddings`: vector chunks used for retrieval
- `relationships`: links between entities
- `agent_runs`: persisted agent executions
- `execution_actions`: actions performed in a run
- `optimization_jobs`: background maintenance jobs

This design follows a strong pattern:

- mutable summary state in entity pages
- immutable event history in timeline tables
- retrieval accelerators in embeddings
- explainability and auditability through runs and action logs

## Folder Structure

Below is the practical folder map of the repository.

```text
velocitybrain/
  backend/                    Node/Express commercial backend
    config/                   Firebase and access policy setup
    middleware/               Auth middleware
    routes/                   Auth, API keys, usage, dashboard endpoints
    __tests__/                Backend route tests

  dashboard/                  React customer dashboard
    public/                   Static assets
    src/
      components/             Shared UI
      contexts/               Auth and theme contexts
      lib/                    API/network helpers
      pages/                  Dashboard, docs, auth, settings pages

  docs/                       Product and technical documentation
    public/                   Public-facing docs
    private/                  Private/internal docs
    evidence/                 Smoke-test screenshots and output

  migrations/                 PostgreSQL schema files

  nginx/                      Reverse proxy config

  scripts/                    Utility, setup, smoke, benchmark, and verification scripts

  skills/                     JSON skill catalog
    automation/
    enrichment/
    execution/
    ingestion/
    intelligence/
    maintenance/
    monitoring/
    planning/
    query/
    research/

  src/                        Main Python runtime
    api/                      FastAPI routes
    background/               Scheduler jobs
    cli/                      Secondary/public-style CLI package
    client/                   Hosted API client SDK
    core/                     Config, DB, security, logging
    core_api/                 Alternate/older hosted core API surface
    mcp/                      Hosted MCP server and enhanced MCP tools
    models/                   Pydantic models
    monitoring/               Health monitoring
    plugins/                  Connector manifests/hooks
    services/                 Core domain services
    skills/                   Python-side skill helpers/examples
    workflows/                JSON workflow blueprints
    cli.py                    Main CLI
    main.py                   Main FastAPI app
    mcp_stdio.py              Local stdio MCP server

  tests/                      Python tests

  velocitybrain-open-source/  Public distribution package boundary
    src/velocitybrain_client/ Public client SDK, CLI, MCP bridge
    integrations/             Claude/OpenClaw/MCP integration assets
    tests/                    Public-package tests

  web/                        Static guide frontend assets
  data/                       Local runtime storage
  dist/                       Build artifacts
```

## What Each Major Top-Level Area Is For

### `src/`

This is the heart of the system. If someone asks "where is the actual product logic?", this is the first answer.

### `backend/`

This powers customer identity and API key lifecycle rather than the memory engine itself.

From the code:

- `routes/auth.js` handles registration, login, profile, 2FA
- `routes/apiKeys.js` handles creation, listing, update, deletion, validation
- the backend uses Firebase/Firestore as the application database for users and keys

### `dashboard/`

This is the customer-facing control panel and docs interface.

It includes:

- dashboard analytics
- API key management
- agent support pages
- settings and login flows
- a markdown-based docs reader

### `skills/`

This is the declarative workflow catalog.

The repo currently contains:

- 72 skill manifest JSON files

These are grouped by capability type and allow the platform to add behavior without rewriting core routers for every new workflow.

### `velocitybrain-open-source/`

This is the public boundary package.

Its purpose is:

- publishable/open-source client SDK
- hosted-only CLI
- public MCP bridge
- safe separation from proprietary or private internals

## Current Counts And Scale

Based on the repository contents at the time of analysis:

- `src/services/`: 53 Python service modules
- `skills/`: 72 JSON skill manifests
- `tests/`: 25 Python test files
- `velocitybrain-open-source/src/velocitybrain_client/`: 9 Python files

This confirms the repo is not a prototype folder dump. It is a moderately large monorepo with several product surfaces and a broad feature footprint.

## Architectural Strengths

### 1. Clear core idea

The product concept is consistent across docs and code:

- memory first
- reuse before recomputation
- savings visibility
- agent-native interfaces

### 2. Good separation of concerns in the Python runtime

The runtime broadly separates:

- config/security/db
- API routes
- service-layer logic
- background jobs
- interface adapters like CLI and MCP

That is a healthy architecture for continued growth.

### 3. Declarative skill system

Using JSON skills reduces the amount of hardcoded routing logic and makes the system easier to extend.

### 4. Multi-surface strategy

The repo supports:

- local developer workflows
- hosted SaaS workflows
- MCP-native agent workflows
- customer dashboard workflows

That aligns well with the product direction.

### 5. Strong documentation footprint

The repo already includes docs for:

- architecture
- folder structure
- workflows
- deployment
- API contracts
- public/private boundary

That is a strong sign of product and platform intent.

## Architectural Weaknesses / Complexity Risks

### 1. Multiple overlapping entry points

There are several overlapping surfaces:

- `src/main.py`
- `src/core_api/main.py`
- `src/cli.py`
- `src/cli/main.py`
- `src/mcp_stdio.py`
- `src/mcp/server.py`

This is manageable, but it increases cognitive load. A new engineer may not immediately know:

- which API is primary
- which CLI is canonical
- which MCP server is for local vs hosted use
- which code path is current vs legacy vs public-boundary packaging

### 2. Mixed product scopes in one repo

The repository contains:

- self-hosted/local runtime logic
- hosted SaaS wrappers
- commercial account management
- public open-source packaging
- experimental advanced AI subsystems

This is powerful, but it creates architectural sprawl.

### 3. Some modules appear more aspirational than fully integrated

A number of advanced service modules exist, but not all of them appear equally central or equally production-integrated.

Examples:

- `ExecutionEngine` is still a simulation stub
- some advanced v2 capabilities are much broader than the core memory/reuse story
- some services depend on optional ML packages and fall back when unavailable

This suggests the codebase mixes:

- core product-critical paths
- platform experiments
- future-facing feature scaffolding

### 4. Security/auth implementation differs by layer

The Python runtime has its own token/rate-limit helpers.
The Node backend has its own JWT/auth and Firebase identity model.

This is sometimes unavoidable, but it means authentication is not unified into one single platform security model.

### 5. `core_api` vs `src/main.py` split is potentially confusing

`src/core_api/` appears to represent a distinct or older hosted API architecture, while `src/main.py` is the broader current FastAPI app.

This should be explicitly documented for maintainers as:

- primary
- secondary
- legacy
- experimental

without that, future changes may drift or duplicate effort.

## Practical Mental Model For The Repo

The easiest way to understand this repository is:

### Layer A: Product engine

The Python runtime under `src/` is the actual memory/retrieval/orchestration engine.

### Layer B: Access surfaces

CLI, MCP, and FastAPI expose that engine to users and agents.

### Layer C: Commercial wrapper

The Node backend and React dashboard manage users, API keys, analytics, and SaaS-style product UX.

### Layer D: Public packaging boundary

`velocitybrain-open-source/` packages the safe public client-side pieces for outside consumption.

## Suggested "Primary Architecture" Statement

If this project needs one clean architecture statement for onboarding, this is the one I would use:

> Velocity Brain is a Python-centered memory and retrieval engine for coding agents, backed by PostgreSQL/pgvector, exposed through CLI, FastAPI, and MCP, and wrapped by a separate Node/React commercial product layer for authentication, API key management, analytics, and documentation.

## Recommended Onboarding Order

For a new engineer, the best reading order is:

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `src/main.py`
4. `src/api/routes.py`
5. `src/services/memory_engine.py`
6. `src/services/retrieval_engine.py`
7. `src/services/agent_loop.py`
8. `src/services/skill_registry.py`
9. `src/mcp_stdio.py`
10. `backend/server.js`
11. `dashboard/src/App.js`
12. `docs/REPO_BOUNDARY.md`

## Final Conclusion

This codebase is a serious multi-surface platform, not just a single Python package.

Its true center is the Python memory/retrieval/orchestration runtime. Around that center, the repo adds:

- hosted/client SDK packaging
- MCP integration
- a commercial account and API-key backend
- a customer dashboard
- a large declarative skill library
- advanced experimental or premium AI features

The most accurate description is:

- a monorepo for an agent-memory platform
- with both local/self-hosted and hosted/SaaS concerns
- where the core value is reusable knowledge and reduced repeated token cost

## Files Referenced For This Analysis

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FOLDER_STRUCTURE.md`
- `docs/REPO_BOUNDARY.md`
- `pyproject.toml`
- `src/main.py`
- `src/cli.py`
- `src/cli/main.py`
- `src/mcp_stdio.py`
- `src/mcp/server.py`
- `src/api/routes.py`
- `src/api/advanced_routes.py`
- `src/api/automation_routes.py`
- `src/api/enhanced_routes.py`
- `src/core/config.py`
- `src/core/db.py`
- `src/core/security.py`
- `src/background/scheduler.py`
- `src/services/memory_engine.py`
- `src/services/retrieval_engine.py`
- `src/services/agent_loop.py`
- `src/services/skill_registry.py`
- `src/services/execution_engine.py`
- `backend/server.js`
- `backend/routes/auth.js`
- `backend/routes/apiKeys.js`
- `dashboard/src/App.js`
- `dashboard/src/pages/Documentation.js`
- `dashboard/src/pages/Dashboard.js`
- `velocitybrain-open-source/README.md`
