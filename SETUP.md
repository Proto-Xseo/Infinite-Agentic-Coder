# Infinite Agentic Coder — Setup Guide

A Claude Code-style agentic coding platform that runs on Replit and uses the
**Replit Anthropic proxy** — no Anthropic API key of your own required.

---

## TL;DR — one command

In a fresh Repl, after the Anthropic proxy has been provisioned (see below):

```bash
bash scripts/bootstrap.sh
```

That installs everything, pushes the database schema, and prints how to start
the app. The two long-running workflows (`artifacts/api-server: API Server`
and `artifacts/coding-agent: web`) are already configured — they auto-start
once dependencies are installed.

---

## What you need before running the script

| Requirement                      | How to get it                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Replit account (any plan)        | Sign up at replit.com                                                         |
| `AI_INTEGRATIONS_ANTHROPIC_*`    | Enable the Anthropic proxy — see the next section                             |
| `DATABASE_URL` (Postgres)        | Open the **Database** tool in the left sidebar → "Create a database"          |

The bootstrap script checks all three and tells you exactly what is missing.

---

## How the Replit Anthropic proxy works

Replit ships a managed Anthropic proxy. When you enable it, Replit injects two
environment variables into your Repl's Secrets:

```
AI_INTEGRATIONS_ANTHROPIC_BASE_URL   # the proxy URL (e.g. https://...)
AI_INTEGRATIONS_ANTHROPIC_API_KEY    # a placeholder string used by the SDK
```

The Anthropic SDK is then constructed exactly as usual:

```ts
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});
```

Calls go to the proxy, which forwards to Anthropic and bills the usage to your
**Replit credits** — you never enter an Anthropic key.

### Enabling the proxy in any new Repl (or any new account)

You have two options. Pick whichever is convenient.

#### Option A — Ask the Replit Agent (recommended, takes 5 seconds)

1. Open the chat sidebar (the Agent panel).
2. Type:

   > set up the Anthropic AI integration

3. The agent runs `setupReplitAIIntegrations({ providerSlug: "anthropic" })`,
   which provisions the proxy and writes both env vars into Secrets.
4. Run `bash scripts/bootstrap.sh`.

#### Option B — Use the Tools UI (no agent involved)

1. Open the **Tools** panel on the left sidebar of your Repl.
2. Click **+ New Tool**, then choose **AI**.
3. Pick **Anthropic** and confirm.
4. The two env vars appear under **Secrets** (`AI_INTEGRATIONS_ANTHROPIC_*`).
5. Run `bash scripts/bootstrap.sh`.

> Both env vars must be present for the API server to boot. The bootstrap
> script verifies them before doing anything else.

---

## Available models

The proxy supports the full Claude family. Defaults used in this app:

| Model                | Use                                            |
| -------------------- | ---------------------------------------------- |
| `claude-sonnet-4-6`  | **Default** — balanced reasoning + speed       |
| `claude-opus-4-7`    | Most capable, slowest, highest cost            |
| `claude-haiku-4-5`   | Fastest + cheapest for trivial tasks           |

Change the model in `artifacts/api-server/src/routes/anthropic/messages.ts`.

---

## What the bootstrap script does

```
1/5  Checking toolchain                  → node + pnpm present
2/5  Checking Anthropic proxy creds      → both env vars set
3/5  Checking database                   → DATABASE_URL set
4/5  Installing workspace dependencies   → pnpm install
5/5  Pushing database schema             → pnpm --filter @workspace/db run push
```

Run it as many times as you like — it's idempotent.

---

## Cloning into a brand-new Repl from scratch

```bash
# 1. Fork or import this repo into a new Replit project.
# 2. Open the Database tool → Create a database.       (sets DATABASE_URL)
# 3. Open the chat sidebar and ask the agent:
#       "set up the Anthropic AI integration"          (sets AI_INTEGRATIONS_*)
# 4. In the shell:
       bash scripts/bootstrap.sh
# 5. The two workflows auto-start — open the preview pane and chat.
```

That's it.
