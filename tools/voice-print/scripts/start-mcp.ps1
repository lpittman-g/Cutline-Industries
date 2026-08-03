# Start voice-print MCP for GitHub Copilot (Windows)
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$VoicePrint = Join-Path $RepoRoot 'tools/voice-print'
Set-Location $VoicePrint

if (-not (Test-Path 'node_modules')) {
  npm install
}

$env:VOICE_PRINT_PRINTER_IP = if ($env:VOICE_PRINT_PRINTER_IP) { $env:VOICE_PRINT_PRINTER_IP } else { '192.168.1.157' }
$env:VOICE_PRINT_DEFAULT_FILE = if ($env:VOICE_PRINT_DEFAULT_FILE) { $env:VOICE_PRINT_DEFAULT_FILE } else { 'docs/combined-print.html' }

node (Join-Path $VoicePrint 'mcp/server.js')
