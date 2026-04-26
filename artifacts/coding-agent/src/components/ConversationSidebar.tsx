import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Layers,
  Settings,
  Code2,
  Pin,
  Briefcase,
  Globe,
  Gift,
  HelpCircle,
  Download,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";
import {
  useListAnthropicConversations,
  useCreateAnthropicConversation,
  deleteAnthropicConversation,
  getListAnthropicConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function ConversationSidebar({
  activeId,
  onArtifactsToggle,
}: {
  activeId: number | null;
  onArtifactsToggle?: () => void;
}) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data, isLoading } = useListAnthropicConversations();
  const create = useCreateAnthropicConversation({
    mutation: {
      onSuccess: (created) => {
        qc.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        navigate(`/c/${created.id}`);
      },
      onError: () => toast.error("Could not create a new chat"),
    },
  });

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userName =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("settings.callMe") || ""
      : "";

  const conversations = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? (data as { items: Array<{ id: number; title: string }> }).items
      : [];

  const displayList = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const pinned: typeof conversations = [];
  const recents = displayList;

  // Auto-focus search input when entering search mode
  useEffect(() => {
    if (searchMode) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchMode]);

  // Close account flyout on outside click
  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [accountOpen]);

  const handleNew = () => {
    create.mutate({ data: { title: "New chat" } });
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await deleteAnthropicConversation(id);
      qc.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
      if (activeId === id) navigate("/");
    } catch {
      toast.error("Could not delete chat");
    }
  };

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* ── Search inline or nav ── */}
      {searchMode ? (
        <div className="px-2 pt-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-lg border border-border bg-card/40 py-1.5 pl-8 pr-8 text-[12.5px] focus:border-primary-border focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={() => {
                setSearchMode(false);
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {searchQuery && (
            <div className="mt-1 px-1 text-[11px] text-muted-foreground">
              {displayList.length} result{displayList.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      ) : (
        <nav className="px-2 pt-3 pb-1 space-y-0.5">
          <NavBtn
            icon={Plus}
            label="New chat"
            onClick={handleNew}
            loading={create.isPending}
          />
          <NavBtn
            icon={Search}
            label="Search"
            onClick={() => setSearchMode(true)}
          />
          <NavBtn icon={Briefcase} label="Projects" disabled />
          <NavBtn
            icon={Layers}
            label="Artifacts"
            onClick={onArtifactsToggle}
          />
          <NavBtn
            icon={Settings}
            label="Customize"
            onClick={() => navigate("/customize")}
          />
          <NavBtn icon={Code2} label="Code" disabled />
        </nav>
      )}

      {/* ── Conversation list ── */}
      <div className="slim-scroll flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="px-2.5 py-3 text-[12px] text-muted-foreground">Loading…</div>
        ) : (
          <>
            {!searchMode && pinned.length > 0 && (
              <SectionHeader>Pinned</SectionHeader>
            )}
            {!searchMode && pinned.length > 0 && (
              <ChatList
                items={pinned}
                activeId={activeId}
                onOpen={(id) => navigate(`/c/${id}`)}
                onDelete={handleDelete}
              />
            )}

            {!searchMode && recents.length > 0 && (
              <SectionHeader>Recents</SectionHeader>
            )}
            {recents.length === 0 && !isLoading && (
              <div className="px-2.5 py-3 text-[12px] text-muted-foreground">
                {searchQuery ? `No results for "${searchQuery}"` : "No chats yet"}
              </div>
            )}
            <ChatList
              items={recents}
              activeId={activeId}
              onOpen={(id) => {
                navigate(`/c/${id}`);
                if (searchMode) {
                  setSearchMode(false);
                  setSearchQuery("");
                }
              }}
              onDelete={handleDelete}
            />
          </>
        )}
      </div>

      {/* ── Account ── */}
      <div ref={accountRef} className="relative border-t border-sidebar-border">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="hover-elevate active-elevate-2 flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-[10px] font-semibold text-sidebar-foreground">
            {userName ? userName.charAt(0).toUpperCase() : "?"}
          </div>
          <span className="flex-1 truncate text-[12.5px] text-sidebar-foreground/80">
            {userName || "Account"}
          </span>
          <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>

        {accountOpen && (
          <div className="pop-in absolute bottom-full left-2 right-2 mb-1 rounded-xl border border-border bg-popover/95 py-1 shadow-2xl shadow-black/50 backdrop-blur">
            {/* Email / name header */}
            <div className="border-b border-border/50 px-3 py-2 text-[12px] text-muted-foreground">
              {userName || "Guest user"}
            </div>

            <AccountItem
              icon={Settings}
              label="Settings"
              hint="⇧+Ctrl+,"
              onClick={() => { navigate("/settings"); setAccountOpen(false); }}
            />
            <AccountItem
              icon={Globe}
              label="Language"
              onClick={() => setAccountOpen(false)}
              chevron
            />
            <AccountItem
              icon={HelpCircle}
              label="Get help"
              onClick={() => setAccountOpen(false)}
            />

            <div className="my-1 border-t border-border/50" />

            <AccountItem
              icon={ChevronRight}
              label="Upgrade plan"
              onClick={() => setAccountOpen(false)}
            />
            <AccountItem
              icon={Download}
              label="Get apps and extensions"
              onClick={() => setAccountOpen(false)}
            />
            <AccountItem
              icon={Gift}
              label="Gift Claude"
              onClick={() => setAccountOpen(false)}
            />
            <AccountItem
              icon={HelpCircle}
              label="Learn more"
              onClick={() => setAccountOpen(false)}
              chevron
            />

            <div className="my-1 border-t border-border/50" />

            <AccountItem
              icon={LogOut}
              label="Log out"
              onClick={() => setAccountOpen(false)}
              danger
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function NavBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
}: {
  icon: typeof Plus;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`hover-elevate active-elevate-2 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
        disabled
          ? "cursor-default text-muted-foreground/40"
          : "text-sidebar-foreground/85 hover:text-sidebar-foreground"
      } ${loading ? "opacity-60" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-0.5 px-2.5 text-[11.5px] font-medium text-muted-foreground/70">
      {children}
    </div>
  );
}

function ChatList({
  items,
  activeId,
  onOpen,
  onDelete,
}: {
  items: Array<{ id: number; title: string }>;
  activeId: number | null;
  onOpen: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
}) {
  return (
    <ul className="space-y-0">
      {items.map((c) => {
        const isActive = c.id === activeId;
        return (
          <li key={c.id}>
            <a
              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/c/${c.id}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(c.id);
              }}
              className={`hover-elevate group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
              }`}
            >
              <span className="flex-1 truncate">{c.title || "Untitled"}</span>
              <button
                onClick={(e) => onDelete(c.id, e)}
                className="hover-elevate-2 invisible shrink-0 rounded p-0.5 text-muted-foreground group-hover:visible"
                aria-label="Delete chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function AccountItem({
  icon: Icon,
  label,
  hint,
  chevron,
  danger,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  hint?: string;
  chevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover-elevate active-elevate-2 flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition ${
        danger ? "text-destructive" : "text-foreground/85"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      {chevron && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </button>
  );
}
