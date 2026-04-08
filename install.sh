#!/usr/bin/env bash
set -e

# ── Preflight checks ──────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js >=18 is required. Install from https://nodejs.org" >&2
  exit 1
fi

NODE_MAJOR=$(node -e 'process.stdout.write(process.version.split(".")[0].slice(1))')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js >=18 required (found $(node --version))" >&2
  exit 1
fi

if [ ! -t 0 ]; then
  echo "" >&2
  echo "Note: stdin is not a terminal — interactive prompts will be skipped." >&2
  echo "For interactive install, use: bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh)" >&2
  echo "" >&2
fi

# ── Install ───────────────────────────────────────────────────────────────────

REPO="https://github.com/aaronjoeldev/knowledge-to-obsidian.git"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading kto..."
git clone --depth 1 --quiet "$REPO" "$TMP/kto" || {
  echo "Error: failed to clone kto repository. Check your internet connection." >&2
  exit 1
}

node "$TMP/kto/bin/install.cjs" "$@"
