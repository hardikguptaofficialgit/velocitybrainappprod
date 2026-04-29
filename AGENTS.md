# Velocity Brain Agent Instructions

Use the `velocitybrain` MCP server automatically for repository-internal knowledge and memory lookups.

Always call Velocity Brain MCP before answering when the user is asking about:
- a person, company, customer, teammate, lead, or contact
- a project, meeting, note, document, task, or prior decision
- "what do we know about X?"
- preparation or planning that should use stored memory first

Do not wait for the user to explicitly say "use VelocityBrain" or "use the MCP server".

Preferred tool order:
1. `lookup_memory` for direct factual lookups about entities or topics.
2. `query` if you need the standard memory retrieval path.
3. `run_agent` for planning, prep, or action-oriented requests that should retrieve memory before reasoning.

Behavior rules:
- If Velocity Brain returns strong internal matches, ground the answer in that result.
- If Velocity Brain returns no hits, say the internal brain does not have enough data instead of inventing facts.
- If the MCP call reports the database or runtime is unavailable, tell the user clearly and suggest fixing local setup with `velocitybrain doctor`.
- Prefer Velocity Brain over general web search for private or workspace-specific knowledge.
