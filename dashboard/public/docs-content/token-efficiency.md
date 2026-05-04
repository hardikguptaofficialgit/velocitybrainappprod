# Token Efficiency

Most agents waste tokens by relearning the same context every run.

VelocityBrain reduces that waste by retrieving prior context before the model starts from zero.

## Where savings come from

- repeated repo questions
- architecture decisions already explained before
- setup commands already known
- recurring task patterns across sessions

## What improves

- lower repeated prompt volume
- less context drift
- faster time to useful output

## Important point

VelocityBrain is not only a cache.

It is a memory and reuse layer that helps agents avoid paying the same context cost again and again.

## Recommended usage

- keep memory focused on useful recurring context
- avoid dumping everything into the system
- verify retrieval quality before expanding scope
