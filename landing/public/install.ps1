$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "=> Fetching latest Zentrio release..."
$release = Invoke-RestMethod `
  -Uri "https://api.github.com/repos/mteij/Zentrio/releases/latest" `
  -Headers @{ "User-Agent" = "ZentrioInstaller" }

$asset = $release.assets | Where-Object { $_.name -match "\.exe$" } | Select-Object -First 1
if (-not $asset) {
  throw "Could not find a Windows .exe installer in the latest release."
}

$tempFile = Join-Path $env:TEMP ("zentrio_" + [System.Guid]::NewGuid().ToString("N") + ".exe")

Write-Host "=> Downloading $($asset.browser_download_url)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tempFile

Write-Host "=> Launching installer..."
$process = Start-Process -FilePath $tempFile -PassThru -Wait
if ($process.ExitCode -ne 0) {
  throw "Installer exited with code $($process.ExitCode)."
}

Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
Write-Host "=> Zentrio installed successfully!"
