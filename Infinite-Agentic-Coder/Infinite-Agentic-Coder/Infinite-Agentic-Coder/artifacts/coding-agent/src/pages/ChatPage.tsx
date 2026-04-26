import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import {
  useGetAnthropicConversation,
  getGetAnthropicConversationQueryKey,
  getListAnthropicConversationsQueryKey,
  createAnthropicConversation,
} from "@workspace/api-client-react";
import { ConversationSidebar } from "../components/ConversationSidebar";
import { MessageBubble, type Role } from "../components/MessageBubble";
import { ToolCard } from "../components/ToolCard";
import { ChatInput } from "../components/ChatInput";
import { SandboxPanel } from "../components/SandboxPanel";
import { apiUrl } from "../lib/api-base";
import { toast } from "sonner";

type StreamItem =
  | { kind: "message"; role: Role; text: string; subagentTask?: string; subagentRole?: string }
  | {
      kind: "tool";
      id: string;
      tool: string;
      input?: Record<string, unknown>;
      output?: string;
      status: "running" | "done" | "error";
      scope?: "orchestrator" | "subagent";
      subagentRole?: string;
    };

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const conversationId = params.id ? Number(params.id) : null;

  const { data: conversation } = useGetAnthropicConversation(
    conversationId ?? 0,
    {
      query: {
        enabled: conversationId !== null,
        queryKey: getGetAnthropicConversationQueryKey(conversationId ?? 0),
      },
    },
  );

  const [streaming, setStreaming] = useState(false);
  const [liveItems, setLiveItems] = useState<StreamItem[]>([]);
  const [sandboxRefresh, setSandboxRefresh] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLiveItems([]);
    setStreaming(false);
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation?.messages, liveItems]);

  const persistedItems = useMemo<StreamItem[]>(() => {
    const msgs = conversation?.messages ?? [];
    return msgs.map((m): StreamItem => {
      if (m.role === "subagent") {
        const match = /^\[subagent:([^\]]+)\]\s*([\s\S]*)$/.exec(m.content);
        if (match) {
          return {
            kind: "message",
            role: "subagent",
            text: match[2],
            subagentRole: match[1],
            subagentTask: match[1],
          };
        }
        return { kind: "message", role: "subagent", text: m.content };
      }
      if (m.role === "tool") {
        // [name] {input}\n---\noutput
        const match = /^\[([^\]]+)\]\s*(\{[\s\S]*?\})\n---\n([\s\S]*)$/.exec(m.content);
        if (match) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(match[2]);
          } catch {
            input = {};
          }
          return {
            kind: "tool",
            id: `persisted-${m.id}`,
            tool: match[1],
            input,
            output: match[3],
            status: "done",
            scope: "orchestrator",
          };
        }
        return {
          kind: "tool",
          id: `persisted-${m.id}`,
          tool: "tool",
          output: m.content,
          status: "done",
        };
      }
      return { kind: "message", role: m.role as Role, text: m.content };
    });
  }, [conversation?.messages]);

  const allItems = useMemo(() => [...persistedItems, ...liveItems], [persistedItems, liveItems]);

  const handleSend = async (text: string) => {
    let activeId = conversationId;
    if (!activeId) {
      try {
        const created = await createAnthropicConversation({ title: text.slice(0, 60) });
        activeId = created.id;
        qc.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        navigate(`/c/${activeId}`);
      } catch {
        toast.error("Could not start a new chat");
        return;
      }
    }

    setStreaming(true);
    setLiveItems([
      { kind: "message", role: "user", text },
      { kind: "message", role: "assistant", text: "" },
    ]);

    let assistantBuf = "";
    let aborted = false;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(apiUrl(`/anthropic/conversations/${activeId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(json);
          } catch {
            continue;
          }
          handleEvent(evt);
        }
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!aborted && !isAbort) {
        toast.error("Stream interrupted");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (activeId) {
        await qc.invalidateQueries({
          queryKey: getGetAnthropicConversationQueryKey(activeId),
        });
        await qc.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
      }
      setLiveItems([]);
    }

    function startNewAssistantBubble() {
      assistantBuf = "";
      setLiveItems((prev) => [...prev, { kind: "message", role: "assistant", text: "" }]);
    }

    function handleEvent(evt: Record<string, unknown>) {
      const type = evt.type as string;
      if (type === "assistant_text") {
        assistantBuf += String(evt.text ?? "");
        setLiveItems((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const it = next[i];
            if (it.kind === "message" && it.role === "assistant") {
              next[i] = { ...it, text: assistantBuf };
              return next;
            }
            if (it.kind !== "message") break;
          }
          next.push({ kind: "message", role: "assistant", text: assistantBuf });
          return next;
        });
      } else if (type === "tool_call_start") {
        // ignore — we wait for tool_call which has full input
      } else if (type === "tool_call") {
        const id = String(evt.id ?? Math.random());
        setLiveItems((prev) => [
          ...prev,
          {
            kind: "tool",
            id,
            tool: String(evt.tool ?? "tool"),
            input: (evt.input as Record<string, unknown>) ?? {},
            status: "running",
            scope: (evt.scope as "orchestrator" | "subagent") ?? "orchestrator",
            subagentRole: evt.subagentRole as string | undefined,
          },
        ]);
      } else if (type === "tool_result") {
        const id = String(evt.id ?? "");
        setLiveItems((prev) =>
          prev.map((it) =>
            it.kind === "tool" && it.id === id
              ? {
                  ...it,
                  output: String(evt.output ?? ""),
                  status: evt.isError ? "error" : "done",
                }
              : it,
          ),
        );
        // refresh sandbox panel after any tool that may mutate the filesystem
        const t = String(evt.tool ?? "");
        if (
          t === "write_file" ||
          t === "apply_patch" ||
          t === "delete_path" ||
          t === "move_path" ||
          t === "download_url" ||
          t === "run_shell" ||
          t === "todo_write"
        ) {
          setSandboxRefresh((v) => v + 1);
        }
        startNewAssistantBubble();
      } else if (type === "subagent_start") {
        const id = String(evt.id ?? Math.random());
        setLiveItems((prev) => [
          ...prev,
          {
            kind: "tool",
            id,
            tool: "dispatch_subagent",
            input: { role: String(evt.role ?? ""), task: String(evt.task ?? "") },
            status: "running",
            scope: "orchestrator",
          },
          {
            kind: "message",
            role: "subagent",
            text: "",
            subagentTask: String(evt.role ?? "task"),
            subagentRole: String(evt.role ?? ""),
          },
        ]);
      } else if (type === "subagent_result") {
        const result = String(evt.text ?? "");
        const subId = String(evt.id ?? "");
        setLiveItems((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const it = next[i];
            if (it.kind === "tool" && it.id === subId) {
              next[i] = { ...it, status: "done", output: result };
              break;
            }
          }
          for (let i = next.length - 1; i >= 0; i--) {
            const it = next[i];
            if (it.kind === "message" && it.role === "subagent" && !it.text) {
              next[i] = { ...it, text: result };
              break;
            }
          }
          return next;
        });
        startNewAssistantBubble();
      } else if (type === "finish") {
        const summary = String(evt.summary ?? "");
        if (summary) {
          setLiveItems((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              const it = next[i];
              if (it.kind === "message" && it.role === "assistant") {
                next[i] = { ...it, text: it.text ? it.text + "\n\n" + summary : summary };
                return next;
              }
            }
            next.push({ kind: "message", role: "assistant", text: summary });
            return next;
          });
        }
      } else if (type === "done") {
        // finished
      } else if (type === "error") {
        aborted = true;
        toast.error(String(evt.error ?? evt.message ?? "Agent error"));
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <ConversationSidebar activeId={conversationId} />
      <main className="relative flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">
              {conversation?.title ?? (conversationId ? "Loading…" : "New chat")}
            </h1>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Agent: <span className="font-mono text-foreground/80">claude-sonnet-4-6</span>
            <span className="mx-2 text-border">•</span>
            <span className="text-foreground/60">tools: read/write/shell/grep/subagent</span>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll">
          <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
            {allItems.length === 0 ? (
              <EmptyState />
            ) : (
              allItems.map((it, i) => {
                if (it.kind === "tool") {
                  return (
                    <ToolCard
                      key={`${it.id}-${i}`}
                      tool={it.tool}
                      input={it.input}
                      output={it.output}
                      status={it.status}
                      scope={it.scope}
                      subagentRole={it.subagentRole}
                    />
                  );
                }
                if (it.kind === "message" && it.role === "assistant" && !it.text && !streaming) {
                  return null;
                }
                const isLast = i === allItems.length - 1;
                return (
                  <MessageBubble
                    key={i}
                    role={it.role}
                    text={it.text}
                    subagentTask={it.subagentTask}
                    streaming={
                      streaming && isLast && (it.role === "assistant" || it.role === "subagent")
                    }
                  />
                );
              })
            )}
          </div>
        </div>

        <ChatInput
          onSend={handleSend}
          onStop={() => abortRef.current?.abort()}
          disabled={streaming}
          placeholder={
            conversationId
              ? "Reply to the agent…"
              : "Ask the coding agent to plan, design, build, or debug…"
          }
        />
      </main>
      <SandboxPanel conversationId={conversationId} refreshKey={sandboxRefresh} />
    </div>
  );
}

function EmptyState() {
  const examples = [
    "Build a tiny Express + SQLite todo API and run the tests.",
    "Set up a Vite + React counter app with TypeScript and verify it builds.",
    "Initialize a git repo here, scaffold a Python CLI, and run --help.",
    "Write a script that fetches HN top stories and saves them to data.json.",
  ];
  const tools: Array<[string, string]> = [
    ["read_file", "read any file in the sandbox"],
    ["write_file", "create or overwrite files"],
    ["apply_patch", "targeted in-place edits"],
    ["list_dir", "list a directory"],
    ["tree", "recursive project map"],
    ["search_text", "ripgrep across files"],
    ["glob", "find files by pattern"],
    ["delete_path", "remove files / dirs"],
    ["move_path", "rename or move"],
    ["run_shell", "bash commands (60s, full freedom)"],
    ["web_fetch", "GET a URL (text/json/html→text)"],
    ["download_url", "save remote file into sandbox"],
    ["todo_read / todo_write", "plan and track multi-step work"],
    ["dispatch_subagent", "fan out parallel specialists"],
    ["finish", "wrap up with a summary"],
  ];
  return (
    <div className="mx-auto mt-10 max-w-2xl text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-border bg-primary text-primary-foreground shadow-md">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">What should we build?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Linux sandbox, real file editing, ripgrep, shell, web fetch, and parallel subagents — all
        scoped to this conversation. Iterates until it works.
      </p>
      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {examples.map((ex) => (
          <ExampleCard key={ex} text={ex} />
        ))}
      </div>
      <div className="mt-10 text-left">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tools the agent has
        </div>
        <ul className="grid gap-1 rounded-xl border border-border bg-card/40 p-3 text-[12px] sm:grid-cols-2">
          {tools.map(([name, desc]) => (
            <li key={name} className="flex items-baseline gap-2 truncate">
              <span className="font-mono text-accent">{name}</span>
              <span className="truncate text-muted-foreground">{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExampleCard({ text }: { text: string }) {
  return (
    <div className="hover-elevate cursor-default rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-card-foreground shadow-sm">
      {text}
    </div>
  );
}
