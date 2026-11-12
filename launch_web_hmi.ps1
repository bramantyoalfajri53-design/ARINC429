# Launch ATE Power web HMI (FastAPI + built SPA) on Windows
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "hmi\backend"
$DistIndex = Join-Path $Root "hmi\frontend\dist\index.html"

$env:PYTHONPATH = $BackendDir

$VenvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $VenvPy) {
    $PythonBin = $VenvPy
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonBin = "python"
} else {
    Write-Error "Python interpreter not found. Install Python 3 or create .venv first."
    exit 1
}

if (-not (Test-Path $DistIndex)) {
    Write-Warning "Frontend build not found at $DistIndex. Run 'npm run build' in hmi/frontend."
}

& $PythonBin -m uvicorn app:app --app-dir $BackendDir --host 0.0.0.0 --port 8080

