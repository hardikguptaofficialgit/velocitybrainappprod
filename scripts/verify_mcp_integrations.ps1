[CmdletBinding()]
param(
    [string]$PythonPath = ".\.venv-test\Scripts\python.exe",
    [string]$OpenClawConfigPath = "$HOME/.openclaw/mcp.json",
    [switch]$RequireClaude,
    [switch]$RequireCodex,
    [switch]$RequireOpenClaw
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param(
        [string]$Step,
        [bool]$Passed,
        [string]$Details
    )

    $results.Add([PSCustomObject]@{
        Step = $Step
        Passed = $Passed
        Details = $Details
    })
}

function Resolve-Python {
    param([string]$Candidate)

    if (Test-Path $Candidate) {
        return (Resolve-Path $Candidate).Path
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $python) {
        return $python.Source
    }

    throw "Python interpreter not found. Provide -PythonPath."
}

function Read-LineWithTimeout {
    param(
        [System.IO.StreamReader]$Reader,
        [int]$TimeoutMs = 10000
    )

    $task = $Reader.ReadLineAsync()
    $completed = $task.Wait($TimeoutMs)
    if (-not $completed) {
        throw "Timed out waiting for MCP server response."
    }

    $line = $task.Result
    if ($null -eq $line) {
        throw "MCP server closed output unexpectedly."
    }

    return $line
}

function Invoke-McpHealthz {
    param([string]$PythonExe)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $PythonExe
    $psi.Arguments = "-m src.cli serve mcp"
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    if (-not $proc.Start()) {
        throw "Failed to launch MCP server process."
    }

    try {
        $initReq = @{ jsonrpc = "2.0"; id = 1; method = "initialize"; params = @{ protocolVersion = "2024-11-05"; capabilities = @{}; clientInfo = @{ name = "velocitybrain-verifier"; version = "1.0" } } } | ConvertTo-Json -Compress -Depth 8
        $proc.StandardInput.WriteLine($initReq)
        $initLine = Read-LineWithTimeout -Reader $proc.StandardOutput
        $init = $initLine | ConvertFrom-Json
        if ($null -eq $init.result) {
            throw "Initialize failed: $initLine"
        }

        $toolsReq = @{ jsonrpc = "2.0"; id = 2; method = "tools/list"; params = @{} } | ConvertTo-Json -Compress -Depth 8
        $proc.StandardInput.WriteLine($toolsReq)
        $toolsLine = Read-LineWithTimeout -Reader $proc.StandardOutput
        $tools = $toolsLine | ConvertFrom-Json
        $toolNames = @($tools.result.tools | ForEach-Object { $_.name })
        if ($toolNames -notcontains "healthz") {
            throw "MCP tools/list did not contain healthz."
        }

        $callReq = @{ jsonrpc = "2.0"; id = 3; method = "tools/call"; params = @{ name = "healthz"; arguments = @{} } } | ConvertTo-Json -Compress -Depth 8
        $proc.StandardInput.WriteLine($callReq)
        $callLine = Read-LineWithTimeout -Reader $proc.StandardOutput
        $call = $callLine | ConvertFrom-Json
        if ($null -eq $call.result) {
            throw "tools/call healthz failed: $callLine"
        }

        $textPayload = $call.result.content[0].text
        $decoded = $textPayload | ConvertFrom-Json
        if ($decoded.ok -ne $true) {
            throw "healthz returned non-OK payload: $textPayload"
        }

        $shutdownReq = @{ jsonrpc = "2.0"; id = 4; method = "shutdown"; params = @{} } | ConvertTo-Json -Compress -Depth 8
        $proc.StandardInput.WriteLine($shutdownReq)
        $null = Read-LineWithTimeout -Reader $proc.StandardOutput

        return "ok=true service=$($decoded.service) trace_id=$($decoded.trace_id)"
    }
    finally {
        try {
            if (-not $proc.HasExited) {
                $exitReq = @{ jsonrpc = "2.0"; method = "exit"; params = @{} } | ConvertTo-Json -Compress -Depth 8
                $proc.StandardInput.WriteLine($exitReq)
            }
        }
        catch {
            # Best effort cleanup.
        }

        if (-not $proc.HasExited) {
            $proc.Kill()
        }

        $proc.Dispose()
    }
}

try {
    $pythonExe = Resolve-Python -Candidate $PythonPath

    Add-Result -Step "MCP healthz tool call" -Passed $true -Details (Invoke-McpHealthz -PythonExe $pythonExe)

    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if ($null -eq $claude) {
        if ($RequireClaude) {
            Add-Result -Step "Claude integration" -Passed $false -Details "Claude CLI not found on PATH."
        }
        else {
            Add-Result -Step "Claude integration" -Passed $true -Details "SKIPPED (Claude CLI not found)"
        }
    }
    else {
        $claudeList = & claude mcp list 2>&1 | Out-String
        if ($claudeList -match "velocitybrain") {
            Add-Result -Step "Claude integration" -Passed $true -Details "velocitybrain present in claude mcp list"
        }
        else {
            Add-Result -Step "Claude integration" -Passed $false -Details "velocitybrain not found in claude mcp list"
        }
    }

    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($null -eq $codex) {
        if ($RequireCodex) {
            Add-Result -Step "Codex integration" -Passed $false -Details "Codex CLI not found on PATH."
        }
        else {
            Add-Result -Step "Codex integration" -Passed $true -Details "SKIPPED (Codex CLI not found)"
        }
    }
    else {
        $codexList = & codex mcp list 2>&1 | Out-String
        if ($codexList -match "velocitybrain") {
            Add-Result -Step "Codex integration" -Passed $true -Details "velocitybrain present in codex mcp list"
        }
        else {
            Add-Result -Step "Codex integration" -Passed $false -Details "velocitybrain not found in codex mcp list"
        }
    }

    if (-not (Test-Path $OpenClawConfigPath)) {
        if ($RequireOpenClaw) {
            Add-Result -Step "OpenClaw integration" -Passed $false -Details "Config not found: $OpenClawConfigPath"
        }
        else {
            Add-Result -Step "OpenClaw integration" -Passed $true -Details "SKIPPED (config not found: $OpenClawConfigPath)"
        }
    }
    else {
        $cfg = Get-Content -Raw -Path $OpenClawConfigPath | ConvertFrom-Json
        $entry = $cfg.mcpServers.velocitybrain
        if ($null -eq $entry) {
            Add-Result -Step "OpenClaw integration" -Passed $false -Details "velocitybrain entry not found in config"
        }
        else {
            $cmd = [string]$entry.command
            $args = @($entry.args) -join " "
            Add-Result -Step "OpenClaw integration" -Passed $true -Details "command=$cmd args=$args"
        }
    }
}
catch {
    Add-Result -Step "Verifier runtime" -Passed $false -Details $_.Exception.Message
}
finally {
    Write-Host "`n================ MCP Integration Verification ================"
    $results | Format-Table -AutoSize | Out-Host

    $failedCount = @($results | Where-Object { -not $_.Passed }).Count
    if ($failedCount -gt 0) {
        Write-Host "OVERALL RESULT: FAIL ($failedCount failed step(s))" -ForegroundColor Red
        exit 1
    }

    Write-Host "OVERALL RESULT: PASS" -ForegroundColor Green
    exit 0
}
