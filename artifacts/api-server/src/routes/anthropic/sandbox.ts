import { Router, type IRouter } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, conversations } from "@workspace/db";

const router: IRouter = Router();

const SANDBOX_BASE = path.resolve(
  process.cwd(),
  process.env.AGENT_SANDBOX_BASE || ".sandboxes",
);

function sandboxRootFor(convId: number): string {
  return path.join(SANDBOX_BASE, String(convId));
}

function safePath(root: string, rel: string): string {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("Path escapes sandbox");
  }
  return abs;
}

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: Node[];
};

async function buildTree(absDir: string, relDir: string, depth: number): Promise<Node[]> {
  if (depth > 6) return [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries = entries
    .filter((e) => e.name !== "node_modules" && e.name !== ".git")
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  const out: Node[] = [];
  for (const e of entries) {
    const childRel = path.posix.join(relDir, e.name);
    const childAbs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      out.push({
        name: e.name,
        path: childRel,
        type: "dir",
        children: await buildTree(childAbs, childRel, depth + 1),
      });
    } else if (e.isFile()) {
      let size = 0;
      try {
        const st = await fs.stat(childAbs);
        size = st.size;
      } catch {
        // ignore
      }
      out.push({ name: e.name, path: childRel, type: "file", size });
    }
  }
  return out;
}

router.get("/conversations/:id/sandbox/tree", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const root = sandboxRootFor(id);
  try {
    await fs.mkdir(root, { recursive: true });
    const tree = await buildTree(root, "", 0);
    res.json({ root: ".", tree });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/conversations/:id/sandbox/file", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rel = String(req.query.path ?? "");
  if (!rel) {
    res.status(400).json({ error: "path required" });
    return;
  }
  const root = sandboxRootFor(id);
  try {
    const abs = safePath(root, rel);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      res.status(400).json({ error: "Not a file" });
      return;
    }
    if (stat.size > 256 * 1024) {
      const buf = await fs.readFile(abs);
      const head = buf.subarray(0, 256 * 1024).toString("utf8");
      res.json({
        path: rel,
        size: stat.size,
        truncated: true,
        content: head + `\n…[truncated ${stat.size - 256 * 1024} bytes]`,
      });
      return;
    }
    const content = await fs.readFile(abs, "utf8");
    res.json({ path: rel, size: stat.size, truncated: false, content });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/conversations/:id/sandbox", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const root = sandboxRootFor(id);
  try {
    await fs.rm(root, { recursive: true, force: true });
    await fs.mkdir(root, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/conversations/:id/sandbox/todos", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const root = sandboxRootFor(id);
  try {
    const abs = safePath(root, ".agent/todos.json");
    const raw = await fs.readFile(abs, "utf8");
    const items = JSON.parse(raw);
    res.json({ items: Array.isArray(items) ? items : [] });
  } catch {
    res.json({ items: [] });
  }
});

export default router;
