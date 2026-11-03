param(
    [string]$At = "07:00"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
$refreshScript = Join-Path $projectRoot "src\run_daily.py"

if (-not (Test-Path $python)) {
    throw "Project Python environment not found at $python. Create it and install requirements first."
}
if (-not (Test-Path $refreshScript)) {
    throw "Refresh script not found at $refreshScript."
}

$runTime = [TimeSpan]::ParseExact($At, "hh\:mm", [Globalization.CultureInfo]::InvariantCulture)
$triggerTime = [DateTime]::Today.Add($runTime)
$action = New-ScheduledTaskAction `
    -Execute $python `
    -Argument ('-u "' + $refreshScript + '"') `
    -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName "AurumWatch-Daily-Data-Refresh" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Refresh AurumWatch public market data and rebuild reports daily." `
    -Force | Out-Null

Write-Output "Installed daily refresh at $At local time."
Write-Output "The task runs while this Windows user is signed in; missed runs start when available."
Write-Output "Logs: $projectRoot\data\logs\daily-refresh.log"
