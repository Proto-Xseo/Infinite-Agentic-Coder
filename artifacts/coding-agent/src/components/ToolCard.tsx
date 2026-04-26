import { useState } from "react";
import { ChevronRight, Wrench, FileText, FilePlus2, FileEdit, FolderTree, Search, Terminal, Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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

const TOOL_VERBS: Record<string, string> = {
  read_file: "Read",
  write_file: "Wrote",
  apply_patch: "Patched",
  list_dir: "Listed",
  tree: "Explored",
  search_text: "Searched",
  run_shell: "Ran command",
  dispatch_subagent: "Dispatched",
};

export type ToolCardProps = {
  tool: string;
  input?: Record<string, unknown>;
  output?: string;
  status: "running" | "done" | "error";
  scope?: "orchestrator" | "subagent";
  subagentRole?: string;
};

export function ToolCard({ tool, input, output, status, scope, subagentRole }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool] ?? Wrench;
  const label = input ? (LABELS[tool] ?? (() => tool))(input) : tool;
  const StatusIcon =
    status === "running" ? Loader2 : status === "error" ? AlertCircle : CheckCircle2;
  const statusColor =
    status === "running"
      ? "text-accent"
      : status === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  const isShell = tool === "run_shell";
  const isWrite = tool === "write_file" || tool === "apply_patch";

  // Inline tool-call style: "Ran a command, used Yushe integration ›" — looks like a hyperlink, expands on click
  const verb = TOOL_VERBS[tool] ?? "Used tool";
  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[13px] text-muted-foreground hover:text-accent transition"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent/70" />
        {scope === "subagent" && subagentRole && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {subagentRole}
          </span>
        )}
        <span className="truncate">
          <span className="text-accent/80">{verb}</span>
          <span className="ml-1 font-mono text-[12px] text-muted-foreground/90">{label}</span>
        </span>
        <StatusIcon
          className={`h-3 w-3 shrink-0 ${statusColor} ${status === "running" ? "animate-spin" : ""}`}
        />
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="pop-in mt-1.5 ml-5 space-y-2 rounded-xl border border-border/70 bg-gradient-to-br from-card/60 to-card/30 px-3 py-2 backdrop-blur">
          {input && tool !== "run_shell" && (
            <pre className="slim-scroll overflow-x-auto rounded bg-secondary/50 p-2 text-[11px] leading-snug text-secondary-foreground">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {output !== undefined && (() => {
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
                {output || (status === "running" ? "running…" : "(no output)")}
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  );
}
