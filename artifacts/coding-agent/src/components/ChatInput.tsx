import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Square,
  ChevronDown,
  Folder,
  MonitorCheck,
  Check,
  Plus,
  Image,
  FolderPlus,
  Plug,
} from "lucide-react";

const MODELS: Array<{ id: string; label: string; sub?: string }> = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", sub: "Adaptive · only model wired in" },
];

const DEFAULT_FOLDERS: Array<{ id: string; label: string; sub?: string }> = [
  { id: "sandbox", label: "Sandbox", sub: "Per-conversation isolated workspace" },
  { id: "project", label: "Project root", sub: "Full read/write access to this Replit" },
];

export type ChatSettings = {
  model: string;
  folder: string;
};

const STORAGE_KEY = "coding-agent.chat-settings.v1";

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatSettings>;
      return {
        model: parsed.model ?? MODELS[0].id,
        folder: parsed.folder ?? DEFAULT_FOLDERS[0].id,
      };
    }
  } catch {
    // ignore
  }
  return { model: MODELS[0].id, folder: DEFAULT_FOLDERS[0].id };
}

function saveSettings(s: ChatSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  placeholder,
  showHeader = true,
  large = false,
}: {
  onSend: (text: string, settings: ChatSettings) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  showHeader?: boolean;
  large?: boolean;
}) {
  const [value, setValue] = useState("");
  const [settings, setSettings] = useState<ChatSettings>(() => loadSettings());
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, settings);
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
    el.style.height = `${Math.min(el.scrollHeight, large ? 280 : 220)}px`;
  };

  const currentModel = MODELS.find((m) => m.id === settings.model) ?? MODELS[0];
  const currentFolder =
    DEFAULT_FOLDERS.find((f) => f.id === settings.folder) ?? DEFAULT_FOLDERS[0];

  return (
    <div className={large ? "w-full" : "px-4 pb-6 pt-3"}>
      <div className={large ? "w-full" : "mx-auto max-w-3xl"}>
        {showHeader ? (
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <Dropdown
              trigger={
                <span className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/90">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{currentFolder.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              }
            >
              {(close) => (
                <DropdownPanel title="Working folder">
                  {DEFAULT_FOLDERS.map((f) => (
                    <DropdownItem
                      key={f.id}
                      active={f.id === settings.folder}
                      onClick={() => {
                        setSettings({ ...settings, folder: f.id });
                        close();
                      }}
                      label={f.label}
                      sub={f.sub}
                    />
                  ))}
                </DropdownPanel>
              )}
            </Dropdown>

            <Dropdown
              trigger={
                <span className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/90">
                  <MonitorCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Local worktree</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              }
            >
              {(close) => (
                <DropdownPanel title="Worktree">
                  <DropdownItem
                    active
                    onClick={close}
                    label="Local worktree"
                    sub="Use the sandbox copy for edits"
                  />
                </DropdownPanel>
              )}
            </Dropdown>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card/80 shadow-2xl shadow-black/40 backdrop-blur transition focus-within:border-primary-border focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            ref={ref}
            rows={large ? 2 : 1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKey}
            placeholder={placeholder ?? "Find a small todo in the codebase and do it"}
            className={`slim-scroll block w-full resize-none bg-transparent px-4 ${large ? "pt-4 pb-2 text-[15px]" : "pt-3 pb-2 text-sm"} text-foreground placeholder:text-muted-foreground focus:outline-none`}
            disabled={disabled}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <Dropdown
              align="left"
              bare
              openUp
              trigger={
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground transition hover:border-border-hover hover:bg-secondary/70">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              }
            >
              {(close) => (
                <DropdownPanel>
                  <DropdownIconItem
                    icon={<Image className="h-4 w-4" />}
                    label="Add files or photos"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.onchange = () => {
                        const file = input.files?.[0];
                        if (file) {
                          setValue(
                            (v) =>
                              `${v ? v + "\n\n" : ""}@file ${file.name} (${Math.round(
                                file.size / 1024,
                              )}KB) — please read this file from the sandbox at /uploads/${file.name}`,
                          );
                        }
                        close();
                      };
                      input.click();
                    }}
                  />
                  <DropdownIconItem
                    icon={<FolderPlus className="h-4 w-4" />}
                    label="Add to project"
                    chevron
                    onClick={() => {
                      const path = prompt("Sandbox path (e.g. src/index.ts):");
                      if (path) setValue((v) => `${v ? v + "\n\n" : ""}@file ${path}`);
                      close();
                    }}
                  />
                  <div className="my-1 border-t border-border/60" />
                  <HoverSubmenu
                    icon={<Plug className="h-4 w-4" />}
                    label="Connectors"
                    submenu={
                      <div className="space-y-0.5">
                        <ConnectorRow id="filesystem" label="Sandbox filesystem" defaultOn />
                        <ConnectorRow id="shell" label="Shell · run_shell" defaultOn />
                        <ConnectorRow id="subagent" label="Subagent dispatch" defaultOn />
                      </div>
                    }
                  />
                </DropdownPanel>
              )}
            </Dropdown>
            <div className="flex items-center gap-2">
              <Dropdown
                trigger={
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground/85">{currentModel.label}</span>
                    {currentModel.sub ? (
                      <span className="text-[10.5px] text-muted-foreground/80">
                        {currentModel.sub.split("·")[0].trim()}
                      </span>
                    ) : null}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                }
                align="right"
                openUp
                bare
              >
                {(close) => (
                  <DropdownPanel title="Model">
                    {MODELS.map((m) => (
                      <DropdownItem
                        key={m.id}
                        active={m.id === settings.model}
                        onClick={() => {
                          setSettings({ ...settings, model: m.id });
                          close();
                        }}
                        label={m.label}
                        sub={m.sub}
                      />
                    ))}
                  </DropdownPanel>
                )}
              </Dropdown>
              {disabled && onStop ? (
                <button
                  onClick={onStop}
                  className="hover-elevate active-elevate-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive-border bg-destructive text-destructive-foreground transition"
                  aria-label="Stop"
                  title="Stop generation"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={disabled || !value.trim()}
                  className="hover-elevate active-elevate-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary text-primary-foreground transition disabled:opacity-40"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {!large ? (
          <div className="mt-2 px-2 text-center text-[11px] text-muted-foreground">
            Press{" "}
            <kbd className="rounded border border-border bg-secondary px-1 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border border-border bg-secondary px-1 font-mono text-[10px]">
              Shift + Enter
            </kbd>{" "}
            for newline
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Dropdown({
  trigger,
  children,
  align = "left",
  bare,
  openUp,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  bare?: boolean;
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          bare
            ? "hover-elevate active-elevate-2 inline-flex items-center rounded-md transition"
            : "hover-elevate active-elevate-2 inline-flex items-center rounded-lg border border-border bg-card/70 backdrop-blur transition"
        }
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={`pop-in absolute z-50 ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "right" ? "right-0" : "left-0"} min-w-[240px] rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function DropdownPanel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {title ? (
        <div className="px-2 pt-1 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function DropdownItem({
  active,
  onClick,
  label,
  sub,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  label: string;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`hover-elevate active-elevate-2 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "bg-foreground/[0.04]" : ""
      }`}
    >
      <Check
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
      />
      <span className="flex-1">
        <span className="block font-medium text-foreground">{label}</span>
        {sub ? <span className="block text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
    </button>
  );
}

function DropdownIconItem({
  icon,
  label,
  onClick,
  chevron,
  rightCheck,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  chevron?: boolean;
  rightCheck?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover-elevate active-elevate-2 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 font-normal text-foreground/95">{label}</span>
      {rightCheck ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
      {chevron ? <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" /> : null}
    </button>
  );
}

function HoverSubmenu({
  icon,
  label,
  submenu,
}: {
  icon: React.ReactNode;
  label: string;
  submenu: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const onEnter = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setOpen(true);
  };
  const onLeave = () => {
    hideTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  return (
    <div
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <button
        type="button"
        className={`hover-elevate active-elevate-2 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] transition ${
          open ? "bg-foreground/[0.04]" : ""
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <span className="flex-1 font-normal text-foreground/95">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
      </button>
      {open ? (
        <div className="pop-in slim-scroll absolute top-0 left-full z-[60] ml-1 max-h-[55vh] min-w-[220px] overflow-y-auto rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
          {submenu}
        </div>
      ) : null}
    </div>
  );
}

function SubItem({
  label,
  sub,
  onClick,
  disabled,
}: {
  label: string;
  sub?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover-elevate active-elevate-2 flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-foreground/95 transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex-1">
        <span className="block">{label}</span>
        {sub ? <span className="block text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
    </button>
  );
}

function ConnectorRow({
  id,
  label,
  defaultOn,
}: {
  id: string;
  label: string;
  defaultOn?: boolean;
}) {
  const key = `coding-agent.connector.${id}`;
  const [on, setOn] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (saved == null) return Boolean(defaultOn);
    return saved === "true";
  });
  const initial = label.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setOn(next);
        try {
          localStorage.setItem(key, String(next));
        } catch {
          // ignore
        }
      }}
      className="hover-elevate active-elevate-2 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-muted-foreground">
        {initial}
      </span>
      <span className="flex-1">{label}</span>
      <span
        className={`relative h-3.5 w-7 shrink-0 rounded-full transition ${
          on ? "bg-accent" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${
            on ? "left-[16px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
