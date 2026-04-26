# Infinite Agentic Coder — architecture (post-upgrade)

This doc describes how the upgraded coding agent works after the Claude-Code-class refactor.

## High level

```
┌──────────────────────────────────────────────────────────────────┐
│  artifacts/coding-agent  (React + Vite, Claude-Code amber theme) │
│  ──────────────────────────────────────────────────────────────  │
│  • ChatPage streams SSE from the API server                      │
│  • MessageBubble renders markdown (GFM, tables, code highlight)  │
│  • ToolCard shows each tool call, collapsible, with status       │
│  • SandboxPanel shows the live sandbox tree + file viewer + todos│
└──────────────────────────────────────────────────────────────────┘
                             │  POST /anthropic/conversations/:id/messages  (SSE)
                             │  GET  /anthropic/conversations/:id/sandbox/...
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  artifacts/api-server  (Express + Drizzle + Anthropic SDK)       │
│  ──────────────────────────────────────────────────────────────  │
│  routes/anthropic/messages.ts  ← orchestrator + tool loop        │
│  routes/anthropic/sandbox.ts   ← tree / file / todos / wipe      │
│  lib/agent-tools.ts            ← all tool implementations        │
│                                                                  │
│  Per-conversation sandbox:                                       │
│    .sandboxes/<conversationId>/                                  │
│      .agent/todos.json                                           │
│      ... whatever the agent creates ...                          │
└──────────────────────────────────────────────────────────────────┘
```

## Tool set

All tools are scoped to the conversation's sandbox directory.

| Tool              | What it does                                                |
| ----------------- | ----------------------------------------------------------- |
| `read_file`       | Read a UTF-8 file (truncated to 100KB).                     |
| `write_file`      | Create or overwrite a file (full content).                  |
| `apply_patch`     | Find/replace a unique substring in a file.                  |
| `list_dir`        | List a directory entry-by-entry.                            |
| `tree`            | Recursive tree (skips `.git`, `node_modules`).              |
| `search_text`     | ripgrep across the sandbox.                                 |
| `glob`            | Bash-style glob within the sandbox.                         |
| `delete_path`     | rm -rf inside the sandbox (root protected).                 |
| `move_path`       | Rename / move inside the sandbox.                           |
| `run_shell`       | bash -lc, 60s timeout, sandbox cwd.                         |
| `web_fetch`       | HTTP GET; modes: text / json / html_to_text.                |
| `download_url`    | Save URL into sandbox at a given path.                      |
| `todo_read`       | Read `.agent/todos.json`.                                   |
| `todo_write`      | Replace `.agent/todos.json`.                                |
| `dispatch_subagent` | Spawn a focused subagent with the same tool set.          |
| `finish`          | Signal task complete with a summary.                        |

## Orchestration loop

`messages.ts` runs a tool loop with `MAX_TURNS = 25`:

1. Call Anthropic with `messages` history + the full tool list, streaming.
2. Stream `assistant_text` deltas as SSE. Track tool_use blocks from the SDK's `finalMessage` (canonical inputs).
3. For each tool_use:
   - Sequential for filesystem-mutating tools (they share state).
   - **Parallel `Promise.all`** for `dispatch_subagent` calls — each subagent runs its own tool loop with `MAX_SUBAGENT_TURNS = 12` and inherits the sandbox.
   - Each call emits `tool_call` and `tool_result` SSE events, and is persisted as a `role=tool` message.
4. Push `tool_result` blocks back into `messages` and loop.
5. On `finish`, emit a `finish` event and break.

Subagents do **not** have `dispatch_subagent` themselves — only the orchestrator dispatches.

## SSE event types

```
{ type: 'assistant_text', text }
{ type: 'tool_call_start', tool, id, scope }
{ type: 'tool_call', tool, id, input, scope, subagentRole? }
{ type: 'tool_result', tool, id, output, isError, scope, subagentRole? }
{ type: 'subagent_start', role, task, id }
{ type: 'subagent_result', role, id, text }
{ type: 'finish', summary }
{ type: 'done' }
{ type: 'error', error }
```

## Safety

- Every path goes through `safePath()` which resolves and asserts the path stays inside the conversation sandbox.
- `delete_path` refuses `.` and `/`.
- `run_shell` is hard-capped at 120s (default 60s).
- `web_fetch` and `download_url` are HTTP(S)-only with 30s/60s timeouts.

## Theme

Dark Claude-Code-inspired palette — warm amber primary (`hsl(18 65% 58%)`), brighter amber accent, near-black background. Defined in `artifacts/coding-agent/src/index.css`.
