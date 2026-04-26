import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

export function ChatInput({
  onSend,
  onStop,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  return (
    <div className="px-4 pb-6 pt-3">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-lg focus-within:border-primary-border focus-within:ring-2 focus-within:ring-primary/30 transition">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKey}
            placeholder={placeholder ?? "Describe what you want to build…"}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={disabled}
          />
          {disabled && onStop ? (
            <button
              onClick={onStop}
              className="hover-elevate active-elevate-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive-border bg-destructive text-destructive-foreground transition"
              aria-label="Stop"
              title="Stop generation"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={disabled || !value.trim()}
              className="hover-elevate active-elevate-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary text-primary-foreground transition disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 px-2 text-center text-[11px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-secondary px-1 font-mono text-[10px]">Enter</kbd> to send ·{" "}
          <kbd className="rounded border border-border bg-secondary px-1 font-mono text-[10px]">Shift + Enter</kbd> for newline
        </div>
      </div>
    </div>
  );
}
