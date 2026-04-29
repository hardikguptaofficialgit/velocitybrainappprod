# Skill System

Velocity Brain uses JSON-defined skills as reusable operational units for ingestion, reasoning, maintenance, and execution workflows.

## Skill Contract

Each skill manifest should define:

- trigger conditions
- workflow steps
- validation rules
- output shape

## Runtime Flow

1. Detect intent and select candidate skills.
2. Validate prerequisites and input readiness.
3. Execute workflow steps in order.
4. Validate output contract.
5. Emit structured result and audit event.

## Skill Categories

- ingestion
- enrichment
- query
- maintenance
- planning
- execution
- research
- monitoring

## Skill Inventory

Current packaged count: **65** skill files under `skills/**/*.json`.

## Design Principles

- Skills are composable and category-scoped.
- Runtime should treat skills as data-driven behavior units.
- Changes to skill behavior should prefer manifest updates over code branching.
- High-risk skill paths should remain auditable and deterministic where possible.
