[CmdletBinding()]
param(
    [string]$PythonPath = ".\.venv-test\Scripts\python.exe",
    [string]$ApiHost = "127.0.0.1",
    [int]$ApiPort = 8080,
    [switch]$SkipDocker,
    [switch]$SkipApiSmoke,
    [switch]$SkipBenchmark,
    [switch]$SkipOpenClawSmoke,
    [switch]$KeepApiServer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$results = New-Object System.Collections.Generic.List[object]
$apiProcess = $null
$apiOwnedByScript = $false
$apiLogPath = Join-Path $root "test-results\api-server.log"
$apiErrLogPath = Join-Path $root "test-results\api-server.err.log"

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

function Resolve-PythonPath {
    param([string]$Candidate)

    if (Test-Path $Candidate) {
        return (Resolve-Path $Candidate).Path
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pythonCmd) {
        return $pythonCmd.Source
    }

    throw "Could not find Python interpreter. Provide -PythonPath or install Python."
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    try {
        & $Action
        Add-Result -Step $Name -Passed $true -Details "OK"
    }
    catch {
        Add-Result -Step $Name -Passed $false -Details $_.Exception.Message
        Write-Host "FAILED: $Name" -ForegroundColor Red
        throw
    }
}

function Invoke-CheckedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        $argText = ($Arguments -join ' ')
        throw "Command failed (exit $LASTEXITCODE): $FilePath $argText"
    }
}

function Wait-ForApi {
    param(
        [string]$BaseUrl,
        [int]$Attempts = 25,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $response = Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/healthz" -TimeoutSec 4
            if ($response.ok -eq $true) {
                return
            }
        }
        catch {
            # Keep retrying until attempts are exhausted.
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    throw "API did not become healthy at $BaseUrl within timeout."
}

function Test-ApiHealthy {
    param([string]$BaseUrl)

    try {
        $response = Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/healthz" -TimeoutSec 3
        return ($response.ok -eq $true)
    }
    catch {
        return $false
    }
}

function Test-ApiEndpoint {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    $uri = "$BaseUrl$Path"
    $null = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 10
    Write-Host "GET $Path OK" -ForegroundColor Green
}

try {
    $pythonExe = Resolve-PythonPath -Candidate $PythonPath
    Write-Host "Workspace: $root"
    Write-Host "Python:    $pythonExe"

    if (-not $SkipDocker) {
        Invoke-Step -Name "Start database container" -Action {
            docker compose up db -d | Out-Host
        }

        Invoke-Step -Name "Apply database schema" -Action {
            docker compose exec -T db psql -U velocity -d velocitybrain -f /docker-entrypoint-initdb.d/01-schema.sql | Out-Host
        }
    }
    else {
        Add-Result -Step "Start database container" -Passed $true -Details "SKIPPED"
        Add-Result -Step "Apply database schema" -Passed $true -Details "SKIPPED"
    }

    Invoke-Step -Name "velocitybrain init" -Action {
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'init')
    }

    Invoke-Step -Name "velocitybrain doctor" -Action {
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'doctor')
    }

    Invoke-Step -Name "Run full pytest suite" -Action {
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'pytest', 'tests', '-v')
    }

    if (-not $SkipApiSmoke) {
        $baseUrl = "http://$ApiHost`:$ApiPort"

        Invoke-Step -Name "Start API server" -Action {
            New-Item -ItemType Directory -Path (Split-Path $apiLogPath -Parent) -Force | Out-Null
            if (Test-Path $apiLogPath) {
                Remove-Item $apiLogPath -Force
            }
            if (Test-Path $apiErrLogPath) {
                Remove-Item $apiErrLogPath -Force
            }

            if (Test-ApiHealthy -BaseUrl $baseUrl) {
                Write-Host "API already healthy at $baseUrl. Reusing existing server."
                return
            }

            $cmd = "Set-Location '$root'; & '$pythonExe' -m src.cli serve api --host $ApiHost --port $ApiPort"
            $apiProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", $cmd -PassThru -WindowStyle Hidden -RedirectStandardOutput $apiLogPath -RedirectStandardError $apiErrLogPath
            $apiOwnedByScript = $true
            Wait-ForApi -BaseUrl $baseUrl

            if ($apiProcess.HasExited) {
                $startupLog = if (Test-Path $apiLogPath) { (Get-Content $apiLogPath -Tail 40) -join "`n" } else { "No API log file." }
                throw "API process exited early. Log tail:`n$startupLog"
            }
        }

        Invoke-Step -Name "API endpoint smoke" -Action {
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/healthz"
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/runtime/status"
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/openclaw/profile"
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/openclaw/capabilities"
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/audit/recent?limit=5"
            Test-ApiEndpoint -BaseUrl $baseUrl -Path "/v1/docs/pages"
        }
    }
    else {
        Add-Result -Step "Start API server" -Passed $true -Details "SKIPPED"
        Add-Result -Step "API endpoint smoke" -Passed $true -Details "SKIPPED"
    }

    Invoke-Step -Name "CLI smoke" -Action {
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'about')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'status')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'openclaw')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'ingest', '--source', 'note', '--content', 'Full test note for Hardik Gupta at Acme')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'query', 'What do I know about Hardik Gupta?')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'run', 'Prepare me for a meeting with Hardik Gupta tomorrow')
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'src.cli', 'sync', '--repo', '.')
    }

    if (-not $SkipBenchmark) {
        Invoke-Step -Name "Retrieval benchmark" -Action {
            Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('scripts/retrieval_benchmark.py')
        }
    }
    else {
        Add-Result -Step "Retrieval benchmark" -Passed $true -Details "SKIPPED"
    }

    if (-not $SkipOpenClawSmoke) {
        Invoke-Step -Name "OpenClaw smoke helper" -Action {
            Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('scripts/openclaw_smoke.py')
        }
    }
    else {
        Add-Result -Step "OpenClaw smoke helper" -Passed $true -Details "SKIPPED"
    }
}
catch {
    Write-Host "`nA step failed. Review summary below." -ForegroundColor Red
}
finally {
    if ($apiProcess -and $apiOwnedByScript -and -not $KeepApiServer) {
        try {
            if (-not $apiProcess.HasExited) {
                Stop-Process -Id $apiProcess.Id -Force
                Add-Result -Step "Stop API server" -Passed $true -Details "Stopped"
            }
            else {
                Add-Result -Step "Stop API server" -Passed $true -Details "Already stopped"
            }
        }
        catch {
            Add-Result -Step "Stop API server" -Passed $false -Details $_.Exception.Message
        }
    }

    Write-Host "`n================ Full System Test Summary ================"
    $results | Format-Table -AutoSize | Out-Host

    $failedCount = @($results | Where-Object { -not $_.Passed }).Count
    if ($failedCount -gt 0) {
        Write-Host "OVERALL RESULT: FAIL ($failedCount failed step(s))" -ForegroundColor Red
        exit 1
    }

    Write-Host "OVERALL RESULT: PASS" -ForegroundColor Green
    exit 0
}
