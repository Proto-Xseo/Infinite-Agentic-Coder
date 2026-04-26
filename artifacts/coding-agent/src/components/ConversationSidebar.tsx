import { useLocation } from "wouter";
import { Plus, MessageSquare, Trash2, Bot } from "lucide-react";
import {
  useListAnthropicConversations,
  useCreateAnthropicConversation,
  deleteAnthropicConversation,
  getListAnthropicConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function ConversationSidebar({ activeId }: { activeId: number | null }) {
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

  const conversations = data ?? [];

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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-foreground">Coding Agent</span>
          <span className="text-[11px] text-muted-foreground">Claude orchestrator + subagents</span>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={handleNew}
          disabled={create.isPending}
          className="hover-elevate active-elevate-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto nice-scroll px-2 pb-3">
        <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Recent
        </div>
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No chats yet</div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <a
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/c/${c.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/c/${c.id}`);
                    }}
                    className={`hover-elevate group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition ${
                      isActive ? "bg-sidebar-accent" : ""
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{c.title || "Untitled"}</span>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="hover-elevate-2 invisible rounded p-1 text-muted-foreground group-hover:visible"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground">
        Powered by Claude · Replit AI
      </div>
    </aside>
  );
}
