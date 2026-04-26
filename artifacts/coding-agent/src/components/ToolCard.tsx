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
  read_file: (i) => `read ${String(i.path ?? "")}`,
  write_file: (i) => `write ${String(i.path ?? "")}`,
  apply_patch: (i) => `patch ${String(i.path ?? "")}`,
  list_dir: (i) => `ls ${String(i.path ?? ".")}`,
  tree: (i) => `tree ${String(i.path ?? ".")}`,
  search_text: (i) => `grep "${String(i.query ?? "")}"`,
  run_shell: (i) => `$ ${String(i.command ?? "")}`,
  dispatch_subagent: (i) => `→ ${String(i.role ?? "subagent")}`,
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

  return (
    <div className="group rounded-lg border border-border bg-card/60 text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-card/80"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Icon className="h-3.5 w-3.5 text-accent" />
        {scope === "subagent" && subagentRole && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {subagentRole}
          </span>
        )}
        <span className="flex-1 truncate font-mono text-[12px]">{label}</span>
        <StatusIcon
          className={`h-3.5 w-3.5 ${statusColor} ${status === "running" ? "animate-spin" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2">
          {input && tool !== "run_shell" && (
            <pre className="overflow-x-auto rounded bg-secondary/50 p-2 text-[11px] leading-snug text-secondary-foreground">
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
                  <pre className="max-h-80 overflow-auto rounded bg-black/60 p-2 font-mono text-[11px] leading-snug">
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
                className={`max-h-80 overflow-auto rounded p-2 text-[11px] leading-snug ${
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
