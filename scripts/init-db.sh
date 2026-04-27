#!/usr/bin/env bash
# Push the Drizzle schema to the Postgres pointed at by $DATABASE_URL.
# Falls back to --force if a normal push fails (safe for fresh DBs).
set -e
cd "$(dirname "$0")/.."

if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL is not set."
  echo "  Create a Postgres database via the Replit Database tool, then re-run."
  exit 1
fi

echo "==> Pushing Drizzle schema to \$DATABASE_URL"
if pnpm --filter @workspace/db run push; then
  echo "✓ Schema pushed"
else
  echo "  Standard push failed — retrying with --force"
  pnpm --filter @workspace/db run push-force
  echo "✓ Schema pushed (force)"
fi
