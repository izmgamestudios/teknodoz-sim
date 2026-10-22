<#
Teknodoz Sim - CloudPanel deploy (PowerShell 7+, OpenSSH client gerekli)

Kullanim:
  ./scripts/deploy.ps1 -Server 1.2.3.4 -User siteuser -SitePath /home/siteuser/htdocs/sim.example.com
  ./scripts/deploy.ps1 -Server 1.2.3.4 -User siteuser -SitePath /home/siteuser/htdocs/sim.example.com -InstallMatraix

CloudPanel'de: Sites > Add Site > "Static" (veya Node) olusturun, Root Directory'yi
SitePath ile eslestirin, Site User'in SSH key'ini ekleyin (Admin Area > SSH Keys / Site > SSH/FTP).
#>
param(
  [Parameter(Mandatory)][string]$Server,
  [Parameter(Mandatory)][string]$User,
  [Parameter(Mandatory)][string]$SitePath,
  [switch]$InstallMatraix
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

npm ci
npm run build

ssh "$User@$Server" "mkdir -p '$SitePath'"
scp -r dist/* "$User@${Server}:$SitePath/"

if ($InstallMatraix) {
  # Sunucuda Linux uzerinde calisir (MatrAIx icin Python 3.12 + uv gerekir; Docker Web/App gorevleri icin).
  $remote = @"
set -e
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="`$HOME/.local/bin:`$PATH"
cd ~ && [ -d MatrAIx ] || git clone --depth 1 https://github.com/MatrAIx-ai/MatrAIx-Persona-8B MatrAIx
cd MatrAIx && uv venv --python 3.12 && uv pip install -e . \
  && uv run matraix smoke application/tasks/example-survey_product-feedback
"@
  ssh "$User@$Server" $remote
}
Write-Host 'Tamam.'
