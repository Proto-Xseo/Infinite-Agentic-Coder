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
const MAX_TURNS = 25;
const MAX_SUBAGENT_TURNS = 12;

const SANDBOX_BASE = path.resolve(
  process.cwd(),
  process.env.AGENT_SANDBOX_BASE || ".sandboxes",
);

function sandboxRootFor(convId: number): string {
  return path.join(SANDBOX_BASE, String(convId));
}

const ORCHESTRATOR_SYSTEM = `You are a senior coding agent operating inside a Linux sandbox dedicated to this conversation. The sandbox is your working directory — every read_file, write_file, list_dir, run_shell, etc. is scoped to it.

Working style:
- Always start by exploring with \`tree\` or \`list_dir\` if the project is not empty.
- Plan briefly, then act. Prefer many small, focused tool calls over one giant one. Iterate.
- Use \`run_shell\` freely for installs (npm, pip, pnpm), tests, builds, git, anything else inside the sandbox. The sandbox is yours; experiment.
- For larger or independent chunks of work, call \`dispatch_subagent\` with a focused role and a self-contained task. Subagents have the same toolset.
- When code is written, verify it: build, test, or at minimum read it back. Iterate on failures.
- When the user's request is fully done, call \`finish\` with a short summary. Do not call \`finish\` until the work is real and verified.

Output style:
- Keep narrative messages concise. Tools do the work; words explain intent.
- When showing files or commands inline, prefer fenced code blocks with a language tag.
- Never fabricate — if a command failed, say so and try a different approach.`;

const SUBAGENT_SYSTEM = (role: string) =>
  `You are a focused subagent acting as: ${role}. You work inside the same sandbox as the orchestrator and have the full agent toolset (read_file, write_file, apply_patch, list_dir, tree, search_text, run_shell). Do exactly the task you were given, verify your work with shell or file reads when relevant, and call \`finish\` with a short result summary when done. Do NOT call dispatch_subagent — only the orchestrator dispatches.`;

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
      max_tokens: 8192,
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

  const ctx = { sandboxRoot: sandboxRootFor(id) };
  await ensureSandbox(ctx);

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.id));

  const apiMessages: ApiMsg[] = [];
  for (const m of history) {
    if (m.role === "user") {
      apiMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      apiMessages.push({ role: "assistant", content: m.content });
    } else if (m.role === "subagent") {
      apiMessages.push({
        role: "assistant",
        content: `[subagent result captured earlier]\n${m.content}`,
      });
    } else if (m.role === "tool") {
      apiMessages.push({
        role: "assistant",
        content: `[tool call captured earlier]\n${m.content}`,
      });
    }
  }

  try {
    let assistantTextSoFar = "";
    let didFinish = false;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = anthropic.messages.stream({
        model: ORCHESTRATOR_MODEL,
        max_tokens: 8192,
        system: ORCHESTRATOR_SYSTEM,
        tools: AGENT_TOOLS,
        messages: apiMessages as never,
      });

      let turnText = "";

      for await (const rawEvent of stream as AsyncIterable<unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = rawEvent as any;
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "tool_use") {
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
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      // Use the SDK's canonical tool_use blocks so input parsing matches what we send back.
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

      // Split: finish/regular tools run sequentially (they share the sandbox);
      // subagent dispatches run in parallel since each subagent has its own conversation.
      const subagentCalls = toolUses.filter((c) => c.name === "dispatch_subagent");
      const otherCalls = toolUses.filter((c) => c.name !== "dispatch_subagent");

      for (const call of otherCalls) {
        if (call.name === "finish") {
          const summary = String(call.input.summary ?? "(no summary)");
          send(res, { type: "finish", summary });
          await db.insert(messages).values({
            conversationId: id,
            role: "assistant",
            content: summary,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: "ok",
          });
          didFinish = true;
          continue;
        }

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
          output: out,
          isError,
        });

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

      apiMessages.push({ role: "user", content: toolResults });

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
