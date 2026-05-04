# Agent Loop

This document describes the mandatory runtime loop used by Velocity Brain.

## Loop Stages

1. Receive signal input.
2. Detect intent and relevant entities.
3. Query internal brain first.
4. Build execution plan.
5. Execute planned actions.
6. Write back memory updates.
7. Trigger re-indexing and optimization.

Implementation location:
- `src/services/agent_loop.py`

## Safety Behavior

If internal retrieval returns no relevant context, query responses should explicitly state insufficiency instead of hallucinating.

## Run Output Expectations

Agent run outputs should include:

- run status and run id
- detected intent
- generated plan and executed actions
- memory updates
- confidence and attention score
- reasoning summary and references

## Extension Hooks

- Reflection/self-critique can be layered after run completion.
- Additional policy checks can be inserted pre-execution and post-writeback.
- Background optimization jobs can consume run logs for continuous quality improvements.
