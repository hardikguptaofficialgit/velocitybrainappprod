# Claude Caveman Hooks

These hooks persist caveman response mode in Claude Code sessions.

## Files

- `caveman-activate.js`: SessionStart activation, writes default mode flag.
- `caveman-mode-tracker.js`: UserPromptSubmit tracker for `/caveman ...` and stop triggers.
- `caveman-config.js`: shared mode/flag helpers.

## Modes

- `normal`
- `lite`
- `full`
- `ultra`
- `off` (disable auto-activation)

Default mode resolution:

1. `VB_RESPONSE_STYLE` environment variable
2. fallback: `full`

## Install

Use script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install_claude_caveman_hooks.ps1
```
