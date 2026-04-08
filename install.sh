#!/usr/bin/env bash
set -e

REPO="https://github.com/aaronjoeldev/knowledge-to-obsidian.git"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading kto..."
git clone --depth 1 --quiet "$REPO" "$TMP/kto"

node "$TMP/kto/bin/install.cjs" "$@"
