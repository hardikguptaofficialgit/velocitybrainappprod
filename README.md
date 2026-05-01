<p align="center">
  <img src="https://raw.githubusercontent.com/hardikguptaofficialgit/velocitybrain/2555e6ca7880bf9e1ab291d2253ac3b23b115e82/docs/assets/velocity-brain-logo.svg" alt="Velocity Brain logo" width="600" />
</p>

<p align="center">
  <strong>Hosted Memory and Reuse Layer for Coding Agents</strong><br/>
  CLI-native. MCP-ready. Built to avoid paying for the same tokens twice.
</p>

## Velocity Brain

Coding agents get smarter and cheaper every time they run.

Velocity Brain is a **hosted memory and reuse platform** for coding agents. It stores reusable outputs once, retrieves only the context that matters, and reports saved tokens, saved cost, and reuse hits across CLI, API, and MCP interfaces.

### Product Shape

- **Product**: hosted memory + reuse layer for coding agents
- **Open source**: SDK + MCP bridge + integrations
- **Core value**: less repeated prompt context, lower token cost, faster repeated runs

### Production Highlights

- **Enterprise Security**: SQL injection protection, XSS prevention, authentication, rate limiting
- **Comprehensive Monitoring**: Health checks, metrics collection, performance tracking
- **Robust Error Handling**: Structured logging, audit trails, graceful degradation
- **Data Integrity**: Database constraints, validation, backup & recovery procedures
- **Production Deployment**: Docker containers, reverse proxy, SSL/TLS support
- **Extensive Testing**: Security tests, integration tests, database integrity tests

Core value:
- **Reusable coding memory instead of repeated prompt context**
- **Hosted retrieval before work**
- **Per-run savings reporting**
- **MCP tools for compatible coding clients**
- **Open-source distribution layer with proprietary hosted reuse core**

## What Velocity Brain Does

Velocity Brain detects signals, performs brain-first lookup, ingests content, enriches entities, manages tasks, schedules cron jobs, generates reports, and supports connector-backed automations with **production-grade reliability and security**.

It ensures:

* **Memory is accessed before action**
* **Information is structured and retrievable**
* **Citations and compiled truth stay consistent**
* **Tasks and automations run reliably**
* **MCP clients can call the same runtime tools**
* **Security and compliance requirements are met**
* **System health and performance are monitored**

## Core System Capabilities

### 🔒 **Security & Authentication**
- **Enterprise-grade authentication** with JWT tokens and scope-based authorization
- **Input validation and sanitization** preventing SQL injection and XSS attacks
- **Rate limiting** to prevent abuse and ensure system stability
- **Audit logging** for all security-relevant events
- **Policy enforcement** for destructive operations
- **Secure configuration management** with validation

### 📊 **Monitoring & Observability**
- **Comprehensive health checks** covering database, filesystem, memory, and external dependencies
- **Real-time metrics collection** for system performance, database stats, and application metrics
- **Structured logging** with JSON format for easy integration with log management systems
- **Prometheus integration** for time-series monitoring
- **Grafana dashboards** for visualization and alerting

###   **Signal Detection & Thought Capture**
A lightweight intent layer routes requests into ingestion, query, planning, execution, or maintenance flows. The agent loop preserves the original signal, captures entities, and writes back useful memory with **enhanced error handling and logging**.

### 🔍 **Brain-First Lookup Protocol**
All main workflows begin with internal retrieval. The runtime prefers existing knowledge before synthesis or execution, which keeps results consistent with prior memory and **validates all queries for security**.

### 📥 **Content & Media Ingestion**
The shipped CLI supports inline text, files, and Org-mode ingestion. The skill library also includes manifests for article, PDF, video, audio, and OCR-style workflows with **file size limits and validation**.

### 🏷️ **Entity Enrichment**
Entities are stored as structured pages with timeline evidence, compiled truth, and relationship data, **enforced by database constraints**.

###   **Task & Cron Management**
The runtime includes deterministic job execution, background scheduler hooks, and job queue storage for repeatable operational workflows with **error recovery and retry mechanisms**.

###   **Connector-Backed Automations**
Execution adapters cover email, calendar, messaging, and Google Workspace style actions. Destructive operations stay **policy-gated and audit-logged**.

## Intelligence & Routing Layer

### 🎯 **RESOLVER-style Skill Dispatch**
Requests are matched to the right skill or workflow from the JSON skill registry. The router and agent loop use intent, keywords, and internal retrieval to decide what happens next, **with enhanced skill validation and error handling**.

The current categories are:

* **Always-on**
* **Brain operations**
* **Ingestion**
* **Thinking**
* **Operational**

## Identity & System Configuration

### 🆔 **Identity Spec Layer**
`identity.spec.json` sits above the runtime defaults and describes the agent identity and policy posture, **with validation and security checks**.

### 🔐 **Identity Outputs**
The project supports identity and policy-oriented outputs through the existing identity spec service and access-control services, **with comprehensive audit logging**.

## Access Control

Out-of-the-box access control includes:

* **Full**
* **Work**
* **Family**
* **None**

Destructive MCP tools are **policy-gated and audit-logged**, and the runtime also supports signed access tokens and encrypted legacy-plan storage.

## Operational Standards

Velocity Brain applies a shared set of operational rules:

* **Brain-first lookup discipline**
* **Citation and confidence requirements** in query output
* **Deterministic action execution**
* **Test-before-bulk safeguards** for sync and mutation flows
* **Audit logging for high-risk events**
* **Health monitoring and alerting**
* **Performance metrics collection**
* **Security event tracking**

## Skill System

Velocity Brain includes **65** JSON-defined skills, each with:

* **Metadata fields** for name, version, category, and triggers
* **Defined workflow steps** with validation
* **Validation rules** and error handling
* **Standardized output structure**
* **Security validation** and input sanitization

All skills are:

* **Loaded from `skills/**/*.json`** with comprehensive validation
* **Available through the `skills` CLI and MCP toolset**
* **Extensible without changing the router** for every new capability
* **Validated for security** and structure compliance

## Conformance & Architecture

* **Skills follow a unified manifest shape** with strict validation
* **Legacy behavior is being consolidated** into reusable skills
* **Ingestion, query, execution, and maintenance remain separated** by workflow
* **The runtime is built to stay deterministic and auditable**
* **Production-ready with comprehensive testing** and monitoring

## Setup & Runtime

### 🏠 **Local Development**
* **Fully working brain in about 30 minutes** on a local machine
* **Database initialization is automated** through the provided schema bootstrap
* **Minimal configuration is required** beyond Postgres and environment variables
* **The system becomes operational immediately** after setup checks pass

### 🚀 **Production Deployment**
* **Docker Compose production setup** with all services
* **Nginx reverse proxy** with SSL/TLS termination
* **Redis for caching** and session storage
* **Prometheus and Grafana** for monitoring
* **Automated backup procedures** and recovery
* **Security hardening** and best practices

## Outcome

Velocity Brain turns an AI agent into a continuously improving system that:

* **Thinks before responding**
* **Remembers context**
* **Organizes knowledge automatically**
* **Executes tasks reliably**
* **Improves over time without supervision**
* **Maintains security and compliance**
* **Provides operational visibility**

## Install

From PyPI:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install velocitybrain
```

From local repo (dev mode):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -e .
```

## Quick Start (Hosted)

### 1) Install and authenticate

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install velocitybrain
velocitybrain login --api-key vb_live_xxx
velocitybrain doctor
velocitybrain doctor --verbose
velocitybrain smoke
```

### 2) Connect your MCP client

```powershell
velocitybrain connect codex
velocitybrain connect codex --apply
```

Velocity Brain runs as a local MCP bridge that forwards requests to the hosted backend. No local DB or Docker setup is required in hosted mode.

## Legacy Local / Self-Hosted (Dev-Only)

### 1) Configure environment

```powershell
Copy-Item .env.example .env
```

### 2) Start and initialize database

```powershell
docker compose up db -d
docker compose exec -T db psql -U velocity -d velocitybrain -f /docker-entrypoint-initdb.d/01-schema.sql
```

### 3) Validate setup

```powershell
velocitybrain init
velocitybrain doctor
```

### 4) Core workflows

```powershell
velocitybrain ingest --source note --content "Auth uses Firebase on the frontend and backend session sync through /api/auth/firebase-session."
velocitybrain query "What do we know about auth and API key flows in this repo?"
velocitybrain run "Prepare me to refactor the API key system in this large codebase"
```

## Production Deployment

### 🚀 **Quick Production Setup**

```powershell
# Copy production environment template
Copy-Item .env.prod.example .env.prod

# Edit .env.prod with your secure values
# Generate secure passwords and tokens

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check deployment status
docker-compose -f docker-compose.prod.yml ps
```

### 📊 **Access Production Services**

- **API**: `https://your-domain.com`
- **Health Check**: `https://your-domain.com/v1/healthz`
- **Detailed Health**: `https://your-domain.com/v1/health/detailed`
- **API Documentation**: `https://your-domain.com/docs`
- **Monitoring**: Grafana at `https://your-domain.com:3000`
- **Metrics**: Prometheus at `https://your-domain.com:9090`

For detailed production deployment instructions, see [**Production Deployment Guide**](docs/PRODUCTION_DEPLOYMENT.md).

## How Answers Work Today

`velocitybrain query` and `velocitybrain run` do not call Claude/OpenAI/Gemini APIs by default.

- `query`: **keyword + hybrid retrieval from internal memory tables** with input validation
- `run`: **intent detection + deterministic plan + simulated execution + local writeback** with security checks

When connected through MCP, external clients (Claude Code/Codex/etc.) call these tools. In hosted mode the local CLI acts as a thin bridge to the proprietary hosted reuse backend. Self-hosted mode remains legacy/dev-only.

## CLI Reference

```powershell
velocitybrain about
velocitybrain init --bootstrap-schema
velocitybrain connect codex
velocitybrain smoke
velocitybrain doctor
velocitybrain doctor --verbose
velocitybrain ingest --source note --content "..."
velocitybrain ingest --source notes --org-file ./notes/daily.org
velocitybrain query "..."
velocitybrain --response-style full query "..."
velocitybrain run "..."
velocitybrain --response-style lite run "..."
velocitybrain caveman-commit "fix auth null dereference and add guard"
velocitybrain caveman-review "L42 null user dereference can crash request path"
velocitybrain caveman-compress ./docs/CLIENT_INTEGRATIONS.md
velocitybrain sync --repo .
velocitybrain sync --repo C:/repo-a --repo C:/repo-b --apply
velocitybrain identity
velocitybrain openclaw
velocitybrain status
velocitybrain serve api --host 0.0.0.0 --port 8080 --reload
velocitybrain serve mcp
```

Output controls:

```powershell
velocitybrain --json query "What changed this week?"
velocitybrain --color about
velocitybrain --no-color about
```

## Plugin Setup (MCP)

Velocity Brain acts as an MCP server process. One server config works across clients.

Start MCP server manually:

```powershell
velocitybrain serve mcp
```

Generic MCP config:

```json
{
  "mcpServers": {
    "velocitybrain": {
      "command": "velocitybrain",
      "args": ["serve", "mcp"]
    }
  }
}
```

If PATH lookup fails, use full executable path:

```json
{
  "mcpServers": {
    "velocitybrain": {
      "command": "C:/Path/To/Python/Scripts/velocitybrain.exe",
      "args": ["serve", "mcp"]
    }
  }
}
```

Client-specific examples:
- Claude Code CLI:

```powershell
claude mcp add velocitybrain -- velocitybrain serve mcp
```

- OpenAI Codex CLI:

```powershell
codex mcp add velocitybrain -- velocitybrain serve mcp
```

Basic Codex flow:

1. For hosted mode, run `velocitybrain login --api-key vb_live_xxx`
2. Start the MCP bridge with `velocitybrain serve mcp`
3. Register the MCP server in Codex with `velocitybrain connect codex --apply`
4. Keep the repository `AGENTS.md` file so Codex knows to consult Velocity Brain automatically for internal knowledge lookups
5. Restart Codex if needed so it picks up the new MCP server
6. Ask normal questions like `What do we know about auth and API key flows in this repo?` or `Prepare me to review this large codebase before changing auth`
7. Use `velocitybrain smoke` when you want a quick end-to-end hosted verification
8. Use `response_style` when you want shorter or denser outputs

- OpenClaw / Gemini CLI / Cline / Antigravity / any MCP-capable client:
Use the same `mcpServers` JSON config in that client's MCP settings.

Turnkey setup assets are available in:

- `integrations/mcp/claude-code/mcpServers.velocitybrain.json`
- `integrations/mcp/openclaw/mcpServers.velocitybrain.json`
- `scripts/setup_mcp_plugin.ps1`

One-command plugin setup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client codex
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client openclaw
```

If `velocitybrain` is not on PATH, resolve to absolute executable path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude -UseAbsoluteCommandPath
```

Available MCP tools:
- `ingest_text`
- `query`
- `lookup_memory`
- `run_agent`
- `caveman_commit`
- `caveman_review`
- `caveman_compress`
- `sync_brain` (policy-gated)
- `put_page` (policy-gated)
- `delete_page` (policy-gated)
- `google_workspace_action`
- `get_identity_spec`
- `list_skills`
- `healthz`

Response style control for agents (including OpenClaw/Claude/Codex/Gemini):

- `response_style: "normal"` (default)
- `response_style: "lite"` (concise)
- `response_style: "full"` (caveman-style compression)
- `response_style: "ultra"` (maximum compression)

Example MCP tool call arguments:

```json
{
  "name": "query",
  "arguments": {
    "question": "Why does this component re-render?",
    "response_style": "full"
  }
}
```

Markdown context compression example:

```json
{
  "name": "caveman_compress",
  "arguments": {
    "file_path": "docs/CLIENT_INTEGRATIONS.md",
    "response_style": "full",
    "write_backup": true
  }
}
```

Claude mode persistence hooks (optional):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install_claude_caveman_hooks.ps1
```

Hooks are in `integrations/claude/hooks` and provide SessionStart activation + prompt mode tracking.

Measure token reduction for your own prompts:

```powershell
& ".venv-test/Scripts/python.exe" scripts/response_style_benchmark.py
```

## API Usage

### 🚀 **Start Production API**

```powershell
velocitybrain serve api --host 0.0.0.0 --port 8080
```

### 🔗 **Main Endpoints**

- **Health**: `GET /v1/healthz`
- **Detailed Health**: `GET /v1/health/detailed`
- **API Docs**: `http://localhost:8080/docs`
- **Guide App**: `http://localhost:8080/guide`
- **Docs Pages**: `GET /v1/docs/pages`
- **Docs Content**: `GET /v1/docs/page/{slug}`
- **Retrieval Eval**: `POST /v1/eval/query` (requires authentication)
- **Audit Events**: `GET /v1/audit/recent` (admin only)
- **Runtime Status**: `GET /v1/runtime/status`

### 🔐 **API Security**

- **Bearer token authentication** required for protected endpoints
- **Rate limiting** applied to prevent abuse
- **Input validation** and sanitization on all endpoints
- **Audit logging** for all security-relevant operations
- **CORS support** for web applications

## New User Test Flow

If you are testing Velocity Brain as a brand new user:

1. Start the backend and frontend locally
   - Backend/API app: `cd backend && npm install && npm run dev`
   - Frontend dashboard: `cd dashboard && npm install && npm start`
2. Open `http://localhost:3000`
3. Click `Start Now` or `Sign In`
4. Create an account or use the enabled OAuth provider
5. Confirm you land in the dashboard without CORS or auth errors
6. Open `Usage` and verify the daily quota card loads
7. Open `API Keys`, create a key, and confirm it shows a masked prefix plus quota
8. Open `Documentation` and confirm the limited-time free access messaging appears
9. If you use Codex, register the MCP server and run a test query through it

Suggested first Codex test:

```text
What do we know about auth and API key flows in this repo?
```

Suggested first CLI test:

```powershell
velocitybrain ingest --source note --content "Auth uses Firebase on the frontend and backend session sync through /api/auth/firebase-session."
velocitybrain query "What do we know about auth and API key flows in this repo?"
velocitybrain run "Prepare me to refactor the API key system in this large codebase"
```

OpenClaw profile export command:

```powershell
velocitybrain openclaw
```

Unified runtime status command:

```powershell
velocitybrain status
```

## Security Features

### 🛡️ **Enterprise Security**

- **SQL Injection Prevention**: All database queries are parameterized and validated
- **XSS Protection**: HTML content is sanitized and escaped
- **Input Validation**: Comprehensive validation for all user inputs
- **Authentication**: JWT-based authentication with configurable TTL
- **Authorization**: Scope-based access control
- **Rate Limiting**: Configurable rate limits per client
- **Audit Logging**: Comprehensive audit trail for security events
- **Policy Enforcement**: Configurable policies for destructive operations

### 🔍 **Security Monitoring**

- **Real-time Security Events**: Immediate logging of security-relevant events
- **Failed Authentication Tracking**: Monitor and alert on authentication failures
- **Unauthorized Access Attempts**: Track and block suspicious activity
- **Policy Violations**: Log all policy violations and enforcement actions

## Guide App

The built-in guide at `http://localhost:8080/guide` now includes:

- Live API status (`/v1/healthz`)
- Docs page count (`/v1/docs/pages`)
- OpenClaw capability summary (`/v1/openclaw/capabilities`)
- Recent audit snapshot (`/v1/audit/recent`)

The guide uses a flat, brand-aligned color language (solid panels with orange accent), with no glow or gradient-heavy treatment.

## Monitoring & Observability

### 📊 **Health Monitoring**

Velocity Brain includes comprehensive health monitoring:

- **Database Health**: Connection status, performance metrics, query analysis
- **System Health**: CPU, memory, disk usage, network connectivity
- **Application Health**: Service status, error rates, response times
- **External Dependencies**: Health checks for external services

### 📈 **Metrics Collection**

- **System Metrics**: CPU, memory, disk, network usage
- **Database Metrics**: Connection counts, query performance, index usage
- **Application Metrics**: Request counts, error rates, response times
- **Business Metrics**: Active users, skill usage, task completion rates

### 🚨 **Alerting**

- **Health Status Alerts**: Immediate alerts for service degradation
- **Performance Alerts**: Alerts for slow queries, high error rates
- **Security Alerts**: Alerts for authentication failures, policy violations
- **Capacity Alerts**: Alerts for resource exhaustion

## Retrieval Quality

Velocity Brain now includes a retrieval evaluation harness for measuring precision@k, recall@k, groundedness, and hallucination risk.

- API endpoint: `POST /v1/eval/query`
- Benchmark dataset: `data/retrieval_benchmark.json`
- Benchmark runner: `scripts/retrieval_benchmark.py`

## Testing

###   **Comprehensive Test Suite**

```powershell
# Run all tests
python -m pytest -q

# Run security tests
python -m pytest tests/test_production_security.py -v

# Run database integrity tests
python -m pytest tests/test_database_integrity.py -v

# Run with coverage
python -m pytest --cov=src --cov-report=html
```

### 🔒 **Security Testing**

- **Input Validation Tests**: Verify all inputs are properly validated
- **Authentication Tests**: Test authentication and authorization mechanisms
- **SQL Injection Tests**: Verify database query protection
- **XSS Tests**: Verify cross-site scripting protection
- **Rate Limiting Tests**: Verify rate limiting functionality

### 🗄️ **Database Tests**

- **Constraint Validation**: Test all database constraints
- **Data Integrity**: Verify data consistency and relationships
- **Performance Tests**: Test query performance and optimization
- **Backup/Recovery**: Test backup and recovery procedures

## Security and Reliability Improvements

- Runtime identity spec layer (`identity.spec.json`) above `AGENTS.md`
- Workspace-bounded file reads for ingestion by default
- Policy enforcement for destructive MCP tools
- Audit trail for destructive MCP approvals and denials
- FastAPI lifespan startup handler (no deprecation warning)
- Sync dry-run is non-mutating and supports multiple repositories
- Configurable embedding provider/model/dimension/router
- DB connect/lock/statement timeout controls
- Org-mode ingestion support and sync discovery
- Evaluation metrics endpoint (`precision@k`, `recall@k`, latency)
- Encrypted legacy-plan storage and token-based access primitives

Key env flags in `.env.example`:
- `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `MODEL_ROUTER`, `EMBED_DIM`
- `MCP_ALLOW_DESTRUCTIVE_TOOLS`
- `ALLOW_UNSAFE_FILE_READS`
- `WORKSPACE_ROOT`
- `IDENTITY_SPEC_PATH`

## Publish to PyPI

### 1) Prepare release metadata

```powershell
python -m pip install --upgrade build twine
```

- Bump `version` in `pyproject.toml` for each release.
- Keep project name as `velocitybrain`.

### 2) Build clean artifacts

```powershell
Remove-Item -Recurse -Force dist,build,*.egg-info -ErrorAction SilentlyContinue
python -m build
```

### 3) Validate artifacts

```powershell
python -m twine check dist/*
```

### 4) Upload to TestPyPI (recommended first)

```powershell
$env:TWINE_USERNAME="__token__"
python -m twine upload --repository-url https://test.pypi.org/legacy/ dist/*
```

Validate in clean venv:

```powershell
python -m venv .venv-test
.\.venv-test\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple velocitybrain==0.10.0
velocitybrain about
```

### 5) Upload to PyPI

```powershell
$env:TWINE_USERNAME="__token__"
python -m twine upload --repository-url https://upload.pypi.org/legacy/ dist/*
```

### 6) Verify from PyPI

```powershell
python -m pip install --upgrade velocitybrain
velocitybrain about
```

Token safety notes:
- Never commit tokens.
- Do not persist tokens using `setx` on shared machines.
- If a token is exposed in chat/logs, revoke immediately and issue a new token.

## Testing

```powershell
python -m pytest -q
```

## Backward Compatibility

Legacy commands still work:
- `velocityx ...`
- `python velocityx.py ...`

## Documentation

###   **Comprehensive Documentation**

- **[Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md)** - Complete production setup
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design
- **[API Design](docs/API_DESIGN.md)** - API specification and usage
- **[Database Schema](docs/DB_SCHEMA.md)** - Database structure and constraints
- **[Security Guide](docs/SECURITY.md)** - Security features and configuration
- **[Skill System](docs/SKILL_SYSTEM.md)** - Skill development and usage
- **[Client Integrations](docs/CLIENT_INTEGRATIONS.md)** - MCP client setup

## Reference Links

- Claude Code MCP docs: https://docs.claude.com/en/docs/claude-code/mcp
- Gemini CLI MCP docs: https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html
- OpenAI Codex MCP docs: https://developers.openai.com/codex/mcp
- Cline MCP docs: https://docs.cline.bot/mcp/mcp-overview

## Production Support

### 🆘 **Getting Help**

1. **Check the Production Deployment Guide** first
2. **Review health check results** and logs
3. **Consult the troubleshooting section** in the deployment guide
4. **Create an issue** with detailed information including:
   - Environment details and configuration
   - Error messages and logs
   - Health check results
   - System metrics

### 📋 **Support Information**

Include in support requests:
- **Environment**: OS, Docker version, database version
- **Configuration**: Redacted `.env.prod` settings
- **Logs**: Application and database logs
- **Health Status**: Output from `/v1/health/detailed`
- **Metrics**: Performance metrics and trends

## License

MIT

---

**Velocity Brain** - Hosted Memory and Reuse Layer for Coding Agents

🚀 **Production-Hardened** • 🔒 **Enterprise-Secure** • 📊 **Fully-Monitored** •   **Thoroughly-Tested**
