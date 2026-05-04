# Token Efficiency

Velocity Brain lowers token waste by keeping long-term context outside the main prompt.

## Without Velocity Brain

Users keep repeating:

- architecture
- repo conventions
- auth setup
- prior decisions
- recent debugging history

That makes prompts larger and more expensive.

## With Velocity Brain

The user can keep the prompt short.

Velocity Brain retrieves only the context that matters first, then passes a smaller package to the agent.

## Where Savings Come From

1. Retrieval before reasoning
   Only relevant memory is forwarded.
2. Context compression
   The working set stays smaller and denser.
3. Cross-session memory
   Good context does not need to be retyped every time.

## Simple Comparison

- Without Velocity Brain: long prompt, repeated setup, more waste
- With Velocity Brain: short prompt, retrieval first, less waste

## Clean Product Message

The model should not need the whole story every time.
