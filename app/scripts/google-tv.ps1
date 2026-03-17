[CmdletBinding()]
param(
  [ValidateSet('build', 'install', 'dev', 'logcat')]
  [string]$Action = 'build'
)

$ErrorActionPreference = 'Stop'

$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$AdbPath = Join-Path $SdkRoot 'platform-tools\adb.exe'
$EmulatorPath = Join-Path $SdkRoot 'emulator\emulator.exe'
$AvdName = 'ZentrioGoogleTV'
$TauriTarget = 'i686'
$UniversalDebugApk = Join-Path $AppRoot 'src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk'

function Assert-ToolExists {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path $Path)) {
    throw "$Label not found at $Path"
  }
}

function Invoke-AppCommand {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Command
  )

  Push-Location $AppRoot
  try {
    & $Command[0] $Command[1..($Command.Length - 1)]
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed: $($Command -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-AppCommandWithEnv {
  param(
    [hashtable]$Environment,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Command
  )

  $previousValues = @{}
  foreach ($key in $Environment.Keys) {
    $previousValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $Environment[$key], 'Process')
  }

  try {
    Invoke-AppCommand @Command
  } finally {
    foreach ($key in $previousValues.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousValues[$key], 'Process')
    }
  }
}

function Get-RunningGoogleTvSerial {
  $serials = & $AdbPath devices | Select-String '^emulator-\d+\s+device'
  foreach ($line in $serials) {
    $serial = ($line.ToString() -split '\s+')[0]
    $nameOutput = (& $AdbPath -s $serial emu avd name 2>$null | Out-String)
    $nameLine = $nameOutput -split "`r?`n" |
      Where-Object { $_ -and $_.Trim() -and $_.Trim() -ne 'OK' } |
      Select-Object -First 1

    if (-not $nameLine) {
      continue
    }

    $name = $nameLine.Trim()
    if ($name -eq $AvdName) {
      return $serial
    }
  }

  return $null
}

function Start-GoogleTvEmulator {
  Assert-ToolExists -Path $EmulatorPath -Label 'Android emulator'

  $runningSerial = Get-RunningGoogleTvSerial
  if ($runningSerial) {
    Write-Host "Google TV emulator already running on $runningSerial"
    return $runningSerial
  }

  Start-Process -FilePath $EmulatorPath -ArgumentList "@$AvdName" | Out-Null
  Write-Host "Starting Google TV emulator $AvdName..."

  do {
    Start-Sleep -Seconds 2
    $serial = Get-RunningGoogleTvSerial
  } while (-not $serial)

  & $AdbPath -s $serial wait-for-device | Out-Null

  do {
    Start-Sleep -Seconds 2
    $boot = (& $AdbPath -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  } while ($boot -ne '1')

  Write-Host "Google TV emulator ready on $serial"
  return $serial
}

function Build-GoogleTvApk {
  Invoke-AppCommand bunx tauri android build --debug --target $TauriTarget --apk true --aab false --ci

  if (-not (Test-Path $UniversalDebugApk)) {
    throw "Expected APK not found at $UniversalDebugApk"
  }

  Write-Host "Built Google TV APK: $UniversalDebugApk"
}

function Install-GoogleTvApk {
  param(
    [string]$Serial
  )

  if (-not (Test-Path $UniversalDebugApk)) {
    throw "APK not found at $UniversalDebugApk. Run build first."
  }

  & $AdbPath -s $Serial install -r $UniversalDebugApk
  if ($LASTEXITCODE -ne 0) {
    throw "APK install failed"
  }
}

Assert-ToolExists -Path $AdbPath -Label 'adb'

switch ($Action) {
  'build' {
    Build-GoogleTvApk
  }
  'install' {
    $serial = Start-GoogleTvEmulator
    Install-GoogleTvApk -Serial $serial
  }
  'dev' {
    $serial = Start-GoogleTvEmulator
    Invoke-AppCommand bun run android:ports
    Write-Host "Launching Tauri Android dev on $AvdName ($serial)"
    Invoke-AppCommandWithEnv @{ ANDROID_SERIAL = $serial } bunx tauri android dev $AvdName
  }
  'logcat' {
    $serial = Get-RunningGoogleTvSerial
    if (-not $serial) {
      throw "No Google TV emulator running"
    }
    Write-Host "Showing focused Google TV logs for $serial (ZentrioTvInput, app runtime, crashes)"
    & $AdbPath -s $serial logcat -v time `
      ZentrioTvInput:D `
      Tauri:D `
      tauri:D `
      RustStdoutStderr:I `
      chromium:I `
      AndroidRuntime:E `
      WebViewFactory:I `
      '*:S'
  }
}
