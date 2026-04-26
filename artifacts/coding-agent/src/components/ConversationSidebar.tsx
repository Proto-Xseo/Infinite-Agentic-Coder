import { useLocation } from "wouter";
import {
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Layers,
  Settings2,
  Code2,
  Pin,
  PanelLeftClose,
  Sparkles,
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
  onClose,
  width,
}: {
  activeId: number | null;
  onClose?: () => void;
  width?: number;
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

  const conversations = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: Array<{ id: number; title: string }> }).items)
      : [];
  const pinned: typeof conversations = [];
  const recents = conversations;

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

  const navItems: Array<{ icon: typeof Layers; label: string; onClick?: () => void }> = [
    { icon: Plus, label: "New chat", onClick: handleNew },
    { icon: Layers, label: "Projects" },
    { icon: Code2, label: "Artifacts" },
    { icon: Settings2, label: "Customize" },
    { icon: Search, label: "Search" },
  ];

  return (
    <aside
      style={{ width: width ?? 256 }}
      className="flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.2} />
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
            Claude
          </span>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="hover-elevate active-elevate-2 rounded-md p-1 text-muted-foreground transition"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="px-2 pb-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.label === "New chat" && create.isPending}
            className="hover-elevate active-elevate-2 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-sidebar-foreground transition disabled:opacity-60"
          >
            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto nice-scroll px-2 pb-3">
        {pinned.length > 0 ? (
          <Section title="Pinned" icon={Pin}>
            <ChatList
              items={pinned}
              activeId={activeId}
              onOpen={(id) => navigate(`/c/${id}`)}
              onDelete={handleDelete}
            />
          </Section>
        ) : null}

        <Section title="Recents" icon={MessageSquare}>
          {isLoading ? (
            <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Loading…</div>
          ) : recents.length === 0 ? (
            <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No chats yet</div>
          ) : (
            <ChatList
              items={recents}
              activeId={activeId}
              onOpen={(id) => navigate(`/c/${id}`)}
              onDelete={handleDelete}
            />
          )}
        </Section>
      </div>

      <div className="border-t border-sidebar-border px-3 py-2.5 text-[11px] text-muted-foreground">
        Powered by Claude · Replit AI
      </div>
    </aside>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof MessageSquare;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-1.5 px-2.5 text-[11.5px] font-medium text-muted-foreground/90">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
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
    <>
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
              className={`hover-elevate group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-sidebar-foreground transition ${
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
              }`}
            >
              <span className="flex-1 truncate">{c.title || "Untitled"}</span>
              <button
                onClick={(e) => onDelete(c.id, e)}
                className="hover-elevate-2 invisible rounded p-0.5 text-muted-foreground group-hover:visible"
                aria-label="Delete chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </a>
          </li>
        );
      })}
    </>
  );
}
