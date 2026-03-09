$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
  $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  if ($machinePath -and $userPath) { $env:Path = "$machinePath;$userPath" }
  elseif ($machinePath) { $env:Path = $machinePath }
  elseif ($userPath) { $env:Path = $userPath }
}

function Ensure-VoltaPath {
  if (-not $env:LOCALAPPDATA) { return }
  $voltaBin = Join-Path $env:LOCALAPPDATA 'Volta\bin'
  if (Test-Path $voltaBin) {
    # Put Volta shims first so `node`/`pnpm` resolve to the pinned versions.
    $env:Path = "$voltaBin;$env:Path"
  }
}

function Ensure-WingetPackages {
  param([string[]]$Ids)

  if (-not (Test-Command winget)) {
    return $false
  }

  foreach ($id in $Ids) {
    Write-Host "[bootstrap-windows] winget install $id"
    winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements | Out-Host
  }

  Refresh-Path
  return $true
}

function Ensure-ScoopPackages {
  param([string[]]$Apps)

  if (-not (Test-Command scoop)) {
    Write-Host "[bootstrap-windows] Installing Scoop (current user)..."
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    irm get.scoop.sh | iex
    Refresh-Path
  }

  if (-not (Test-Command scoop)) {
    return $false
  }

  foreach ($app in $Apps) {
    Write-Host "[bootstrap-windows] scoop install $app"
    scoop install $app | Out-Host
  }

  Refresh-Path
  return $true
}

function Ensure-ChocoPackages {
  param([string[]]$Pkgs)

  if (-not (Test-Command choco)) {
    Write-Host "[bootstrap-windows] Installing Chocolatey (may require admin)..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    Refresh-Path
  }

  if (-not (Test-Command choco)) {
    return $false
  }

  foreach ($pkg in $Pkgs) {
    Write-Host "[bootstrap-windows] choco install $pkg -y"
    choco install $pkg -y --no-progress | Out-Host
  }

  Refresh-Path
  return $true
}

function Get-NodeMajorVersion {
  if (-not (Test-Command node)) { return 0 }
  try {
    $v = node -p "process.versions.node.split('.')[0]"
    return [int]$v
  } catch {
    return 0
  }
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "[bootstrap-windows] Repo: $Root"

$installed = $false

# Prefer winget (built-in on many Windows 10/11 installs). Fall back to Scoop (user-level), then Chocolatey.
if (-not (Test-Command git)) {
  $installed = (Ensure-WingetPackages @('Git.Git')) -or $installed
  if (-not (Test-Command git)) {
    $installed = (Ensure-ScoopPackages @('git')) -or $installed
  }
  if (-not (Test-Command git)) {
    $installed = (Ensure-ChocoPackages @('git')) -or $installed
  }
}

# Install a pinned Node version via Volta to avoid native dependency/ABI mismatches.
if (-not (Test-Command volta)) {
  $installed = (Ensure-WingetPackages @('Volta.Volta')) -or $installed
  if (-not (Test-Command volta)) {
    $installed = (Ensure-ScoopPackages @('volta')) -or $installed
  }
  if (-not (Test-Command volta)) {
    $installed = (Ensure-ChocoPackages @('volta')) -or $installed
  }
  Refresh-Path
  Ensure-VoltaPath
}

if (-not (Test-Command volta)) {
  throw "volta is still not available on PATH. Re-open PowerShell and re-run: .\\scripts\\bootstrap-windows.ps1"
}

Write-Host "[bootstrap-windows] Installing Node.js 20.x + pnpm 9.7.0 (via Volta)..."
volta install node@20 pnpm@9.7.0 | Out-Host

Refresh-Path
Ensure-VoltaPath

# jq is optional but makes the lab curl examples much nicer.
if (-not (Test-Command jq)) {
  $null = (Ensure-WingetPackages @('jqlang.jq')) -or $false
  if (-not (Test-Command jq)) {
    $null = (Ensure-ScoopPackages @('jq')) -or $false
  }
  if (-not (Test-Command jq)) {
    $null = (Ensure-ChocoPackages @('jq')) -or $false
  }
}

Refresh-Path
Ensure-VoltaPath

if (-not (Test-Command git)) {
  throw "git is still not available on PATH. Re-open PowerShell and re-run: .\\scripts\\bootstrap-windows.ps1"
}
if (-not (Test-Command node)) {
  throw "node is still not available on PATH. Re-open PowerShell and re-run: .\\scripts\\bootstrap-windows.ps1"
}
if ((Get-NodeMajorVersion) -ne 20) {
  throw "Node.js 20.x required. Detected: $(node -v)"
}

if (-not (Test-Command pnpm)) {
  throw "pnpm is still not available on PATH. Re-open PowerShell and re-run: .\\scripts\\bootstrap-windows.ps1"
}

Write-Host "[bootstrap-windows] Versions:"
Write-Host "  node:  $(node -v)"
Write-Host "  pnpm:  $(pnpm -v)"
Write-Host "  git:   $(git --version)"
if (Test-Command jq) { Write-Host "  jq:    $(jq --version)" }

Write-Host "[bootstrap-windows] Creating .env files from templates (no overwrite)..."
node .\scripts\setup-env.js

Write-Host "[bootstrap-windows] Installing repo dependencies (pnpm install -r)..."
pnpm install -r --frozen-lockfile

Write-Host ""
Write-Host "[bootstrap-windows] Done."
Write-Host ""
Write-Host "Next:"
Write-Host "  pnpm dev"
Write-Host ""
Write-Host "Notes:"
Write-Host "- Wallet Android track requires Android Studio (not installed by this script)."
Write-Host "- Wallet iOS track requires macOS + Xcode."
