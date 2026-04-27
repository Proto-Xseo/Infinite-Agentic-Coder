# Infinite Agentic Coder — Setup

A Claude Code-style agentic coding platform. Uses the **Replit Anthropic
proxy** — no Anthropic API key required.

---

## For the Replit agent (read this first, then act)

In any new Repl, do exactly this and stop:

```js
await setupReplitAIIntegrations({
  providerSlug: "anthropic",
  providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
});
```

```bash
bash scripts/bootstrap.sh
```

That's it. The script handles dependency install, schema push, and verification.
A Postgres `DATABASE_URL` must already exist (Replit auto-injects one when a DB
is created); if missing, the script prints what to do and exits.

---

## For humans

### One-shot setup

```bash
bash scripts/bootstrap.sh
```

Runs all five steps below and stops with a clear message at the first thing it
can't do automatically.

### Individual scripts (use only if bootstrap can't finish)

| Script                          | What it does                                |
| ------------------------------- | ------------------------------------------- |
| `bash scripts/install-deps.sh`  | `pnpm install` for the whole workspace      |
| `bash scripts/init-db.sh`       | Push Drizzle schema (auto-falls back to `--force`) |
| `bash scripts/bootstrap.sh`     | Toolchain + env checks → install-deps → init-db |

### What you need before bootstrap can finish

| Requirement                      | How to get it                                                     |
| -------------------------------- | ----------------------------------------------------------------- |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `_API_KEY` | Tell the agent: *"set up the Anthropic AI integration"* |
| `DATABASE_URL`                   | Open the **Database** tool in the Replit sidebar → "Create a database" |

The Anthropic proxy provisioning is the **only** step a shell script cannot do
on its own — it requires the agent's privileged `setupReplitAIIntegrations`
call. Once those two env vars exist, everything else is fully automated.

### Available models

| Model                | Use                                            |
| -------------------- | ---------------------------------------------- |
| `claude-sonnet-4-6`  | **Default** — balanced reasoning + speed       |
| `claude-opus-4-7`    | Most capable, slowest                          |
| `claude-haiku-4-5`   | Fastest, cheapest                              |

Change in `artifacts/api-server/src/routes/anthropic/messages.ts`.

### Workflows (auto-start once deps are installed)

- `artifacts/api-server: API Server` → `:8080`, mounted at `/api`
- `artifacts/coding-agent: web` → `:5000`, mounted at `/`
