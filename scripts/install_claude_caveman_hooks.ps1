[CmdletBinding()]
param(
    [string]$ClaudeConfigDir = "$HOME/.claude"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$src = Join-Path $root "integrations/claude/hooks"
$dstHooks = Join-Path $ClaudeConfigDir "hooks"

if (-not (Test-Path $src)) {
    throw "Hook source not found: $src"
}

New-Item -ItemType Directory -Path $dstHooks -Force | Out-Null
Copy-Item -Path (Join-Path $src "*.js") -Destination $dstHooks -Force

Write-Host "Claude caveman hooks installed:" -ForegroundColor Green
Write-Host "  $dstHooks"
Write-Host ""
Write-Host "Next: add these in Claude Code hook settings:"
Write-Host "  SessionStart -> caveman-activate.js"
Write-Host "  UserPromptSubmit -> caveman-mode-tracker.js"
