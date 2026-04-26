import { useState } from "react";
import { User, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

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
    const empty = !content;
    return (
      <div className="px-1 fade-in-up">
        <div className="mb-1 flex items-center gap-1.5 text-[12px] text-accent/90">
          <Sparkles className="h-3.5 w-3.5" />
          {subagentTask ? <span>{subagentTask}</span> : <span>Subagent</span>}
        </div>
        <div className="text-[14.5px] leading-relaxed text-foreground/95">
          {empty && streaming ? (
            <span className="shimmer-text">Working…</span>
          ) : showMarkdown ? (
            <Markdown>{content}</Markdown>
          ) : (
            children
          )}
          {streaming && !empty && (
            <span className="ml-1 inline-block h-3.5 w-[6px] animate-pulse bg-accent align-middle" />
          )}
        </div>
      </div>
    );
  }

  // assistant — INLINE (no box) per Claude desktop style
  const empty = !content;
  const showActions = !empty && !streaming;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };
  return (
    <div className="group/msg px-1 text-[14.5px] leading-relaxed text-foreground/95 fade-in-up">
      {empty && streaming ? (
        <span className="shimmer-text">Thinking…</span>
      ) : showMarkdown ? (
        <Markdown>{content}</Markdown>
      ) : (
        children
      )}
      {streaming && !empty && (
        <span className="ml-1 inline-block h-3.5 w-[6px] animate-pulse bg-primary align-middle" />
      )}
      {showActions ? (
        <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100">
          <ActionBtn label={copied ? "Copied" : "Copy"} onClick={onCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </ActionBtn>
          <ActionBtn label="Good response">
            <ThumbsUp className="h-3.5 w-3.5" />
          </ActionBtn>
          <ActionBtn label="Bad response">
            <ThumbsDown className="h-3.5 w-3.5" />
          </ActionBtn>
          <ActionBtn label="Retry">
            <RefreshCw className="h-3.5 w-3.5" />
          </ActionBtn>
        </div>
      ) : null}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hover-elevate active-elevate-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
    >
      {children}
    </button>
  );
}
