import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { PanelLeft } from "lucide-react";
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
import { useListAnthropicConversations } from "@workspace/api-client-react";
import {
  MessageSquare,
  Sparkles,
  PanelRight,
  Pencil,
  GraduationCap,
  Code2,
  Coffee,
  Wand2,
  Bug,
  TestTube,
  FileText as FileIcon,
} from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("coding-agent.sidebarWidth"));
    return Number.isFinite(v) && v >= 200 && v <= 480 ? v : 256;
  });
  const [contentWidth, setContentWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("coding-agent.contentWidth"));
    return Number.isFinite(v) && v >= 260 && v <= 720 ? v : 360;
  });
  useEffect(() => {
    localStorage.setItem("coding-agent.sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem("coding-agent.contentWidth", String(contentWidth));
  }, [contentWidth]);
  const [focusFile, setFocusFile] = useState<string | null>(null);

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
  const isEmpty = allItems.length === 0;

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
        // Auto-focus the right Content panel on the file the agent just touched
        if (t === "write_file" || t === "apply_patch" || t === "read_file") {
          const findInput = (() => {
            const cur = (evt.input as Record<string, unknown> | undefined) ?? {};
            return (cur.path as string) ?? (cur.file as string) ?? "";
          })();
          if (findInput) setFocusFile(findInput);
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

  const onExample = (text: string) => handleSend(text);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen ? (
        <>
          <ConversationSidebar
            activeId={conversationId}
            onClose={() => setSidebarOpen(false)}
            width={sidebarWidth}
          />
          <ResizeHandle
            onResize={(dx) =>
              setSidebarWidth((w) => Math.min(480, Math.max(200, w + dx)))
            }
            title="Drag to resize sidebar"
          />
        </>
      ) : null}
      <main className="relative flex flex-1 flex-col dotted-bg">
        {/* Window-chrome style title bar */}
        <header className="relative flex h-9 shrink-0 items-center border-b border-border/60 bg-background/40 backdrop-blur">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hover-elevate active-elevate-2 absolute left-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition"
            aria-label="Toggle sidebar"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex w-full items-center justify-center text-[11px] font-medium tracking-wide text-muted-foreground">
            Claude Code — {conversation?.title ?? (conversationId ? "Loading…" : "New chat")}
          </div>
          {!contentOpen ? (
            <button
              onClick={() => setContentOpen(true)}
              className="hover-elevate active-elevate-2 absolute right-2 hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition lg:flex"
              aria-label="Show content panel"
              title="Show content panel"
            >
              <PanelRight className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        {isEmpty ? (
          <EmptyHero disabled={streaming} onSend={handleSend} onExample={onExample} onStop={() => abortRef.current?.abort()} />
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll">
              <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
                {allItems.map((it, i) => {
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
                })}
              </div>
            </div>

            <ChatInput
              onSend={handleSend}
              onStop={() => abortRef.current?.abort()}
              disabled={streaming}
              placeholder={
                conversationId
                  ? "Reply to the agent…"
                  : "Find a small todo in the codebase and do it"
              }
            />
          </>
        )}
      </main>
      {contentOpen ? (
        <>
          <ResizeHandle
            onResize={(dx) =>
              setContentWidth((w) => Math.min(720, Math.max(260, w - dx)))
            }
            title="Drag to resize content panel"
          />
          <SandboxPanel
            conversationId={conversationId}
            refreshKey={sandboxRefresh}
            onClose={() => setContentOpen(false)}
            width={contentWidth}
            focusFile={focusFile}
          />
        </>
      ) : null}
    </div>
  );
}

function ResizeHandle({
  onResize,
  title,
}: {
  onResize: (dx: number) => void;
  title?: string;
}) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    let last = 0;
    let pending = 0;
    let raf = 0;
    const flush = () => {
      raf = 0;
      if (pending !== 0) {
        onResize(pending);
        pending = 0;
      }
    };
    const onMove = (e: MouseEvent) => {
      if (last === 0) {
        last = e.clientX;
        return;
      }
      const dx = e.clientX - last;
      last = e.clientX;
      pending += dx;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onUp = () => setDragging(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, onResize]);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      className={`group relative h-full w-1.5 shrink-0 cursor-col-resize transition ${
        dragging ? "bg-primary/30" : "hover:bg-primary/15"
      }`}
    >
      <span
        className={`pointer-events-none absolute left-1/2 top-1/2 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${
          dragging ? "w-1 bg-primary" : "w-0.5 bg-border group-hover:bg-primary/60"
        }`}
      />
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

function EmptyHero({
  disabled,
  onSend,
  onExample,
  onStop,
}: {
  disabled?: boolean;
  onSend: (t: string) => void;
  onExample: (t: string) => void;
  onStop?: () => void;
}) {
  const [, navigate] = useLocation();
  const { data: convs } = useListAnthropicConversations();
  const recentsRaw = Array.isArray(convs)
    ? convs
    : Array.isArray((convs as { items?: unknown })?.items)
      ? ((convs as { items: Array<{ id: number; title: string; updatedAt?: string; createdAt?: string }> }).items)
      : [];
  const recents = recentsRaw.slice(0, 6);

  const examples: Array<{ before: string; pill: string; after: string }> = [
    { before: "Create or update my ", pill: "CLAUDE.MD", after: " file" },
    { before: "Search for a ", pill: "TODO", after: " comment and fix it" },
    { before: "Recommend areas to improve our ", pill: "tests", after: "" },
  ];

  return (
    <div className="flex-1 overflow-y-auto nice-scroll">
      <div className="mx-auto w-full max-w-3xl px-6 pt-20 pb-12">
        {/* Plan badge */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
            <span>Free plan</span>
            <span className="opacity-50">·</span>
            <span className="text-foreground/85">Replit AI · Anthropic proxy</span>
          </div>
        </div>

        {/* Hero — sparkle + greeting */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" strokeWidth={2.2} />
          <h1 className="text-[26px] font-medium tracking-tight text-foreground">
            {greeting()}
          </h1>
        </div>

        <ChatInput
          large
          showHeader
          disabled={disabled}
          onSend={onSend}
          onStop={onStop}
          placeholder="How can I help you today?"
        />

        {/* Quick action chips, like Claude.com's Write / Learn / Code row */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: Pencil, label: "Write", prompt: "Write a CLAUDE.MD file describing this project" },
            { icon: GraduationCap, label: "Learn", prompt: "Explain how this codebase is organized" },
            { icon: Code2, label: "Code", prompt: "Find a small todo in the codebase and do it" },
            { icon: Bug, label: "Debug", prompt: "Run the project, surface any errors and fix them" },
            { icon: TestTube, label: "Test", prompt: "Recommend areas to improve our tests" },
            { icon: Wand2, label: "Refactor", prompt: "Suggest one focused refactor that improves clarity" },
            { icon: Coffee, label: "Life stuff", prompt: "Take a break — write me a haiku about debugging" },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => onExample(chip.prompt)}
              disabled={disabled}
              className="hover-elevate active-elevate-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12.5px] text-foreground/85 backdrop-blur transition disabled:opacity-50"
            >
              <chip.icon className="h-3.5 w-3.5 text-primary/80" strokeWidth={2.1} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          {examples.map((ex) => {
            const full = `${ex.before}${ex.pill}${ex.after}`;
            return (
              <button
                key={full}
                onClick={() => onExample(full)}
                disabled={disabled}
                className="hover-elevate active-elevate-2 group rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/40 px-4 py-3.5 text-left text-[13px] text-card-foreground shadow-sm backdrop-blur transition disabled:opacity-50"
              >
                <span className="text-foreground/80">{ex.before}</span>
                <span className="mx-0.5 rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] text-accent ring-1 ring-accent/20">
                  {ex.pill}
                </span>
                <span className="text-foreground/80">{ex.after}</span>
              </button>
            );
          })}
        </div>

        {recents.length > 0 ? (
          <div className="mt-12">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Your recent chats
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/c/${c.id}`)}
                  className="hover-elevate active-elevate-2 group rounded-2xl border border-border bg-gradient-to-br from-card/70 to-card/40 p-4 text-left shadow-sm backdrop-blur transition"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium text-card-foreground">
                    {c.title || "Untitled"}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {relativeTime(c.updatedAt ?? c.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
