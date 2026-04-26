# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is the **Infinite Agentic Coder** — a Claude Code-style agentic coding platform.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (conversations + messages tables)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Anthropic claude-sonnet-4-6 via Replit AI Integrations proxy

## Artifacts

- **`artifacts/coding-agent`** — React/Vite frontend, port 21440, preview path `/`
  - Full Claude Code-style UI: sidebar, chat, sandbox panel, tool display, SSE streaming
  - Components: ChatPage, ConversationSidebar, MessageBubble, ToolCard, SandboxPanel, MarkdownRenderer
- **`artifacts/api-server`** — Express backend, port 8080, preview path `/api`
  - Routes: `/api/anthropic/conversations` (CRUD), `/api/anthropic/conversations/:id/messages` (SSE stream)
  - 15 agent tools: read_file, write_file, apply_patch, list_dir, tree, search_text, glob, delete_path, move_path, run_shell, web_fetch, download_url, todo_read, todo_write, dispatch_subagent, finish
  - Per-conversation sandboxes at `.sandboxes/<convId>/`
  - Orchestrator (25 turns) + Subagent (12 turns) architecture

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Eternity Inbox

- `eternity/inbox.md` — user messages to agent (polling channel)
- `eternity/outbox.md` — agent responses and results
- Format: `- [ ] message` (unchecked = unprocessed), `[x]` = processed

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
