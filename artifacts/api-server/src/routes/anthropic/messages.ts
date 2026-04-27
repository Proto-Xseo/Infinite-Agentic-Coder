import { Router, type IRouter } from "express";
import path from "node:path";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { SendAnthropicMessageBody } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AGENT_TOOLS, executeTool, ensureSandbox } from "../../lib/agent-tools";

const router: IRouter = Router();

const ORCHESTRATOR_MODEL = "claude-sonnet-4-6";
const SUBAGENT_MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 40;
const MAX_SUBAGENT_TURNS = 20;
// Bumped from 16384 → 32768 because the orchestrator prompt encourages emitting
// many write_file calls in a single response. With 16k, large/multi-file writes
// would exhaust the budget mid-`content` field, leaving the tool input JSON
// truncated. The SDK then surfaces an empty `input` and write_file rejects it
// with "content field is required", which is the symptom of "agent only patches,
// can't write new files". 32k removes the cliff for typical project scaffolds.
const ORCHESTRATOR_MAX_TOKENS = 32768;
const SUBAGENT_MAX_TOKENS = 32768;

const SANDBOX_BASE = path.resolve(
  process.cwd(),
  process.env.AGENT_SANDBOX_BASE || ".sandboxes",
);

function sandboxRootFor(convId: number): string {
  return path.join(SANDBOX_BASE, String(convId));
}

const ORCHESTRATOR_SYSTEM = `You are a senior coding agent operating inside a Linux sandbox dedicated to this conversation. The sandbox is your working directory — every read_file, write_file, list_dir, run_shell, etc. is scoped to it.

## Core working loop
1. Explore first: call \`tree\` or \`list_dir\` to understand the project.
2. Plan in one sentence, then act immediately. Do NOT ask for permission.
3. Issue MULTIPLE tool calls in a single response whenever they are independent. The system executes them all in parallel. For example, if you need to write 5 files, call write_file 5 times in the same response.
4. After tools complete, check results and issue the next batch of tool calls. Keep going until the work is genuinely done.
5. When code is written, verify it with \`run_shell\` (build, test, lint). Fix failures immediately.
6. Only call \`finish\` when everything is done and verified. Never stop early.

## Parallelism rules (critical)
- Batch ALL independent tool calls in one response — they run in parallel on the server.
- Example: to write a project, write ALL files in one response (10–20 write_file calls at once).
- Only serialize tool calls if call B depends on the output of call A.
- Never do one tool call per response when you could do ten.

## write_file rules (critical)
- ALWAYS include the FULL file content in the \`content\` field. Never write partial files.
- If a file is long, write the ENTIRE thing in one call. Never truncate.
- Never call write_file with an empty or placeholder content — the system will reject it.
- Files belong in tool calls, not in your text messages.

## dispatch_subagent
- Use for large independent chunks (write the frontend, write the backend, write the tests).
- Multiple subagent dispatches in one response run in parallel.
- Subagents have the full toolset (read/write/shell) and loop until they call finish.

## Output style
- Keep narrative text concise — tools do the work, words explain intent.
- Do NOT dump full file contents into assistant text. Use write_file instead.
- Inline snippets ≤20 lines only; bigger content goes in tool calls.
- Never fabricate tool results. If a command failed, say so and fix it.`;

const SUBAGENT_SYSTEM = (role: string) =>
  `You are a focused subagent acting as: ${role}. You work inside the same sandbox as the orchestrator.

Your working loop:
1. Explore with tree/list_dir if needed, then act immediately.
2. Issue MULTIPLE tool calls per response whenever they are independent — the system runs them in parallel.
3. Always write the FULL file content in write_file — never truncate.
4. Verify your work (run_shell build/test) and fix failures.
5. Keep looping until the task is fully complete.
6. Call finish with a summary when done. Do NOT stop early.

Do NOT call dispatch_subagent. You have: read_file, write_file, apply_patch, list_dir, tree, search_text, run_shell, glob, delete_path, move_path, web_fetch, download_url, todo_write, todo_read.`;

type SseEvent = Record<string, unknown>;

function send(res: import("express").Response, event: SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

type ApiMsg = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          }
        | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
      >;
};

const SUBAGENT_TOOLS = AGENT_TOOLS.filter((t) => t.name !== "dispatch_subagent");

async function runSubagent(
  ctx: { sandboxRoot: string },
  role: string,
  task: string,
  res: import("express").Response,
  callId: string,
): Promise<string> {
  const subMessages: ApiMsg[] = [{ role: "user", content: task }];
  let lastText = "";
  let finishSummary = "";

  for (let turn = 0; turn < MAX_SUBAGENT_TURNS; turn++) {
    const result = await anthropic.messages.create({
      model: SUBAGENT_MODEL,
      max_tokens: SUBAGENT_MAX_TOKENS,
      system: SUBAGENT_SYSTEM(role),
      tools: SUBAGENT_TOOLS,
      messages: subMessages as never,
    });

    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let turnText = "";
    for (const block of result.content) {
      if (block.type === "text") turnText += block.text;
      if (block.type === "tool_use") {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }
    if (turnText.trim()) lastText = turnText.trim();

    if (toolUses.length === 0) break;

    subMessages.push({
      role: "assistant",
      content: result.content
        .map((block) => {
          if (block.type === "text") return { type: "text" as const, text: block.text };
          if (block.type === "tool_use") {
            return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];
    let finishCalled = false;

    for (const call of toolUses) {
      if (call.name === "finish") {
        finishSummary = String(call.input.summary ?? "(no summary)");
        finishCalled = true;
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: "ok",
        });
        continue;
      }
      send(res, {
        type: "tool_call",
        scope: "subagent",
        subagentRole: role,
        subagentCallId: callId,
        tool: call.name,
        id: call.id,
        input: call.input,
      });
      let out: string;
      let isError = false;
      try {
        out = await executeTool(ctx, call.name, call.input);
      } catch (err) {
        out = err instanceof Error ? err.message : String(err);
        isError = true;
      }
      send(res, {
        type: "tool_result",
        scope: "subagent",
        subagentRole: role,
        subagentCallId: callId,
        tool: call.name,
        id: call.id,
        input: call.input,
        output: out,
        isError,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: out,
        is_error: isError,
      });
    }

    subMessages.push({ role: "user", content: toolResults });

    if (finishCalled) break;
  }

  return finishSummary || lastText || "(subagent finished without text)";
}

router.post("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SendAnthropicMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const folder = parsed.data.folder ?? "sandbox";
  // cwd is artifacts/api-server; workspace root is 2 levels up
  const PROJECT_ROOT = path.resolve(
    process.env.PROJECT_ROOT || path.resolve(process.cwd(), "../.."),
  );
  const resolvedRoot =
    folder === "project" ? PROJECT_ROOT : sandboxRootFor(id);
  const ctx = { sandboxRoot: resolvedRoot };
  if (folder !== "project") await ensureSandbox(ctx);

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.id));

  // Reconstruct only user + assistant TEXT messages for history.
  // Tool call/result pairs live within a single turn and don't need to be
  // replayed — the model already acted on them. Including them incorrectly
  // breaks the user/assistant alternation required by the Anthropic API.
  const apiMessages: ApiMsg[] = [];
  for (const m of history) {
    if (m.role === "user") {
      apiMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      // Merge consecutive assistant messages into one to avoid API errors
      if (
        apiMessages.length > 0 &&
        apiMessages[apiMessages.length - 1].role === "assistant"
      ) {
        const last = apiMessages[apiMessages.length - 1];
        last.content = `${last.content}\n${m.content}`;
      } else {
        apiMessages.push({ role: "assistant", content: m.content });
      }
    }
    // Intentionally skip role:"tool" and role:"subagent" — they were
    // within-turn interactions already consumed by the model.
  }

  // Ensure alternating user/assistant (API requirement)
  // If last message is assistant, add a placeholder user message so we can append the new one.
  // (The new user message was already inserted above as the last DB row, so it should be last.)

  try {
    let assistantTextSoFar = "";
    let didFinish = false;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = anthropic.messages.stream({
        model: ORCHESTRATOR_MODEL,
        max_tokens: ORCHESTRATOR_MAX_TOKENS,
        system:
          folder === "project"
            ? ORCHESTRATOR_SYSTEM +
              `\n\n## IMPORTANT: Working on the REAL project\nYou are operating directly on the user's actual Replit project at: ${PROJECT_ROOT}\nThis is NOT an isolated sandbox — changes are real and permanent. Be careful with deletions. The user chose "Project root" mode intentionally.`
            : ORCHESTRATOR_SYSTEM,
        tools: AGENT_TOOLS,
        messages: apiMessages as never,
      });

      let turnText = "";

      // Maps streaming block index → { id, name } for tool_use blocks
      const blockMeta: Record<number, { id: string; name: string }> = {};
      // Accumulate partial JSON per block index for tool inputs
      const partialInputs: Record<number, string> = {};

      for await (const rawEvent of stream as AsyncIterable<unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = rawEvent as any;

        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "tool_use") {
            blockMeta[event.index] = { id: block.id, name: block.name };
            partialInputs[event.index] = "";
            send(res, {
              type: "tool_call_start",
              tool: block.name,
              id: block.id,
              scope: "orchestrator",
            });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            turnText += event.delta.text;
            assistantTextSoFar += event.delta.text;
            send(res, { type: "assistant_text", text: event.delta.text });
          } else if (event.delta.type === "input_json_delta") {
            // Stream partial tool input — lets frontend show live write progress
            const meta = blockMeta[event.index];
            if (meta) {
              partialInputs[event.index] = (partialInputs[event.index] ?? "") + event.delta.partial_json;
              send(res, {
                type: "tool_input_delta",
                id: meta.id,
                tool: meta.name,
                partial_json: event.delta.partial_json,
                accumulated_json: partialInputs[event.index],
              });
            }
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      const toolUses: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = finalMessage.content
        .filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          name: b.name,
          input: (b.input ?? {}) as Record<string, unknown>,
        }));

      if (turnText.trim().length > 0) {
        await db.insert(messages).values({
          conversationId: id,
          role: "assistant",
          content: turnText,
        });
      }

      if (toolUses.length === 0) break;

      apiMessages.push({
        role: "assistant",
        content: finalMessage.content
          .map((block) => {
            if (block.type === "text") {
              return { type: "text" as const, text: block.text };
            }
            if (block.type === "tool_use") {
              return {
                type: "tool_use" as const,
                id: block.id,
                name: block.name,
                input: block.input as Record<string, unknown>,
              };
            }
            return null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      // Separate finish / regular / subagent calls
      const finishCalls = toolUses.filter((c) => c.name === "finish");
      const regularCalls = toolUses.filter(
        (c) => c.name !== "finish" && c.name !== "dispatch_subagent",
      );
      const subagentCalls = toolUses.filter((c) => c.name === "dispatch_subagent");

      // Handle finish
      for (const call of finishCalls) {
        const summary = String(call.input.summary ?? "(no summary)");
        send(res, { type: "finish", summary });
        await db.insert(messages).values({
          conversationId: id,
          role: "assistant",
          content: summary,
        });
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: "ok" });
        didFinish = true;
      }

      // Run ALL regular tool calls in parallel — no sequential blocking
      const regularResults = await Promise.all(
        regularCalls.map(async (call) => {
          send(res, {
            type: "tool_call",
            scope: "orchestrator",
            tool: call.name,
            id: call.id,
            input: call.input,
          });
          let out: string;
          let isError = false;
          try {
            out = await executeTool(ctx, call.name, call.input);
          } catch (err) {
            out = err instanceof Error ? err.message : String(err);
            isError = true;
          }
          send(res, {
            type: "tool_result",
            scope: "orchestrator",
            tool: call.name,
            id: call.id,
            input: call.input,
            output: out,
            isError,
          });
          return { call, out, isError };
        }),
      );

      for (const { call, out, isError } of regularResults) {
        await db.insert(messages).values({
          conversationId: id,
          role: "tool",
          content: `[${call.name}] ${JSON.stringify(call.input)}\n---\n${out}`,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: out,
          is_error: isError,
        });
      }

      // Run subagent calls in parallel
      if (subagentCalls.length > 0) {
        const settled = await Promise.all(
          subagentCalls.map(async (call) => {
            const role = String(call.input["role"] ?? "specialist");
            const task = String(call.input["task"] ?? "");
            send(res, { type: "subagent_start", role, task, id: call.id });
            try {
              const subResult = await runSubagent(ctx, role, task, res, call.id);
              return { call, role, subResult, isError: false };
            } catch (err) {
              return {
                call,
                role,
                subResult: `Subagent error: ${err instanceof Error ? err.message : String(err)}`,
                isError: true,
              };
            }
          }),
        );

        for (const { call, role, subResult, isError } of settled) {
          send(res, {
            type: "subagent_result",
            role,
            id: call.id,
            text: subResult,
          });
          await db.insert(messages).values({
            conversationId: id,
            role: "subagent",
            content: `[subagent:${role}]\n${subResult}`,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: subResult,
            is_error: isError,
          });
        }
      }

      if (toolResults.length > 0) {
        apiMessages.push({ role: "user", content: toolResults });
      }

      if (didFinish) break;
    }

    if (assistantTextSoFar.trim().length === 0 && !didFinish) {
      send(res, {
        type: "assistant_text",
        text: "(orchestrator finished without final text)",
      });
    }

    send(res, { type: "done" });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Orchestrator error");
    send(res, {
      type: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    res.end();
  }
});

export default router;
