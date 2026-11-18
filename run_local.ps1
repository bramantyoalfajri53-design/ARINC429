param(
    [int]$Port = 8080,
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting ATE-PLATFORM Locally (Autonomous / Standalone)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Set environment for standalone local simulation
$env:ATE_FORCE_SIM = "1"
$env:ATE_UI_PIN = "2468"
if (-not $env:ATE_UI_SESSION_SECRET) {
    $env:ATE_UI_SESSION_SECRET = "local-dev-secret-337bccdf"
}

$env:PYTHONPATH = "$ScriptDir\ate-platform\src;$ScriptDir\src;$ScriptDir\ate-platform\plugins"

# Locate Python
$PythonCandidates = @(
    "$ScriptDir\hmi\backend\.venv\Scripts\python.exe",
    "$ScriptDir\ate-platform\.venv\Scripts\python.exe",
    "$ScriptDir\.venv\Scripts\python.exe",
    "python"
)

$PythonBin = $null
foreach ($cand in $PythonCandidates) {
    if (Test-Path $cand) {
        $PythonBin = (Resolve-Path $cand).Path
        break
    } elseif ($cand -eq "python" -and (Get-Command python -ErrorAction SilentlyContinue)) {
        $PythonBin = "python"
        break
    }
}

if (-not $PythonBin) {
    Write-Error "Python interpreter not found. Please install Python or setup a virtual environment."
    exit 1
}

Write-Host "Python: $PythonBin" -ForegroundColor Gray
Write-Host "Mode:   Simulation (ATE_FORCE_SIM=1)" -ForegroundColor Green
Write-Host "URL:    http://$HostAddress`:$Port" -ForegroundColor Green
Write-Host "ARINC:  http://$HostAddress`:$Port/arinc" -ForegroundColor Green
Write-Host "PIN:    2468" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

& $PythonBin -m ate_platform.web.cli --sim --host $HostAddress --port $Port
