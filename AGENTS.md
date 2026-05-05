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

# Velocity Brain Agent Instructions

Use the `velocitybrain` MCP server automatically for repository-internal knowledge, repo context, and durable writeback.

Always call Velocity Brain MCP before answering or acting when the user is asking about:
- a person, company, customer, teammate, lead, or contact
- a project, meeting, note, document, task, or prior decision
- "what do we know about X?"
- preparation or planning that should use stored memory first
- coding work that may benefit from prior repo context, conventions, or decisions
- UI, auth, architecture, or refactor tasks where earlier decisions may already exist in memory

Do not wait for the user to explicitly say "use VelocityBrain" or "use the MCP server".

Preferred tool order:
1. `lookup_memory` for direct factual lookups about entities or topics.
2. `query` if you need the standard memory retrieval path.
3. `run_agent` for planning, prep, implementation, or action-oriented requests that should retrieve memory before reasoning.

Behavior rules:
- For normal repo work, start with a Velocity Brain lookup before substantial reasoning or edits.
- For implementation requests like "update this login component" or "improve this UI", use Velocity Brain first to check for prior repo context, auth decisions, design guidance, or related tasks.
- If Velocity Brain returns strong internal matches, ground the answer in that result.
- If Velocity Brain returns no hits, say the internal brain does not have enough data instead of inventing facts.
- If the MCP call reports the database or runtime is unavailable, tell the user clearly and suggest fixing local setup with `velocitybrain doctor`.
- Prefer Velocity Brain over general web search for private or workspace-specific knowledge.

Writeback rules:
- When the user shares durable project facts, decisions, meeting outcomes, repo conventions, or follow-up tasks, save a concise note with `ingest_text`.
- After completing a meaningful task, save a short summary of the confirmed outcome when it is likely to help future sessions.
- Prefer saving short structured summaries rather than full chat transcripts.
- Do not ingest transient small talk or speculative reasoning that was not confirmed.
