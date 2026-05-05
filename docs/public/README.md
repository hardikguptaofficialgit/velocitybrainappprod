# Public Repo

Public repository name: `velocitybrain-client`

This repo should contain only:

- installable CLI
- Python SDK
- MCP bridge
- integrations
- examples
- minimal public docs

Why this exists:

- it is the safe publishable boundary for the hosted client package
- it keeps backend, dashboard, reuse engine, and private runtime internals out of the public release
- it gives the project a place to validate public API surface, packaging, and examples independently

It must not contain hosted reuse logic, backend services, dashboard code, or internal validation/runtime services.
