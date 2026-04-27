#!/usr/bin/env bash
# ============================================================================
# Infinite Agentic Coder — one-shot bootstrap
# ============================================================================
# Run this script ONCE after cloning into a fresh Repl. It will:
#   1. Verify pnpm + Node are present
#   2. Verify the Replit Anthropic proxy env vars are present
#   3. Verify a Postgres DATABASE_URL is present
#   4. Install all workspace dependencies
#   5. Push the Drizzle schema to your database
#   6. Print next-step instructions
#
# Usage:    bash scripts/bootstrap.sh
# Or:       sh scripts/bootstrap.sh
# ============================================================================

set -e

cd "$(dirname "$0")/.."

GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
BOLD="\033[1m"
RESET="\033[0m"

step() { printf "\n${BLUE}${BOLD}==> %s${RESET}\n" "$1"; }
ok()   { printf "${GREEN}  ✓ %s${RESET}\n" "$1"; }
warn() { printf "${YELLOW}  ! %s${RESET}\n" "$1"; }
fail() { printf "${RED}  ✗ %s${RESET}\n" "$1"; exit 1; }

# ---------------------------------------------------------------------------
step "1/5  Checking toolchain"
# ---------------------------------------------------------------------------
command -v node  >/dev/null 2>&1 || fail "node not found. Open the Replit shell and run: install Node 24 via Tools → Languages."
command -v pnpm  >/dev/null 2>&1 || fail "pnpm not found. Replit normally provides pnpm — try refreshing the shell."
ok "node $(node -v)"
ok "pnpm $(pnpm -v)"

# ---------------------------------------------------------------------------
step "2/5  Checking Anthropic proxy credentials"
# ---------------------------------------------------------------------------
if [ -n "$AI_INTEGRATIONS_ANTHROPIC_BASE_URL" ] && [ -n "$AI_INTEGRATIONS_ANTHROPIC_API_KEY" ]; then
  ok "AI_INTEGRATIONS_ANTHROPIC_BASE_URL is set"
  ok "AI_INTEGRATIONS_ANTHROPIC_API_KEY is set"
else
  warn "Anthropic proxy env vars are NOT set."
  cat <<'EOF'

  ┌──────────────────────────────────────────────────────────────────────┐
  │  HOW TO ENABLE THE REPLIT ANTHROPIC PROXY (one-time, per Repl)       │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  Option A — Ask the Replit Agent (easiest):                          │
  │    Open the chat sidebar and say:                                    │
  │      "set up the Anthropic AI integration"                           │
  │    The agent will run setupReplitAIIntegrations and the env vars     │
  │    AI_INTEGRATIONS_ANTHROPIC_BASE_URL and                            │
  │    AI_INTEGRATIONS_ANTHROPIC_API_KEY will appear in Secrets.         │
  │                                                                      │
  │  Option B — Use Replit Tools UI:                                     │
  │    1. Open the Tools panel (left sidebar)                            │
  │    2. Click "+ New Tool" → "AI"                                      │
  │    3. Pick "Anthropic" and confirm                                   │
  │    4. Replit injects the two env vars above into Secrets             │
  │                                                                      │
  │  Then re-run:    bash scripts/bootstrap.sh                           │
  │                                                                      │
  │  Notes:                                                              │
  │   • You DO NOT need your own Anthropic API key — the proxy bills     │
  │     usage to your Replit credits.                                    │
  │   • The API key value is a placeholder; do not edit it manually.     │
  │   • Available models: claude-sonnet-4-6 (default), claude-opus-4-7,  │
  │     claude-haiku-4-5.                                                │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘

EOF
  fail "Bootstrap stopped — provision the proxy and re-run."
fi

# ---------------------------------------------------------------------------
step "3/5  Checking database"
# ---------------------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
  warn "DATABASE_URL is not set."
  cat <<'EOF'

  Create a Replit Postgres database:
    1. Open the Database tool in the left sidebar
    2. Click "Create a database"
    3. Replit injects DATABASE_URL into Secrets automatically
    4. Re-run:  bash scripts/bootstrap.sh

EOF
  fail "Bootstrap stopped — create a database and re-run."
fi
ok "DATABASE_URL is set"

# ---------------------------------------------------------------------------
step "4/5  Installing workspace dependencies"
# ---------------------------------------------------------------------------
pnpm install --no-frozen-lockfile
ok "Dependencies installed"

# ---------------------------------------------------------------------------
step "5/5  Pushing database schema"
# ---------------------------------------------------------------------------
if pnpm --filter @workspace/db run push; then
  ok "Schema pushed"
else
  warn "Standard push failed — retrying with --force (safe for fresh DBs)"
  pnpm --filter @workspace/db run push-force
  ok "Schema pushed (force)"
fi

# ---------------------------------------------------------------------------
printf "\n${GREEN}${BOLD}🎉  Bootstrap complete!${RESET}\n\n"
cat <<EOF
Start the app with the existing workflows:
  • API Server   →  http://localhost:8080  (artifact: /api)
  • Web frontend →  http://localhost:5000  (artifact: /)

Or from the shell:
  pnpm --filter @workspace/api-server   run dev   &
  pnpm --filter @workspace/coding-agent run dev

Then open the preview pane and start chatting.
EOF
