import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  Wrench,
  FileText,
  FilePlus2,
  FileEdit,
  FolderTree,
  Search,
  Terminal,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  read_file: FileText,
  write_file: FilePlus2,
  apply_patch: FileEdit,
  list_dir: FolderTree,
  tree: FolderTree,
  search_text: Search,
  run_shell: Terminal,
  dispatch_subagent: Users,
};

const LABELS: Record<string, (input: Record<string, unknown>) => string> = {
  read_file: (i) => String(i.path ?? ""),
  write_file: (i) => String(i.path ?? ""),
  apply_patch: (i) => String(i.path ?? ""),
  list_dir: (i) => String(i.path ?? "."),
  tree: (i) => String(i.path ?? "."),
  search_text: (i) => `"${String(i.query ?? "")}"`,
  run_shell: (i) => String(i.command ?? ""),
  dispatch_subagent: (i) => String(i.role ?? "subagent"),
};

const TOOL_VERBS_ACTIVE: Record<string, string> = {
  read_file: "Reading",
  write_file: "Writing",
  apply_patch: "Patching",
  list_dir: "Listing",
  tree: "Exploring",
  search_text: "Searching",
  run_shell: "Running",
  dispatch_subagent: "Dispatching",
};

const TOOL_VERBS_DONE: Record<string, string> = {
  read_file: "Read",
  write_file: "Wrote",
  apply_patch: "Patched",
  list_dir: "Listed",
  tree: "Explored",
  search_text: "Searched",
  run_shell: "Ran",
  dispatch_subagent: "Dispatched",
};

export type ToolCardProps = {
  tool: string;
  input?: Record<string, unknown>;
  partialInput?: string;
  output?: string;
  status: "streaming-input" | "running" | "done" | "error";
  scope?: "orchestrator" | "subagent";
  subagentRole?: string;
};

function tryExtractPath(partialJson: string): string {
  const match = /"path"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(partialJson);
  return match ? match[1].replace(/\\"/g, '"') : "";
}

function countLines(text: string): number {
  return (text.match(/\n/g) ?? []).length + 1;
}

export function ToolCard({
  tool,
  input,
  partialInput,
  output,
  status,
  scope,
  subagentRole,
}: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const prevStatus = useRef(status);
  const wasStreaming = useRef(false);

  // Auto-open write_file cards while input is streaming so users see live content
  useEffect(() => {
    if (tool === "write_file" && status === "streaming-input" && !wasStreaming.current) {
      wasStreaming.current = true;
      setOpen(true);
    }
    prevStatus.current = status;
  }, [tool, status]);

  const Icon =
    status === "streaming-input" ? Pencil : (ICONS[tool] ?? Wrench);

  // Label: prefer parsed input, fall back to extracted path from partial JSON
  const label = input
    ? (LABELS[tool] ?? (() => tool))(input)
    : partialInput
      ? tryExtractPath(partialInput) || tool
      : tool;

  const isStreaming = status === "streaming-input" || status === "running";
  const StatusIcon =
    isStreaming ? Loader2 : status === "error" ? AlertCircle : CheckCircle2;
  const statusColor = isStreaming
    ? "text-accent"
    : status === "error"
      ? "text-destructive"
      : "text-muted-foreground";

  const isShell = tool === "run_shell";
  const isWrite = tool === "write_file" || tool === "apply_patch";
  const isWriteStreaming = tool === "write_file" && status === "streaming-input";

  // For live write: extract content from partial JSON
  const liveContent = isWriteStreaming && partialInput
    ? tryExtractContent(partialInput)
    : null;

  const verb =
    status === "done" || status === "error"
      ? (TOOL_VERBS_DONE[tool] ?? "Used tool")
      : (TOOL_VERBS_ACTIVE[tool] ?? "Using tool");

  return (
    <div className="group fade-in-up">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[13px] text-muted-foreground hover:text-accent transition"
      >
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${isWriteStreaming ? "text-primary/80 animate-pulse" : "text-accent/70"}`}
        />
        {scope === "subagent" && subagentRole && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {subagentRole}
          </span>
        )}
        <span className="truncate">
          <span
            className={`${isWriteStreaming ? "text-primary/90" : "text-accent/80"}`}
          >
            {verb}
          </span>
          <span className="ml-1 font-mono text-[12px] text-muted-foreground/90">{label}</span>
          {isWriteStreaming && liveContent !== null && (
            <span className="ml-1 text-[11px] text-muted-foreground/60">
              ({countLines(liveContent)} lines)
            </span>
          )}
        </span>
        <StatusIcon
          className={`h-3 w-3 shrink-0 ${statusColor} ${isStreaming ? "animate-spin" : ""}`}
        />
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="pop-in mt-1.5 ml-5 space-y-2 rounded-xl border border-border/70 bg-gradient-to-br from-card/60 to-card/30 px-3 py-2 backdrop-blur">
          {/* Live write streaming preview */}
          {isWriteStreaming && liveContent !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10.5px] text-primary/80">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>Writing file…</span>
              </div>
              <pre className="slim-scroll max-h-64 overflow-auto rounded bg-black/50 p-2 font-mono text-[11px] leading-snug text-green-200/90 border border-green-500/10">
                {liveContent}
                <span className="inline-block h-3.5 w-px bg-green-400/70 animate-pulse ml-0.5" />
              </pre>
            </div>
          )}

          {/* Full input (once we have it) */}
          {input && tool !== "run_shell" && !isWriteStreaming && (
            <pre className="slim-scroll overflow-x-auto rounded bg-secondary/50 p-2 text-[11px] leading-snug text-secondary-foreground">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}

          {/* Output / result */}
          {output !== undefined &&
            (() => {
              const diffMarker = "\n---DIFF---\n";
              const idx = output.indexOf(diffMarker);
              if (tool === "apply_patch" && idx !== -1) {
                const head = output.slice(0, idx);
                const diff = output.slice(idx + diffMarker.length);
                return (
                  <>
                    <div className="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                      {head}
                    </div>
                    <pre className="slim-scroll max-h-80 overflow-auto rounded bg-black/60 p-2 font-mono text-[11px] leading-snug">
                      {diff.split("\n").map((line, i) => {
                        const cls = line.startsWith("+ ")
                          ? "text-emerald-300"
                          : line.startsWith("- ")
                            ? "text-red-300"
                            : "text-muted-foreground";
                        return (
                          <div key={i} className={cls}>
                            {line || " "}
                          </div>
                        );
                      })}
                    </pre>
                  </>
                );
              }
              return (
                <pre
                  className={`slim-scroll max-h-80 overflow-auto rounded p-2 text-[11px] leading-snug ${
                    status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : isShell
                        ? "bg-black text-green-200"
                        : isWrite
                          ? "bg-emerald-500/10 text-foreground"
                          : "bg-secondary/50 text-secondary-foreground"
                  }`}
                >
                  {output || (isStreaming ? "running…" : "(no output)")}
                </pre>
              );
            })()}
        </div>
      )}
    </div>
  );
}

/**
 * Attempt to extract the "content" field from a partial/streaming JSON string.
 * The JSON may be incomplete (e.g. the last character of content is missing).
 * We grab everything after "content": " up to either a closing " or end of string.
 */
function tryExtractContent(partialJson: string): string | null {
  // Match "content": "<value_possibly_incomplete>
  const match = /"content"\s*:\s*"([\s\S]*)$/.exec(partialJson);
  if (!match) return null;
  let raw = match[1];
  // Find closing unescaped quote
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") { result += "\n"; i++; }
      else if (next === "t") { result += "\t"; i++; }
      else if (next === "r") { result += "\r"; i++; }
      else if (next === '"') { result += '"'; i++; }
      else if (next === "\\") { result += "\\"; i++; }
      else { result += next; i++; }
    } else if (ch === '"') {
      // Closing quote — content is complete
      break;
    } else {
      result += ch;
    }
  }
  return result || null;
}
