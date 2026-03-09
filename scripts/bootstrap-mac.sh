#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[bootstrap-mac] This script is for macOS. Detected: $(uname -s)" >&2
  exit 1
fi

echo "[bootstrap-mac] Repo: $ROOT"

if ! command -v xcode-select >/dev/null 2>&1; then
  echo "[bootstrap-mac] xcode-select not found. Are you on macOS?" >&2
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "[bootstrap-mac] Installing Xcode Command Line Tools (required for git + native deps)..."
  # This triggers a GUI prompt; after completion, rerun the script.
  xcode-select --install || true
  echo "[bootstrap-mac] Finish installing Xcode Command Line Tools, then re-run:"
  echo "  $0"
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "[bootstrap-mac] Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

echo "[bootstrap-mac] Updating Homebrew..."
brew update

echo "[bootstrap-mac] Installing prerequisites (git, jq)..."
brew install git jq

if ! command -v volta >/dev/null 2>&1; then
  echo "[bootstrap-mac] Installing Volta (pinned Node + pnpm toolchain)..."
  curl -fsSL https://get.volta.sh | bash -s -- --skip-setup
fi

export VOLTA_HOME="${VOLTA_HOME:-$HOME/.volta}"
export PATH="$VOLTA_HOME/bin:$PATH"

if ! command -v volta >/dev/null 2>&1; then
  echo "[bootstrap-mac] Volta is still not available on PATH. Restart your shell and re-run:" >&2
  echo "  $0" >&2
  exit 1
fi

volta setup --quiet >/dev/null 2>&1 || true

echo "[bootstrap-mac] Installing Node.js 20.x + pnpm 9.7.0 (via Volta)..."
volta install node@20 pnpm@9.7.0

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" -ne 20 ]]; then
  echo "[bootstrap-mac] Node.js 20.x required. Detected: $(node -v)" >&2
  echo "[bootstrap-mac] Fix: restart your shell so Volta shims are on PATH, then re-run $0" >&2
  exit 1
fi

echo "[bootstrap-mac] Versions:"
echo "  node:  $(node -v)"
echo "  pnpm:  $(pnpm -v)"
echo "  git:   $(git --version)"
echo "  jq:    $(jq --version)"

echo "[bootstrap-mac] Creating .env files from templates (no overwrite)..."
node scripts/setup-env.js

echo "[bootstrap-mac] Installing repo dependencies (pnpm install -r)..."
pnpm install -r --frozen-lockfile

cat <<'EOF'
[bootstrap-mac] Done.

Next:
  pnpm dev

Notes:
- Wallet iOS track requires Xcode (full) + iOS Simulator. This script installs only CLI prerequisites.
- Wallet Android track requires Android Studio (not installed by this script).
EOF
