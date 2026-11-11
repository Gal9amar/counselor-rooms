# Copies the project's agents to the user-level agents folder so they are available from any directory.
# Usage: powershell -File scripts/install-agents.ps1
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\.claude\agents'
$cfg = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$dst = Join-Path $cfg 'agents'
New-Item -ItemType Directory -Force $dst | Out-Null
$names = 'rooms-manager','scheduling-domain','api-functions','sql-expert','frontend-ux','pwa-cache','qa-verifier','security-privacy'
foreach ($n in $names) {
  Copy-Item (Join-Path $src "$n.md") (Join-Path $dst "$n.md") -Force
  Write-Host "installed $n -> $dst"
}
