# Repo Boundary

## Public Repo: `velocitybrain-client`

Recommended structure:

```text
velocitybrain-client/
  pyproject.toml
  README.md
  docs/
  examples/
  integrations/
  scripts/
  src/
    velocitybrain_client/
      __init__.py
      cli/
      client/
      mcp/
  tests/
```

## Private Repo: `velocitybrain-core`

Recommended structure:

```text
velocitybrain-core/
  backend/
  dashboard/
  docs/private/
  migrations/
  scripts/
  skills/
  src/
    core_api/
    services/
    api/
    background/
    core/
    models/
    monitoring/
    plugins/
  tests/
```

## Import Boundary

Public package imports may only target:

- `velocitybrain_client.cli.*`
- `velocitybrain_client.client.*`
- `velocitybrain_client.mcp.*`
- standard library or third-party hosted client dependencies

Public package imports must not target:

- `src.services.*`
- `src.core_api.*`
- `services.*`
- `core_api.*`

The enforcement script is:

- [velocitybrain-open-source/scripts/check_public_boundary.py](/abs/path/C:/Disk E/Projects/VelocityX/velocitybrain/velocitybrain-open-source/scripts/check_public_boundary.py:1)

The file-by-file classification table is:

- [docs/REPO_BOUNDARY.csv](/abs/path/C:/Disk E/Projects/VelocityX/velocitybrain/docs/REPO_BOUNDARY.csv:1)

