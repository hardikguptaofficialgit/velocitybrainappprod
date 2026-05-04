# Folder Structure

Velocity Brain is organized to stay simple for local development while remaining extraction-friendly for future service decomposition.

## Repository Layout

```text
velocity-brain/
  src/
    api/                 # FastAPI routes and HTTP contracts
    background/          # Scheduler and autonomous jobs
    core/                # Config and DB primitives
    models/              # Pydantic request/response models
    plugins/             # Connector manifests and runtime hooks
    services/            # Memory, retrieval, agent, graph, execution services
    workflows/           # Workflow blueprint JSON files
    cli.py               # CLI entrypoint implementation
    mcp_stdio.py         # MCP stdio server implementation
    main.py              # FastAPI application bootstrap
  skills/                # Skill catalog (JSON by category)
  migrations/            # SQL schema initialization
  tests/                 # Smoke and behavior tests
  scripts/               # Utility scripts
  docs/                  # Product and system documentation
  velocitybrain.py           # Top-level CLI launcher
  docker-compose.yml     # Local stack orchestration
  pyproject.toml         # Packaging and CLI script metadata
```

## Skills Layout

```text
skills/
  enrichment/
  execution/
  ingestion/
  maintenance/
  monitoring/
  planning/
  query/
  research/
```

## Design Notes

- `src/services/` is the core domain runtime and the best place for new engine capabilities.
- `src/api/` should stay thin and delegate logic to services.
- `skills/` is runtime content; avoid hardcoding skill assumptions in API routes.
- `docs/` reflects product behavior and should be updated with every contract change.
