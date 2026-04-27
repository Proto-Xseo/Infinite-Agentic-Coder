#!/usr/bin/env bash
# Install all workspace dependencies. Idempotent.
set -e
cd "$(dirname "$0")/.."
echo "==> Installing workspace dependencies (pnpm install)"
pnpm install --no-frozen-lockfile
echo "✓ Dependencies installed"
