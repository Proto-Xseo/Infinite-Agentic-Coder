import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export type ToolContext = {
  sandboxRoot: string;
};

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
};

export const AGENT_TOOLS: AnthropicTool[] = [
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file from the conversation sandbox. Returns the file contents (truncated to 100KB).",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path relative to the sandbox root, e.g. 'src/index.ts'.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a UTF-8 text file in the sandbox. Parent directories are created automatically. Use for new files or full rewrites.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the sandbox root." },
        content: { type: "string", description: "Full file content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "apply_patch",
    description:
      "Replace the first exact occurrence of `search` with `replace` in a file. Use for small targeted edits. Fails if `search` is not found or appears more than once unless `replace_all` is true.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        search: { type: "string", description: "Exact substring to find." },
        replace: { type: "string", description: "Replacement text." },
        replace_all: {
          type: "boolean",
          description: "If true, replace every occurrence. Default false.",
        },
      },
      required: ["path", "search", "replace"],
    },
  },
  {
    name: "list_dir",
    description:
      "List entries in a sandbox directory. Returns a JSON array of { name, type, size }.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Sandbox-relative path. Use '.' for sandbox root." },
      },
      required: ["path"],
    },
  },
  {
    name: "tree",
    description:
      "Show a recursive tree view of the sandbox up to a max depth. Useful early in a task to map the project.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Starting path. Use '.' for sandbox root." },
        max_depth: { type: "number", description: "Default 3." },
      },
      required: ["path"],
    },
  },
  {
    name: "search_text",
    description:
      "Search for a literal or regex pattern across files in the sandbox using ripgrep. Returns matches with file:line:text.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Regex pattern (ripgrep syntax)." },
        path: { type: "string", description: "Sandbox-relative dir to search. Defaults to '.'." },
        case_insensitive: { type: "boolean" },
      },
      required: ["query"],
    },
  },
  {
    name: "run_shell",
    description:
      "Run a shell command inside the sandbox (bash). Captures stdout+stderr, returns combined output. Has a 60s timeout. Use for: installing packages (npm install, pip install), running tests, build steps, git, anything else.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Bash command line." },
        cwd: {
          type: "string",
          description: "Sandbox-relative working dir. Defaults to sandbox root.",
        },
        timeout_ms: { type: "number", description: "Override default 60000ms timeout." },
      },
      required: ["command"],
    },
  },
  {
    name: "glob",
    description:
      "Find files matching a glob pattern within the sandbox (e.g. '**/*.ts'). Returns paths relative to sandbox root.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (bash-style)." },
        path: { type: "string", description: "Sub-path to search in. Defaults to '.'." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "delete_path",
    description: "Delete a file or directory in the sandbox (recursive). Use carefully.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "move_path",
    description: "Move/rename a file or directory inside the sandbox.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch a URL via HTTP GET and return the response body (truncated). Useful for reading docs, API responses, or downloading text resources. Strips HTML to text-ish output when content-type is HTML.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL." },
        as: {
          type: "string",
          description: "'text' (default), 'json', or 'html_to_text'.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "download_url",
    description:
      "Download a URL into the sandbox at the given path (binary-safe). Returns the saved path and byte size.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string", description: "Sandbox-relative destination path." },
      },
      required: ["url", "path"],
    },
  },
  {
    name: "todo_write",
    description:
      "Replace the conversation's TODO list. Pass an array of items with text and a done boolean. Use to plan multi-step work and track progress.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              done: { type: "boolean" },
            },
            required: ["text"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "todo_read",
    description: "Read the current TODO list for this conversation.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "dispatch_subagent",
    description:
      "Dispatch a focused subtask to a specialist subagent (architect, implementer, reviewer, tester, researcher). The subagent has the same toolset and can call shell, read/write files, etc. Use for parallelizable or self-contained chunks of work.",
    input_schema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "The subagent's specialty role.",
        },
        task: {
          type: "string",
          description:
            "Self-contained task description. Include all context the subagent needs since it cannot see prior conversation.",
        },
      },
      required: ["role", "task"],
    },
  },
  {
    name: "finish",
    description:
      "Call this when the user's request is fully complete. Provide a short summary of what changed. After this, no more tool calls will be made this turn.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Short summary of completed work." },
      },
      required: ["summary"],
    },
  },
];

const MAX_READ_BYTES = 100 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

export function ensureSandboxSync(ctx: ToolContext): void {
  // best-effort sync mkdir not needed; async version below covers it
  void ctx;
}

export async function ensureSandbox(ctx: ToolContext): Promise<void> {
  await fs.mkdir(ctx.sandboxRoot, { recursive: true });
}

function safePath(ctx: ToolContext, rel: string): string {
  const normalizedRel = rel === "" ? "." : rel;
  const abs = path.resolve(ctx.sandboxRoot, normalizedRel);
  const root = path.resolve(ctx.sandboxRoot);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path '${rel}' escapes sandbox`);
  }
  return abs;
}

function clip(text: string, max = MAX_OUTPUT_BYTES): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n…[truncated ${text.length - max} chars]`;
}

async function toolReadFile(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const p = safePath(ctx, String(input.path ?? ""));
  const stat = await fs.stat(p);
  if (!stat.isFile()) throw new Error(`Not a file: ${input.path}`);
  const buf = await fs.readFile(p);
  const slice = buf.subarray(0, MAX_READ_BYTES);
  let out = slice.toString("utf8");
  if (buf.length > MAX_READ_BYTES) {
    out += `\n…[truncated, file is ${buf.length} bytes total]`;
  }
  return out;
}

async function toolWriteFile(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const rel = String(input.path ?? "");
  const content = String(input.content ?? "");
  const p = safePath(ctx, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
  return `Wrote ${content.length} bytes to ${rel}`;
}

function makeMiniDiff(search: string, replace: string, maxLines = 30): string {
  const oldLines = search.split("\n").slice(0, maxLines);
  const newLines = replace.split("\n").slice(0, maxLines);
  const out: string[] = [];
  for (const l of oldLines) out.push(`- ${l}`);
  for (const l of newLines) out.push(`+ ${l}`);
  if (search.split("\n").length > maxLines || replace.split("\n").length > maxLines) {
    out.push("… (diff truncated)");
  }
  return out.join("\n");
}

async function toolApplyPatch(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const rel = String(input.path ?? "");
  const search = String(input.search ?? "");
  const replace = String(input.replace ?? "");
  const replaceAll = Boolean(input.replace_all);
  if (!search) throw new Error("search must be non-empty");
  const p = safePath(ctx, rel);
  const original = await fs.readFile(p, "utf8");
  if (replaceAll) {
    if (!original.includes(search)) throw new Error("search string not found");
    const next = original.split(search).join(replace);
    await fs.writeFile(p, next, "utf8");
    const occurrences = (original.length - next.length) / (search.length - replace.length || 1);
    return `Replaced all occurrences in ${rel} (≈${occurrences})\n---DIFF---\n${makeMiniDiff(search, replace)}`;
  }
  const first = original.indexOf(search);
  if (first === -1) throw new Error("search string not found");
  const second = original.indexOf(search, first + 1);
  if (second !== -1) {
    throw new Error(
      "search string is not unique — pass replace_all=true or expand the search context",
    );
  }
  const next = original.slice(0, first) + replace + original.slice(first + search.length);
  await fs.writeFile(p, next, "utf8");
  return `Patched ${rel} (1 replacement)\n---DIFF---\n${makeMiniDiff(search, replace)}`;
}

async function toolListDir(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const rel = String(input.path ?? ".");
  const p = safePath(ctx, rel);
  const entries = await fs.readdir(p, { withFileTypes: true });
  const out: Array<{ name: string; type: string; size?: number }> = [];
  for (const e of entries) {
    if (e.name === ".git" || e.name === "node_modules") {
      out.push({ name: e.name, type: "dir(skipped)" });
      continue;
    }
    if (e.isDirectory()) {
      out.push({ name: e.name, type: "dir" });
    } else if (e.isFile()) {
      const st = await fs.stat(path.join(p, e.name));
      out.push({ name: e.name, type: "file", size: st.size });
    } else {
      out.push({ name: e.name, type: "other" });
    }
  }
  return JSON.stringify(out, null, 2);
}

async function toolTree(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const rel = String(input.path ?? ".");
  const maxDepth = Math.max(1, Math.min(8, Number(input.max_depth ?? 3)));
  const root = safePath(ctx, rel);
  const lines: string[] = [];
  async function walk(dir: string, depth: number, prefix: string) {
    if (depth > maxDepth) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries = entries
      .filter((e) => e.name !== ".git" && e.name !== "node_modules" && !e.name.startsWith(".cache"))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const isLast = i === entries.length - 1;
      const branch = isLast ? "└── " : "├── ";
      const nextPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(prefix + branch + e.name + (e.isDirectory() ? "/" : ""));
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), depth + 1, nextPrefix);
      }
    }
  }
  lines.push(rel === "." ? "." : rel);
  await walk(root, 1, "");
  return clip(lines.join("\n"));
}

async function toolSearchText(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const query = String(input.query ?? "");
  if (!query) throw new Error("query required");
  const rel = String(input.path ?? ".");
  const ci = Boolean(input.case_insensitive);
  const target = safePath(ctx, rel);
  const args = ["--no-heading", "--line-number", "--color=never", "--max-count=50"];
  if (ci) args.push("-i");
  args.push(query, target);
  const out = await runProcess("rg", args, { cwd: ctx.sandboxRoot, timeoutMs: 15_000 });
  return clip(out.text || "(no matches)");
}

async function toolRunShell(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const command = String(input.command ?? "");
  if (!command) throw new Error("command required");
  const cwd = input.cwd ? safePath(ctx, String(input.cwd)) : ctx.sandboxRoot;
  const timeoutMs = Math.min(120_000, Number(input.timeout_ms ?? DEFAULT_TIMEOUT_MS));
  const out = await runProcess("bash", ["-lc", command], { cwd, timeoutMs });
  const header = `$ ${command}\n[exit ${out.code}${out.timedOut ? " — TIMEOUT" : ""}]`;
  return clip(`${header}\n${out.text}`);
}

type RunResult = { text: string; code: number; timedOut: boolean };

function runProcess(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, opts.timeoutMs);
    child.stdout.on("data", (c) => {
      buf += c.toString();
      if (buf.length > MAX_OUTPUT_BYTES * 2) {
        buf = buf.slice(0, MAX_OUTPUT_BYTES * 2);
      }
    });
    child.stderr.on("data", (c) => {
      buf += c.toString();
      if (buf.length > MAX_OUTPUT_BYTES * 2) {
        buf = buf.slice(0, MAX_OUTPUT_BYTES * 2);
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ text: `spawn error: ${err.message}`, code: -1, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ text: buf, code: code ?? -1, timedOut });
    });
  });
}

async function toolGlob(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const pattern = String(input.pattern ?? "");
  if (!pattern) throw new Error("pattern required");
  const sub = String(input.path ?? ".");
  const cwd = safePath(ctx, sub);
  const out = await runProcess(
    "bash",
    ["-lc", `shopt -s globstar nullglob dotglob; printf '%s\\n' ${JSON.stringify(pattern)}`],
    { cwd, timeoutMs: 10_000 },
  );
  return clip(out.text || "(no matches)");
}

async function toolDeletePath(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const rel = String(input.path ?? "");
  if (!rel || rel === "." || rel === "/") throw new Error("refusing to delete sandbox root");
  const p = safePath(ctx, rel);
  await fs.rm(p, { recursive: true, force: true });
  return `Deleted ${rel}`;
}

async function toolMovePath(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const from = safePath(ctx, String(input.from ?? ""));
  const to = safePath(ctx, String(input.to ?? ""));
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  return `Moved ${input.from} → ${input.to}`;
}

async function toolWebFetch(_ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const url = String(input.url ?? "");
  if (!/^https?:\/\//i.test(url)) throw new Error("url must be http(s)");
  const as = String(input.as ?? "text");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "InfiniteAgenticCoder/1.0" },
    });
    const text = await r.text();
    let body = text;
    if (as === "html_to_text") {
      body = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } else if (as === "json") {
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // leave as-is
      }
    }
    return clip(`HTTP ${r.status} ${r.statusText}\n\n${body}`);
  } finally {
    clearTimeout(t);
  }
}

async function toolDownloadUrl(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const url = String(input.url ?? "");
  if (!/^https?:\/\//i.test(url)) throw new Error("url must be http(s)");
  const rel = String(input.path ?? "");
  const dest = safePath(ctx, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "InfiniteAgenticCoder/1.0" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await fs.writeFile(dest, buf);
    return `Saved ${buf.length} bytes to ${rel}`;
  } finally {
    clearTimeout(t);
  }
}

async function readTodoFile(ctx: ToolContext): Promise<Array<{ text: string; done: boolean }>> {
  const p = safePath(ctx, ".agent/todos.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

async function toolTodoRead(ctx: ToolContext): Promise<string> {
  const items = await readTodoFile(ctx);
  if (items.length === 0) return "(empty todo list)";
  return items.map((it, i) => `${it.done ? "[x]" : "[ ]"} ${i + 1}. ${it.text}`).join("\n");
}

async function toolTodoWrite(ctx: ToolContext, input: Record<string, unknown>): Promise<string> {
  const raw = input.items;
  if (!Array.isArray(raw)) throw new Error("items must be an array");
  const items = raw.map((r) => ({
    text: String((r as { text?: unknown }).text ?? ""),
    done: Boolean((r as { done?: unknown }).done),
  }));
  const p = safePath(ctx, ".agent/todos.json");
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(items, null, 2), "utf8");
  return `Saved ${items.length} todo item(s).`;
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  await ensureSandbox(ctx);
  switch (name) {
    case "read_file":
      return toolReadFile(ctx, input);
    case "write_file":
      return toolWriteFile(ctx, input);
    case "apply_patch":
      return toolApplyPatch(ctx, input);
    case "list_dir":
      return toolListDir(ctx, input);
    case "tree":
      return toolTree(ctx, input);
    case "search_text":
      return toolSearchText(ctx, input);
    case "run_shell":
      return toolRunShell(ctx, input);
    case "glob":
      return toolGlob(ctx, input);
    case "delete_path":
      return toolDeletePath(ctx, input);
    case "move_path":
      return toolMovePath(ctx, input);
    case "web_fetch":
      return toolWebFetch(ctx, input);
    case "download_url":
      return toolDownloadUrl(ctx, input);
    case "todo_read":
      return toolTodoRead(ctx);
    case "todo_write":
      return toolTodoWrite(ctx, input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
