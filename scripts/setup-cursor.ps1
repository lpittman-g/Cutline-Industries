# One-time Cursor setup for Cutline Industries (no Copilot required)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$CursorMcp = Join-Path $env:USERPROFILE '.cursor\mcp.json'
$Example = Join-Path $Root '.cursor\mcp.json.example'

Write-Host 'Cutline -> Cursor primary setup'
Set-Location $Root
npm install

foreach ($tool in @('phone-approval-lite', 'voice-print')) {
  $path = Join-Path $Root "tools\$tool"
  if (Test-Path $path) {
    Write-Host "Installing tools\$tool..."
    Push-Location $path
    npm install
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $Root '.env'))) {
  Copy-Item (Join-Path $Root '.env.example') (Join-Path $Root '.env')
  Write-Host 'Created .env from .env.example'
}

if (Test-Path $Example) {
  if (Test-Path $CursorMcp) {
    Write-Host 'Keeping existing ~/.cursor/mcp.json (merge from .cursor/mcp.json.example if needed)'
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path $CursorMcp) | Out-Null
    Copy-Item $Example $CursorMcp
    Write-Host "Wrote $CursorMcp"
  }
}

Write-Host ''
Write-Host 'Done. Open this folder in Cursor desktop.'
Write-Host 'Docs: docs/CURSOR-PRIMARY.md'
