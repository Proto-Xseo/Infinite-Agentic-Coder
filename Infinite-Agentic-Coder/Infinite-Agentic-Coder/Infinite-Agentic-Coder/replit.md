# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **API Server** (`artifacts/api-server`) — Express backend. Mounts `/api/anthropic` for Claude orchestrator + subagent endpoints (conversations CRUD, SSE streaming on `POST /conversations/:id/messages`).
- **Coding Agent** (`artifacts/coding-agent`) — React + Vite chat UI (Lovable/Replit-style). Uses generated `@workspace/api-client-react` hooks for conversations and raw `fetch` for SSE message streaming. Routes: `/` (new chat), `/c/:id` (existing chat).
- **Canvas / Mockup Sandbox** (`artifacts/mockup-sandbox`) — design preview server.

## Coding Agent Architecture

- Anthropic access goes through Replit's built-in AI integration (`@workspace/integrations-anthropic-ai`). No user-supplied API key.
- Orchestrator model: `claude-sonnet-4-6`, `max_tokens` 8192, tool-use loop with `MAX_TURNS=8`.
- Single tool: `dispatch_subagent({ role, task })`. Each call spawns a fresh Claude completion (no streaming) and the result is fed back into the orchestrator turn.
- All messages persist in the `messages` table with role `user | assistant | subagent`. Subagent messages are stored as `[subagent:<role>] <result>` and re-projected into the API context as assistant turns when rebuilding history.
- SSE event types from `POST /api/anthropic/conversations/:id/messages`: `assistant_text`, `tool_call_start`, `subagent_start`, `subagent_result`, `done`, `error`.

## INBOX Loop

`INBOX.md` at repo root is the persistent task channel. Lines beginning with `✓` are skipped; unmarked lines are acted on and prepended with `✓ ` once handled. Agent follow-up questions are written back to the inbox as `✓ AGENT: …` so the loop never blocks on a popup.
