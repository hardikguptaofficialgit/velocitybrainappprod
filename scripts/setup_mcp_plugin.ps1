[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("claude", "codex", "openclaw")]
    [string]$Client,

    [string]$CommandPath = "velocitybrain",

    [switch]$UseAbsoluteCommandPath,

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
