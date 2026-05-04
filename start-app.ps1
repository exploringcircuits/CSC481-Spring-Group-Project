param(
    [switch]$SkipInstall,
    [switch]$SeedFreshDemo
)

$ErrorActionPreference = 'Stop'

$root        = $PSScriptRoot
$backendDir  = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$venvDir     = Join-Path $root '.venv'
$venvPython  = Join-Path $venvDir 'Scripts\python.exe'
$backendUrl  = 'http://127.0.0.1:8000'
$frontendUrl = 'http://localhost:5173'

Write-Host ''
Write-Host '=== Fantasy Hoops Launcher ===' -ForegroundColor Cyan
Write-Host "Root: $root"

if (-not (Test-Path $backendDir))  { throw "Backend folder not found: $backendDir" }
if (-not (Test-Path $frontendDir)) { throw "Frontend folder not found: $frontendDir" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'Python was not found on PATH. Install Python 3.10+ and try again.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm was not found on PATH. Install Node.js (includes npm) and try again.'
}

if (-not (Test-Path $venvPython)) {
    Write-Host 'Creating virtual environment in .venv...' -ForegroundColor Yellow
    & python -m venv $venvDir
}

if (-not $SkipInstall) {
    Write-Host 'Installing backend requirements...' -ForegroundColor Yellow
    & $venvPython -m pip install --quiet -r (Join-Path $backendDir 'requirements.txt')

    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
        Push-Location $frontendDir
        try { & npm install }
        finally { Pop-Location }
    } else {
        Write-Host 'Frontend dependencies already present (node_modules found).' -ForegroundColor DarkGray
    }
} else {
    Write-Host 'Skipping install steps because -SkipInstall was provided.' -ForegroundColor DarkGray
}

Write-Host 'Running Django migrations...' -ForegroundColor Yellow
Push-Location $backendDir
try {
    & $venvPython manage.py migrate --noinput
}
finally { Pop-Location }

Write-Host 'Ensuring admin user exists (admin@demo.local / demoadmin)...' -ForegroundColor Yellow
Push-Location $backendDir
try {
    & $venvPython manage.py seed_admin_user
}
finally { Pop-Location }

# First run: pull NBA player data from basketball-reference (cached afterward)
# and generate per-day stat lines for the demo window.
$cacheFile = Join-Path $backendDir 'data\cache\bbref_per_game_2026.html'
if (-not (Test-Path $cacheFile) -or $SeedFreshDemo) {
    Write-Host 'Syncing NBA player data (one-time scrape, cached)...' -ForegroundColor Yellow
    Push-Location $backendDir
    try {
        & $venvPython manage.py sync_nba_data
        & $venvPython manage.py generate_player_game_stats --weeks 8 --seed 42 --start-date 2026-03-10 --clear
    }
    finally { Pop-Location }
} else {
    Write-Host 'NBA data cache present. (Pass -SeedFreshDemo to regenerate stat lines.)' -ForegroundColor DarkGray
}

Get-Job -Name FantasyBackend -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'App links:' -ForegroundColor Cyan
Write-Host "  Frontend: $frontendUrl"
Write-Host "  Backend:  $backendUrl"
Write-Host '  Admin login: admin@demo.local / demoadmin' -ForegroundColor DarkGray
Write-Host ''

Write-Host "Starting backend server on $backendUrl (background job)..." -ForegroundColor Green
$backendJob = Start-Job -Name FantasyBackend -ScriptBlock {
    param($dir, $pythonExe)
    Set-Location $dir
    & $pythonExe manage.py runserver
} -ArgumentList $backendDir, $venvPython

Start-Sleep -Seconds 3

Write-Host 'Opening browser...' -ForegroundColor Green
Start-Process $frontendUrl

Write-Host "Starting frontend server on $frontendUrl (foreground)..." -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop frontend; backend job will be cleaned up automatically.' -ForegroundColor DarkGray

Push-Location $frontendDir
try {
    & npm run dev
}
finally {
    Pop-Location
    if ($backendJob -and (Get-Job -Id $backendJob.Id -ErrorAction SilentlyContinue)) {
        Stop-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
        Remove-Job -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    }
}
