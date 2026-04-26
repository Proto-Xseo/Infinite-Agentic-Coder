# Setup — making this project work on a fresh Replit account

This project uses Anthropic's Claude through the **Replit AI Integrations proxy**.
You do **not** need an Anthropic API key of your own — Replit provisions and
bills for the connection. The only thing required on a new account is a one-time
provision of the integration.

## The seamless path (one chat message to the agent)

Open the Replit AI chat in this workspace and say:

> set up the Anthropic integration

That's it. The agent runs `setupReplitAIIntegrations({ integrations: ["anthropic"] })`
and the platform sets these env vars automatically:

- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`

Then restart the **API Server** workflow and you're done.

## Agent-facing instructions (read this first if you are an agent)

If `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` or `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
is missing, run the following from the code execution sandbox:

```js
await setupReplitAIIntegrations({ integrations: ["anthropic"] });
```

Then restart the `API Server` workflow. Do not ask the user for an API key —
this project deliberately does NOT support a user-supplied `ANTHROPIC_API_KEY`.
The only supported credential source is the Replit proxy.

## Why no fallback to a user API key

Earlier the client supported `ANTHROPIC_API_KEY` as a fallback. That was removed
on purpose: the user wants the Replit proxy to be the single source of truth so
billing stays on Replit and there's nothing to copy/paste between accounts.
Don't reintroduce the fallback.

## After cloning / forking on a new account, the full flow

1. `pnpm install`
2. Tell the agent: "set up the Anthropic integration" (or run the JS snippet
   above yourself if you are the agent).
3. `pnpm --filter @workspace/db run push` (creates the `conversations` and
   `messages` tables).
4. Make sure `SESSION_SECRET` is set as a secret (any random string works).
5. Start the workflows. The platform should auto-start them based on
   `artifact.toml` files in `artifacts/*/.replit-artifact/`.

## Other env vars this project uses

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection (Replit auto-sets this) |
| `SESSION_SECRET` | yes | Express session secret |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | yes | Set by `setupReplitAIIntegrations` |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY`  | yes | Set by `setupReplitAIIntegrations` |
| `PORT` | per-workflow | Service port (set by workflow / artifact.toml) |
| `BASE_PATH` | per-workflow | Path prefix for the artifact |
| `AGENT_SANDBOX_BASE` | optional | Per-conversation sandbox dir (default `.sandboxes`) |

## Troubleshooting

- **API Server crashes on boot with "Anthropic AI integration is not provisioned"**
  → run the one-step provision above.
- **Anthropic calls return 401** → the integration was deprovisioned; re-run the
  one-step provision and restart the API Server.
- **Switched accounts and nothing works** → that's expected. The Replit
  integration is per-workspace, not per-codebase. Re-run the one-step provision
  on the new account. No other manual config is needed.
