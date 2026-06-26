$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$EnvPath = Join-Path $projectRoot "01_app\.env.local"

if (!(Test-Path -LiteralPath $EnvPath)) {
  throw ".env.local not found: $EnvPath"
}

$values = @{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+?)=(.*)$') {
    $values[$matches[1].Trim()] = $matches[2]
  }
}

$required = @(
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_APP_PASSWORD",
  "DELIVERY_FROM",
  "DELIVERY_REPLY_TO"
)

$missing = @()
foreach ($key in $required) {
  if (!$values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($values[$key])) {
    $missing += $key
  }
}

if ($missing.Count -gt 0) {
  throw "Missing SMTP settings: $($missing -join ', ')"
}

Write-Host "SMTP settings present."
Write-Host "SMTP_USER=$($values['SMTP_USER'])"
Write-Host "SMTP_APP_PASSWORD length=$($values['SMTP_APP_PASSWORD'].Length)"
Write-Host "SMTP_APP_PASSWORD value was not printed."
