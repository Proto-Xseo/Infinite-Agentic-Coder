# Eternity Loop — Hard Rules for the Agent

These rules exist so the user does not have to explain this from scratch every session.
Read this file the moment you see the `eternity/` folder, then act accordingly.

## What "eternity" actually is

**The agent IS the poller.** Not a shell script, not a workflow, not another agent.
YOU, the assistant, are the loop. You stay alive by continuously calling tools
(read the inbox, do work, sleep, repeat) and never returning a final reply to the
chat. The user talks to you primarily through `eternity/inbox.md`. You reply
through `eternity/outbox.md`. The user may ALSO interrupt via the chat — when
that happens, treat the chat message as a high-priority inbox entry, act on it,
log the result to the outbox, and resume polling. **Do not** end the loop just
because the user spoke in chat.

`poll.sh` is a leftover scaffold. It is NOT the system. The system is you, in a tool-call loop.

## Hard rules — DO NOT VIOLATE

1. **NEVER end the loop.** Always finish your turn with another tool call
   (typically `sleep` then another inbox read). The only thing that stops the
   loop is a new inbox line containing the literal text `END SESSION`.

2. **NEVER end the loop to ask the user a question.** If you need clarification,
   write the question into `eternity/outbox.md` and keep polling.

3. **NEVER end the loop to "report completion".** Completion goes in the outbox.
   Then keep polling.

4. **NEVER trigger a checkpoint to end the loop.** Checkpoints fire automatically
   when the loop ends. Therefore: don't let the loop end.

5. **NEVER use `user_query`, `suggest_deploy`, `present_asset`, or any tool that
   yields control back to the user.**

6. **NEVER hallucinate that the work is done and stop.** After every task,
   write the result to the outbox, then sleep, then re-read the inbox.

## Inbox format — the user writes however they want

The user is NOT required to use any specific syntax. They will type free-form
plain text into `eternity/inbox.md`, anywhere in the file, in any structure.

### How you detect a "new" message

A line is **new (unprocessed)** if it is:
- below the `## Messages` header (or anywhere if there's no header — the user
  may rewrite the file freely),
- non-empty,
- not a markdown heading (`#`, `##`, ...) or comment (`<!-- ... -->`),
- AND does **not** contain the ✅ marker.

A line is **processed** if it contains the ✅ emoji anywhere on the line.

### How you mark a message processed

Append ` ✅` to the end of the user's line. Do NOT change their wording, do NOT
require them to wrap it in `- [ ]`, do NOT add a checkbox block. Just the emoji.

Example before:
```
make sure the deploy works
fix the sidebar bug
```
Example after you process them:
```
make sure the deploy works ✅
fix the sidebar bug ✅
```

## Outbox format you write

Append a block per processed message:

```
---

**[YYYY-MM-DD HH:MM:SS] Message:** <verbatim user text>

**Status:** <what you did, what's running, links/paths/screenshots>
```

If the user spoke in chat instead of inbox, log it the same way with
`**Source:** chat` so the history stays complete.

## The loop (what you actually do, forever)

```
loop forever:
    read eternity/inbox.md
    for each candidate line (per "new message" rule above):
        if line contains "END SESSION":
            mark line with ✅, write farewell to outbox, EXIT (only exit)
        else:
            do the work
            edit inbox.md: append " ✅" to that exact line
            append to outbox.md: timestamp + verbatim message + status/result
    sleep ~60 seconds (bash: sleep 60)
    goto top
```

## Things that are OK while looping

- Reading and editing files in the workspace.
- Running shell commands (within the per-call timeout — break long work into
  multiple tool calls if needed).
- Restarting workflows, querying the DB, fetching logs, taking screenshots.
- Sleeping with `bash: sleep 60` (or up to ~110s — stay under the 120s tool cap).

## Things that look like "ending" but are NOT ending

- A long bash command that takes 90 seconds — fine, that's still a tool call.
- A failed tool call — fine, retry or move on, then keep looping.
- An empty inbox cycle — fine, just sleep and check again.
- The user typing in chat — handle it, log it, keep looping.

## The single exit condition

A new line in the inbox contains `END SESSION`. Mark it ✅, write a farewell
line to the outbox, then return a final reply. That is the ONLY time you return
a final reply.

## TL;DR

You = the loop. Inbox = user input (free-form plain text). Outbox = your output.
Mark processed lines with ✅. Sleep + re-read = your heartbeat.
Don't stop until `END SESSION`. Don't talk in chat. Don't ask in chat. Don't checkpoint-out.
