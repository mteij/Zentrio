# Build custom libav.js variant with AC3/E-AC3 support
# Usage: .\build-libav.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$OutputDir = Join-Path $AppDir "public\libav.js-zentrio"

Write-Host "=== Building Custom libav.js Variant ===" -ForegroundColor Cyan
Write-Host "Output directory: $OutputDir"

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Build Docker image
Write-Host "`nStep 1: Building Docker image (this may take 15-20 minutes)..." -ForegroundColor Yellow
docker build -f "$ScriptDir\Dockerfile.libav" -t libav-zentrio-builder "$ScriptDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed" -ForegroundColor Red
    exit 1
}

# Run container to copy files
Write-Host "`nStep 2: Extracting build artifacts..." -ForegroundColor Yellow
docker run --rm -v "${OutputDir}:/dest" libav-zentrio-builder

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to extract artifacts" -ForegroundColor Red
    exit 1
}

# List output files
Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Output files:"
Get-ChildItem $OutputDir | ForEach-Object {
    $size = "{0:N2} MB" -f ($_.Length / 1MB)
    Write-Host "  - $($_.Name) ($size)"
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Update HybridEngine.ts to import from the new variant"
Write-Host "2. Run 'bun run dev' and test AC3/E-AC3 playback"
