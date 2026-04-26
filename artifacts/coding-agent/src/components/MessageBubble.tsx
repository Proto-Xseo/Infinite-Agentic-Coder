import { Bot, User, Sparkles } from "lucide-react";
import { Markdown } from "./Markdown";

export type Role = "user" | "assistant" | "subagent" | "system" | "tool";

export function MessageBubble({
  role,
  children,
  text,
  subagentTask,
  streaming,
}: {
  role: Role;
  children?: React.ReactNode;
  text?: string;
  subagentTask?: string;
  streaming?: boolean;
}) {
  const content = text ?? "";
  const showMarkdown = typeof text === "string";

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] gap-3">
          <div className="rounded-2xl rounded-tr-sm border border-primary-border bg-primary px-4 py-3 text-primary-foreground shadow-sm">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {showMarkdown ? content : children}
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  }

  if (role === "subagent") {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[92%] gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 rounded-2xl rounded-tl-sm border border-card-border bg-card px-4 py-3 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
              Subagent
              {subagentTask && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-accent">
                  {subagentTask}
                </span>
              )}
            </div>
            <div className="text-sm leading-relaxed text-card-foreground">
              {showMarkdown ? <Markdown>{content || (streaming ? "Working…" : "")}</Markdown> : children}
              {streaming && <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[92%] gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 rounded-2xl rounded-tl-sm border border-card-border bg-card px-4 py-3 shadow-sm">
          <div className="text-sm leading-relaxed text-card-foreground">
            {showMarkdown ? <Markdown>{content || (streaming ? "Thinking…" : "")}</Markdown> : children}
            {streaming && <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />}
          </div>
        </div>
      </div>
    </div>
  );
}
