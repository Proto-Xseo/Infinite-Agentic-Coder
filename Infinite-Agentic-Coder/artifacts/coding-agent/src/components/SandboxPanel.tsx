import { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  ListTodo,
  Trash2,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { apiUrl } from "../lib/api-base";

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  py: "python",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  css: "css",
  html: "html",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  c: "c",
  cpp: "cpp",
  toml: "toml",
  sql: "sql",
};

function langForPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: Node[];
};

type Todo = { text: string; done: boolean };

export function SandboxPanel({
  conversationId,
  refreshKey,
}: {
  conversationId: number | null;
  refreshKey: number;
}) {
  const [tree, setTree] = useState<Node[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState<{ path: string; content: string; size: number } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setTree([]);
      setTodos([]);
      return;
    }
    setLoading(true);
    try {
      const [t, td] = await Promise.all([
        fetch(apiUrl(`/anthropic/conversations/${conversationId}/sandbox/tree`)).then((r) =>
          r.json(),
        ),
        fetch(apiUrl(`/anthropic/conversations/${conversationId}/sandbox/todos`)).then((r) =>
          r.json(),
        ),
      ]);
      setTree(t.tree ?? []);
      setTodos(td.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const resetSandbox = async () => {
    if (!conversationId) return;
    if (!confirm("Wipe the entire sandbox for this conversation? This cannot be undone.")) return;
    try {
      await fetch(apiUrl(`/anthropic/conversations/${conversationId}/sandbox`), {
        method: "DELETE",
      });
      await refresh();
      setOpened(null);
    } catch {
      // ignore
    }
  };

  const openFile = async (p: string) => {
    if (!conversationId) return;
    try {
      const r = await fetch(
        apiUrl(`/anthropic/conversations/${conversationId}/sandbox/file?path=${encodeURIComponent(p)}`),
      ).then((x) => x.json());
      if (r.error) return;
      setOpened({ path: r.path, content: r.content, size: r.size });
    } catch {
      // ignore
    }
  };

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-border bg-card/30 lg:flex">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Folder className="h-3.5 w-3.5 text-accent" />
          Sandbox
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            className="hover-elevate rounded p-1 text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={resetSandbox}
            className="hover-elevate rounded p-1 text-muted-foreground hover:text-destructive"
            title="Wipe sandbox"
            disabled={!conversationId}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {todos.length > 0 && (
        <div className="border-b border-border px-3 py-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ListTodo className="h-3 w-3" /> Todos
          </div>
          <ul className="space-y-0.5">
            {todos.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-foreground/90">
                {t.done ? (
                  <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                ) : (
                  <Square className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto nice-scroll px-1 py-2 text-[12.5px]">
        {!conversationId ? (
          <div className="px-2 py-4 text-xs text-muted-foreground">No conversation selected.</div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            Sandbox is empty. Ask the agent to create something.
          </div>
        ) : (
          <Tree nodes={tree} onOpenFile={openFile} />
        )}
      </div>

      {opened && (
        <FileViewer file={opened} onClose={() => setOpened(null)} />
      )}
    </aside>
  );
}

function Tree({ nodes, onOpenFile }: { nodes: Node[]; onOpenFile: (p: string) => void }) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <TreeNode key={n.path} node={n} depth={0} onOpenFile={onOpenFile} />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  onOpenFile,
}: {
  node: Node;
  depth: number;
  onOpenFile: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 12 };
  if (node.type === "dir") {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="hover-elevate flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-foreground/90"
          style={pad}
        >
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-accent" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <ul>
            {node.children.map((c) => (
              <TreeNode key={c.path} node={c} depth={depth + 1} onOpenFile={onOpenFile} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(node.path)}
        className="hover-elevate flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-foreground/85"
        style={pad}
        title={`${node.path}${node.size ? ` (${node.size} B)` : ""}`}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex-1 truncate">{node.name}</span>
      </button>
    </li>
  );
}

function FileViewer({
  file,
  onClose,
}: {
  file: { path: string; content: string; size: number };
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-foreground/90">{file.path}</span>
          <span className="text-[10px] text-muted-foreground">{file.size} B</span>
        </div>
        <button
          onClick={onClose}
          className="hover-elevate rounded p-1 text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="nice-scroll flex-1 overflow-auto bg-[#0b0b0d]">
        <SyntaxHighlighter
          language={langForPath(file.path)}
          style={oneDark as { [key: string]: React.CSSProperties }}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "12px 14px",
            background: "transparent",
            fontSize: "12px",
            lineHeight: "1.45",
          }}
        >
          {file.content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
