[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$RemoteMutexName = 'Zentrio.GoogleTvRemote'
$createdNew = $false
$remoteMutex = New-Object System.Threading.Mutex($true, $RemoteMutexName, [ref]$createdNew)

if (-not $createdNew) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    [void]$shell.AppActivate('Zentrio Google TV Remote')
  } catch {
  }

  exit 0
}

$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$AdbPath = Join-Path $SdkRoot 'platform-tools\adb.exe'
$EmulatorPath = Join-Path $SdkRoot 'emulator\emulator.exe'
$AvdName = 'ZentrioGoogleTV'
$PackageName = 'com.zentrio.mteij'
$MainActivity = 'com.zentrio.mteij/.MainActivity'
$GoogleTvScript = Join-Path $PSScriptRoot 'google-tv.ps1'

function Assert-ToolExists {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path $Path)) {
    throw "$Label not found at $Path"
  }
}

Assert-ToolExists -Path $GoogleTvScript -Label 'google-tv helper'
Assert-ToolExists -Path $AdbPath -Label 'adb'
Assert-ToolExists -Path $EmulatorPath -Label 'Android emulator'

$script:ActionInFlight = $false

function Invoke-HiddenProcess {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [int]$TimeoutMs = 8000,
    [string]$WorkingDirectory = $AppRoot
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $FilePath
  $startInfo.Arguments = [string]::Join(' ', ($Arguments | ForEach-Object {
    if ($_ -match '\s') {
      '"' + $_.Replace('"', '\"') + '"'
    } else {
      $_
    }
  }))
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void]$process.Start()

  if (-not $process.WaitForExit($TimeoutMs)) {
    try {
      $process.Kill()
    } catch {
    }
    throw "Timed out running $FilePath"
  }

  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()

  if ($process.ExitCode -ne 0) {
    $message = ($stderr.Trim(), $stdout.Trim() | Where-Object { $_ } | Select-Object -First 1)
    throw ($message -join ' ')
  }

  return [pscustomobject]@{
    StdOut = $stdout
    StdErr = $stderr
    ExitCode = $process.ExitCode
  }
}

function Get-RunningGoogleTvSerial {
  $devices = Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('devices') -TimeoutMs 4000
  $lines = $devices.StdOut -split "`r?`n"

  foreach ($line in $lines) {
    if ($line -notmatch '^emulator-\d+\s+device$') {
      continue
    }

    $serial = ($line -split '\s+')[0]

    try {
      $nameOutput = (Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('-s', $serial, 'emu', 'avd', 'name') -TimeoutMs 3000).StdOut
      $name = (($nameOutput -split "`r?`n" | Where-Object { $_.Trim() -and $_.Trim() -ne 'OK' } | Select-Object -First 1) | Out-String).Trim()
      if ($name -eq $AvdName) {
        return $serial
      }
    } catch {
    }
  }

  return $null
}

function Get-ReadyGoogleTvSerial {
  $serial = Get-RunningGoogleTvSerial
  if (-not $serial) {
    throw 'Google TV emulator is not ready yet. Start it and wait for Android boot to finish.'
  }

  return $serial
}

function Get-InstalledState {
  param(
    [string]$Serial
  )

  try {
    $result = Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('-s', $Serial, 'shell', 'pm', 'path', $PackageName) -TimeoutMs 5000
    return -not [string]::IsNullOrWhiteSpace($result.StdOut)
  } catch {
    return $false
  }
}

function Get-RemoteStatusText {
  $serial = Get-RunningGoogleTvSerial
  if (-not $serial) {
    return 'Emulator stopped or still booting'
  }

  if (Get-InstalledState -Serial $serial) {
    return "Ready on $serial"
  }

  return "Emulator ready on $serial"
}

function Start-GoogleTvEmulatorQuick {
  $serial = Get-RunningGoogleTvSerial
  if ($serial) {
    return "Emulator already running on $serial"
  }

  Start-Process -FilePath $EmulatorPath -ArgumentList "@$AvdName" | Out-Null
  return "Starting $AvdName"
}

function Send-GoogleTvKey {
  param(
    [int]$KeyCode
  )

  $serial = Get-ReadyGoogleTvSerial
  [void](Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('-s', $serial, 'shell', 'input', 'keyevent', "$KeyCode") -TimeoutMs 5000)
  return "Sent keyevent $KeyCode"
}

function Convert-ToAdbInputText {
  param(
    [string]$Text
  )

  if ([string]::IsNullOrEmpty($Text)) {
    return ''
  }

  $builder = New-Object System.Text.StringBuilder
  $normalized = $Text.Replace("`r`n", ' ').Replace("`n", ' ').Replace("`r", ' ')

  foreach ($char in $normalized.ToCharArray()) {
    switch ($char) {
      ' ' { [void]$builder.Append('%s') }
      '\' { [void]$builder.Append('\\') }
      '"' { [void]$builder.Append('\"') }
      '''' { [void]$builder.Append("\'") }
      '&' { [void]$builder.Append('\&') }
      '|' { [void]$builder.Append('\|') }
      '<' { [void]$builder.Append('\<') }
      '>' { [void]$builder.Append('\>') }
      ';' { [void]$builder.Append('\;') }
      '(' { [void]$builder.Append('\(') }
      ')' { [void]$builder.Append('\)') }
      '[' { [void]$builder.Append('\[') }
      ']' { [void]$builder.Append('\]') }
      '{' { [void]$builder.Append('\{') }
      '}' { [void]$builder.Append('\}') }
      '$' { [void]$builder.Append('\$') }
      '*' { [void]$builder.Append('\*') }
      '?' { [void]$builder.Append('\?') }
      '!' { [void]$builder.Append('\!') }
      '#' { [void]$builder.Append('\#') }
      '~' { [void]$builder.Append('\~') }
      default { [void]$builder.Append($char) }
    }
  }

  return $builder.ToString()
}

function Send-GoogleTvText {
  param(
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    throw 'Nothing to type yet'
  }

  $serial = Get-ReadyGoogleTvSerial
  $encodedText = Convert-ToAdbInputText -Text $Text
  [void](Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('-s', $serial, 'shell', 'input', 'text', $encodedText) -TimeoutMs 8000)
  return "Typed: $Text"
}

function Launch-GoogleTvAppQuick {
  $serial = Get-ReadyGoogleTvSerial
  [void](Invoke-HiddenProcess -FilePath $AdbPath -Arguments @('-s', $serial, 'shell', 'am', 'start', '-n', $MainActivity) -TimeoutMs 8000)
  return "Launched Zentrio on $serial"
}

function Invoke-GoogleTvCliAction {
  param(
    [string]$Action,
    [string]$SuccessMessage
  )

  [void](Invoke-HiddenProcess -FilePath 'powershell' -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $GoogleTvScript, $Action) -TimeoutMs 1800000)
  return $SuccessMessage
}

function Invoke-RemoteAction {
  param(
    [scriptblock]$Action,
    [string]$Label
  )

  if ($script:ActionInFlight) {
    $script:StatusLabel.Text = 'Another action is still running'
    $script:StatusLabel.ForeColor = [System.Drawing.Color]::DarkGoldenrod
    return
  }

  $script:ActionInFlight = $true
  $script:StatusLabel.Text = "$Label..."
  $script:StatusLabel.ForeColor = [System.Drawing.Color]::FromArgb(25, 25, 25)
  [System.Windows.Forms.Application]::DoEvents()

  try {
    $result = & $Action
    if ([string]::IsNullOrWhiteSpace($result)) {
      $result = "$Label complete"
    }

    $script:StatusLabel.Text = $result
    $script:StatusLabel.ForeColor = [System.Drawing.Color]::FromArgb(25, 25, 25)
  } catch {
    $script:StatusLabel.Text = "Error: $($_.Exception.Message)"
    $script:StatusLabel.ForeColor = [System.Drawing.Color]::Firebrick
  } finally {
    $script:ActionInFlight = $false
  }
}

function New-RemoteButton {
  param(
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width = 86,
    [int]$Height = 42
  )

  $button = New-Object System.Windows.Forms.Button
  $button.Text = $Text
  $button.Location = New-Object System.Drawing.Point($X, $Y)
  $button.Size = New-Object System.Drawing.Size($Width, $Height)
  $button.FlatStyle = [System.Windows.Forms.FlatStyle]::System
  return $button
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Zentrio Google TV Remote'
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.Size = New-Object System.Drawing.Size(360, 680)
$form.MinimumSize = $form.Size
$form.MaximumSize = $form.Size
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.KeyPreview = $true
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(246, 246, 243)
$form.Add_FormClosed({
  if ($remoteMutex) {
    $remoteMutex.ReleaseMutex()
    $remoteMutex.Dispose()
  }
})

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Google TV Remote'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(22, 18)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Arrow keys navigate. Enter selects. Esc or Backspace goes back.'
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$subtitle.AutoSize = $false
$subtitle.Size = New-Object System.Drawing.Size(314, 34)
$subtitle.Location = New-Object System.Drawing.Point(24, 52)
$form.Controls.Add($subtitle)

$emulatorButton = New-RemoteButton -Text 'Emulator' -X 24 -Y 92 -Width 96
$wakeButton = New-RemoteButton -Text 'Wake' -X 130 -Y 92 -Width 86
$launchButton = New-RemoteButton -Text 'Launch App' -X 226 -Y 92 -Width 96

$homeButton = New-RemoteButton -Text 'Home' -X 24 -Y 144 -Width 96
$backButton = New-RemoteButton -Text 'Back' -X 130 -Y 144 -Width 86
$statusButton = New-RemoteButton -Text 'Status' -X 226 -Y 144 -Width 96

$buildButton = New-RemoteButton -Text 'Build APK' -X 24 -Y 196 -Width 96
$installButton = New-RemoteButton -Text 'Install APK' -X 130 -Y 196 -Width 86
$devButton = New-RemoteButton -Text 'Dev' -X 226 -Y 196 -Width 96

$upButton = New-RemoteButton -Text 'Up' -X 130 -Y 272 -Width 86 -Height 54
$leftButton = New-RemoteButton -Text 'Left' -X 42 -Y 332 -Width 86 -Height 54
$selectButton = New-RemoteButton -Text 'Select' -X 130 -Y 332 -Width 86 -Height 54
$rightButton = New-RemoteButton -Text 'Right' -X 218 -Y 332 -Width 86 -Height 54
$downButton = New-RemoteButton -Text 'Down' -X 130 -Y 392 -Width 86 -Height 54

$typeLabel = New-Object System.Windows.Forms.Label
$typeLabel.Text = 'Type with your desktop keyboard'
$typeLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$typeLabel.AutoSize = $true
$typeLabel.Location = New-Object System.Drawing.Point(24, 466)

$typeBox = New-Object System.Windows.Forms.TextBox
$typeBox.Location = New-Object System.Drawing.Point(24, 490)
$typeBox.Size = New-Object System.Drawing.Size(198, 28)
$typeBox.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$typeSendButton = New-RemoteButton -Text 'Type Text' -X 230 -Y 486 -Width 92
$keyboardPassthrough = New-Object System.Windows.Forms.CheckBox
$keyboardPassthrough.Text = 'Keyboard passthrough'
$keyboardPassthrough.AutoSize = $true
$keyboardPassthrough.Location = New-Object System.Drawing.Point(24, 534)
$keyboardPassthrough.Font = New-Object System.Drawing.Font('Segoe UI', 9)

$typeEnterButton = New-RemoteButton -Text 'Enter' -X 230 -Y 530 -Width 92

$statusPanel = New-Object System.Windows.Forms.Panel
$statusPanel.Location = New-Object System.Drawing.Point(24, 604)
$statusPanel.Size = New-Object System.Drawing.Size(298, 34)
$statusPanel.BackColor = [System.Drawing.Color]::White
$statusPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle

$script:StatusLabel = New-Object System.Windows.Forms.Label
$script:StatusLabel.Text = 'Ready'
$script:StatusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$script:StatusLabel.AutoEllipsis = $true
$script:StatusLabel.Location = New-Object System.Drawing.Point(8, 8)
$script:StatusLabel.Size = New-Object System.Drawing.Size(280, 18)
$statusPanel.Controls.Add($script:StatusLabel)

$buttons = @(
  $emulatorButton, $wakeButton, $launchButton,
  $homeButton, $backButton, $statusButton,
  $buildButton, $installButton, $devButton,
  $upButton, $leftButton, $selectButton, $rightButton, $downButton,
  $typeSendButton, $typeEnterButton
)

foreach ($button in $buttons) {
  $form.Controls.Add($button)
}

$form.Controls.Add($typeLabel)
$form.Controls.Add($typeBox)
$form.Controls.Add($keyboardPassthrough)
$form.Controls.Add($statusPanel)

$emulatorButton.Add_Click({ Invoke-RemoteAction -Action { Start-GoogleTvEmulatorQuick } -Label 'Starting emulator' })
$wakeButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 224; 'Wake sent' } -Label 'Waking device' })
$launchButton.Add_Click({ Invoke-RemoteAction -Action { Launch-GoogleTvAppQuick } -Label 'Launching Zentrio' })
$homeButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 3; 'Home sent' } -Label 'Sending Home' })
$backButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 4; 'Back sent' } -Label 'Sending Back' })
$statusButton.Add_Click({ Invoke-RemoteAction -Action { Get-RemoteStatusText } -Label 'Checking status' })
$buildButton.Add_Click({ Invoke-RemoteAction -Action { Invoke-GoogleTvCliAction -Action 'build' -SuccessMessage 'Build finished' } -Label 'Building Google TV APK' })
$installButton.Add_Click({ Invoke-RemoteAction -Action { Invoke-GoogleTvCliAction -Action 'install' -SuccessMessage 'Install finished' } -Label 'Installing APK' })
$devButton.Add_Click({ Invoke-RemoteAction -Action { Invoke-GoogleTvCliAction -Action 'dev' -SuccessMessage 'Dev flow started' } -Label 'Starting dev mode' })

$upButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 19; 'Up sent' } -Label 'Sending Up' })
$leftButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 21; 'Left sent' } -Label 'Sending Left' })
$selectButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 23; 'Select sent' } -Label 'Sending Select' })
$rightButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 22; 'Right sent' } -Label 'Sending Right' })
$downButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 20; 'Down sent' } -Label 'Sending Down' })
$typeSendButton.Add_Click({
  Invoke-RemoteAction -Action {
    $text = $typeBox.Text
    $result = Send-GoogleTvText -Text $text
    $typeBox.Clear()
    $typeBox.Focus()
    $result
  } -Label 'Typing text'
})
$typeEnterButton.Add_Click({ Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 66; 'Enter sent' } -Label 'Sending Enter' })

$typeBox.Add_KeyDown({
  param($sender, $eventArgs)

  if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
    Invoke-RemoteAction -Action {
      $text = $typeBox.Text
      $result = Send-GoogleTvText -Text $text
      $typeBox.Clear()
      $typeBox.Focus()
      $result
    } -Label 'Typing text'
    $eventArgs.SuppressKeyPress = $true
    $eventArgs.Handled = $true
  }
})

$form.Add_KeyDown({
  param($sender, $eventArgs)

  $typingIntoBox = ($form.ActiveControl -eq $typeBox)
  $keyboardMode = $keyboardPassthrough.Checked -and -not $typingIntoBox

  switch ($eventArgs.KeyCode) {
    'Up' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 19; 'Up sent' } -Label 'Sending Up'
      $eventArgs.Handled = $true
    }
    'Down' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 20; 'Down sent' } -Label 'Sending Down'
      $eventArgs.Handled = $true
    }
    'Left' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 21; 'Left sent' } -Label 'Sending Left'
      $eventArgs.Handled = $true
    }
    'Right' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 22; 'Right sent' } -Label 'Sending Right'
      $eventArgs.Handled = $true
    }
    'Enter' {
      if ($keyboardMode) {
        Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 66; 'Enter sent' } -Label 'Sending Enter'
      } else {
        Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 23; 'Select sent' } -Label 'Sending Select'
      }
      $eventArgs.Handled = $true
    }
    'Escape' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 4; 'Back sent' } -Label 'Sending Back'
      $eventArgs.Handled = $true
    }
    'Back' {
      if ($keyboardMode) {
        Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 67; 'Backspace sent' } -Label 'Sending Backspace'
      } else {
        Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 4; 'Back sent' } -Label 'Sending Back'
      }
      $eventArgs.Handled = $true
    }
    'Home' {
      Invoke-RemoteAction -Action { Send-GoogleTvKey -KeyCode 3; 'Home sent' } -Label 'Sending Home'
      $eventArgs.Handled = $true
    }
  }
})

$form.Add_KeyPress({
  param($sender, $eventArgs)

  $typingIntoBox = ($form.ActiveControl -eq $typeBox)
  if (-not $keyboardPassthrough.Checked -or $typingIntoBox) {
    return
  }

  if ([char]::IsControl($eventArgs.KeyChar)) {
    return
  }

  $typedChar = [string]$eventArgs.KeyChar
  Invoke-RemoteAction -Action { Send-GoogleTvText -Text $typedChar } -Label "Typing $typedChar"
  $eventArgs.Handled = $true
})

[void]$form.ShowDialog()
