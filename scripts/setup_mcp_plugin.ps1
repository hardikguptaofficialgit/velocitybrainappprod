[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("claude", "codex", "hermes", "openclaw")]
    [string]$Client,

    [string]$CommandPath = "velocitybrain",

    [switch]$UseAbsoluteCommandPath,

    [string]$HermesConfigPath = "$HOME/.hermes/config.yaml",

    [string]$OpenClawConfigPath = "$HOME/.openclaw/mcp.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Resolve-CommandValue {
    param(
        [string]$DefaultCommand,
        [switch]$UseAbsolute
    )

    if (-not $UseAbsolute) {
        return $DefaultCommand
    }

    $cmd = Get-Command $DefaultCommand -ErrorAction Stop
    return $cmd.Source
}

function Write-McpJson {
    param(
        [string]$Path,
        [string]$CommandValue
    )

    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $payload = @{
        mcpServers = @{
            velocitybrain = @{
                command = $CommandValue
                args = @("serve", "mcp")
            }
        }
    }

    $json = $payload | ConvertTo-Json -Depth 8
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Write-HermesConfig {
    param(
        [string]$Path,
        [string]$CommandValue
    )

    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $safeCommand = $CommandValue -replace "'", "''"
    $serverBlock = @"
  velocitybrain:
    command: '$safeCommand'
    args: ['serve', 'mcp']
    tools:
      include: ['healthz', 'retrieve_reuse_context', 'query', 'run_agent']
      prompts: false
      resources: false
"@

    if (-not (Test-Path $Path)) {
        $content = "mcp_servers:`n$serverBlock"
        Set-Content -Path $Path -Value $content -Encoding UTF8
        return
    }

    $existing = Get-Content -Path $Path -Raw

    if ($existing -match "(?m)^\s{2}velocitybrain:\s*$") {
        return
    }

    if ($existing -match "(?m)^mcp_servers:\s*$") {
        $updated = [regex]::Replace($existing, "(?m)^mcp_servers:\s*$", "mcp_servers:`n$serverBlock", 1)
        Set-Content -Path $Path -Value $updated -Encoding UTF8
        return
    }

    $trimmed = $existing.TrimEnd()
    $updated = "$trimmed`n`nmcp_servers:`n$serverBlock"
    Set-Content -Path $Path -Value $updated -Encoding UTF8
}

function Get-AgentsInstructions {
    return @"
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
"@
}

function Ensure-AgentsFile {
    param(
        [string]$RepoRoot
    )

    $agentsPath = Join-Path $RepoRoot "AGENTS.md"
    $instructions = (Get-AgentsInstructions).Trim()

    if (-not (Test-Path $agentsPath)) {
        Set-Content -Path $agentsPath -Value "$instructions`n" -Encoding UTF8
        Write-Host "Created AGENTS.md with Velocity Brain instructions." -ForegroundColor Green
        return
    }

    $existing = Get-Content -Path $agentsPath -Raw
    if ($existing -like "*$instructions*") {
        Write-Host "AGENTS.md already contains Velocity Brain instructions." -ForegroundColor Green
        return
    }

    $trimmed = $existing.TrimEnd()
    $updated = if ([string]::IsNullOrWhiteSpace($trimmed)) { "$instructions`n" } else { "$trimmed`n`n$instructions`n" }
    Set-Content -Path $agentsPath -Value $updated -Encoding UTF8
    Write-Host "Updated AGENTS.md with Velocity Brain instructions." -ForegroundColor Green
}

function Get-IdentitySpecJson {
    $spec = @{
        name = "velocitybrain-runtime"
        version = "1.2"
        persona = @{
            mission = "Use brain-first retrieval before repo reasoning and preserve durable project knowledge."
            tone = "clear, accountable, memory-first"
        }
        runtime_policies = @{
            destructive_tools_require_approval = $true
            allow_external_file_reads = $false
            brain_first_for_repo_tasks = $true
            durable_writeback_after_material_tasks = $true
            save_transient_chat_by_default = $false
        }
        capabilities = @(
            "ingest_text",
            "query",
            "lookup_memory",
            "run_agent",
            "sync_brain",
            "get_identity_spec"
        )
    }

    return $spec | ConvertTo-Json -Depth 8
}

function Ensure-IdentitySpecFile {
    param(
        [string]$RepoRoot
    )

    $specPath = Join-Path $RepoRoot "identity.spec.json"
    $expected = Get-IdentitySpecJson

    if (-not (Test-Path $specPath)) {
        Set-Content -Path $specPath -Value $expected -Encoding UTF8
        Write-Host "Created identity.spec.json with Velocity Brain defaults." -ForegroundColor Green
        return
    }

    try {
        $current = Get-Content -Path $specPath -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $current = @{}
    }

    if ($null -eq $current) {
        $current = @{}
    }

    if (-not $current.ContainsKey("name")) { $current["name"] = "velocitybrain-runtime" }
    $current["version"] = "1.2"

    $persona = @{}
    if ($current.ContainsKey("persona") -and $current["persona"]) {
        foreach ($key in $current["persona"].Keys) { $persona[$key] = $current["persona"][$key] }
    }
    if (-not $persona.ContainsKey("mission")) { $persona["mission"] = "Use brain-first retrieval before repo reasoning and preserve durable project knowledge." }
    if (-not $persona.ContainsKey("tone")) { $persona["tone"] = "clear, accountable, memory-first" }
    $current["persona"] = $persona

    $policies = @{}
    if ($current.ContainsKey("runtime_policies") -and $current["runtime_policies"]) {
        foreach ($key in $current["runtime_policies"].Keys) { $policies[$key] = $current["runtime_policies"][$key] }
    }
    $defaults = @{
        destructive_tools_require_approval = $true
        allow_external_file_reads = $false
        brain_first_for_repo_tasks = $true
        durable_writeback_after_material_tasks = $true
        save_transient_chat_by_default = $false
    }
    foreach ($key in $defaults.Keys) {
        if (-not $policies.ContainsKey($key)) { $policies[$key] = $defaults[$key] }
    }
    $current["runtime_policies"] = $policies

    $capabilities = @()
    if ($current.ContainsKey("capabilities") -and $current["capabilities"]) {
        $capabilities = @($current["capabilities"])
    }
    foreach ($capability in @("ingest_text", "query", "lookup_memory", "run_agent", "sync_brain", "get_identity_spec")) {
        if ($capabilities -notcontains $capability) {
            $capabilities += $capability
        }
    }
    $current["capabilities"] = $capabilities

    $updatedJson = $current | ConvertTo-Json -Depth 8
    Set-Content -Path $specPath -Value $updatedJson -Encoding UTF8
    Write-Host "Updated identity.spec.json with Velocity Brain defaults." -ForegroundColor Green
}

$commandValue = Resolve-CommandValue -DefaultCommand $CommandPath -UseAbsolute:$UseAbsoluteCommandPath

if ($Client -eq "claude") {
    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if ($null -eq $claude) {
        throw "Claude CLI not found on PATH. Install Claude Code CLI first."
    }

    Write-Host "Registering Velocity Brain MCP server in Claude Code..." -ForegroundColor Cyan
    & claude mcp add velocitybrain -- $commandValue serve mcp
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to register MCP server in Claude Code."
    }

    Write-Host "Claude Code integration complete." -ForegroundColor Green
    Ensure-AgentsFile -RepoRoot $root
    Ensure-IdentitySpecFile -RepoRoot $root
    Write-Host "Verify with: claude mcp list"
    exit 0
}

if ($Client -eq "codex") {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($null -eq $codex) {
        throw "Codex CLI not found on PATH. Install Codex CLI first."
    }

    Write-Host "Registering Velocity Brain MCP server in Codex..." -ForegroundColor Cyan
    & codex mcp add velocitybrain -- $commandValue serve mcp
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to register MCP server in Codex."
    }

    Write-Host "Codex integration complete." -ForegroundColor Green
    Ensure-AgentsFile -RepoRoot $root
    Ensure-IdentitySpecFile -RepoRoot $root
    Write-Host "Verify with: codex mcp list"
    exit 0
}

if ($Client -eq "openclaw") {
    Write-McpJson -Path $OpenClawConfigPath -CommandValue $commandValue
    Write-Host "OpenClaw config written:" -ForegroundColor Green
    Write-Host "  $OpenClawConfigPath"
    Write-Host "Restart OpenClaw and verify the velocitybrain server is listed."
    exit 0
}

if ($Client -eq "hermes") {
    Write-HermesConfig -Path $HermesConfigPath -CommandValue $commandValue
    Write-Host "Hermes config updated:" -ForegroundColor Green
    Write-Host "  $HermesConfigPath"
    Write-Host "Start Hermes with: hermes chat"
    Write-Host "If Hermes is already running, use: /reload-mcp"
    exit 0
}
