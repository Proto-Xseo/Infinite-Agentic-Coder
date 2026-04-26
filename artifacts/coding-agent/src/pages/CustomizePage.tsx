import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plug,
  BookOpen,
  Puzzle,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Briefcase,
  GitBranch,
} from "lucide-react";

type Skill = {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
};

function loadSkills(): Skill[] {
  try {
    const raw = localStorage.getItem("coding-agent.skills.v1");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: "terse",
      name: "Be concise",
      prompt: "Keep responses brief and to the point. Skip preamble, just answer directly.",
      enabled: false,
    },
    {
      id: "typescript",
      name: "TypeScript-first",
      prompt:
        "Prefer TypeScript over JavaScript. Always add types to function signatures and variables.",
      enabled: false,
    },
    {
      id: "tests",
      name: "Write tests",
      prompt:
        "For every new function or module you write, also write corresponding unit tests.",
      enabled: false,
    },
  ];
}

function saveSkills(skills: Skill[]) {
  try {
    localStorage.setItem("coding-agent.skills.v1", JSON.stringify(skills));
  } catch {}
}

type Tab = "skills" | "connectors" | "plugins";

export default function CustomizePage() {
  const [tab, setTab] = useState<Tab>("connectors");

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="flex w-[180px] shrink-0 flex-col border-r border-border bg-sidebar/60 px-2 py-5">
        <Link
          href="/"
          className="hover-elevate active-elevate-2 mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Customize
        </Link>
        <nav className="space-y-0.5">
          {(
            [
              { id: "skills" as const, icon: BookOpen, label: "Skills" },
              { id: "connectors" as const, icon: Plug, label: "Connectors" },
              { id: "plugins" as const, icon: Puzzle, label: "Plugins" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition ${
                tab === t.id
                  ? "bg-foreground/[0.05] font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="slim-scroll flex flex-1 items-start justify-center overflow-y-auto px-12 py-16">
        <div className="mx-auto w-full max-w-2xl">
          {tab === "connectors" && <ConnectorsPanel />}
          {tab === "skills" && <SkillsPanel />}
          {tab === "plugins" && <PluginsPanel />}
        </div>
      </main>
    </div>
  );
}

function ConnectorsPanel() {
  return (
    <>
      <div className="mb-10 flex flex-col items-center gap-5 text-center">
        <div className="rounded-full border border-border bg-card/40 p-5">
          <Briefcase className="h-9 w-9 text-foreground/80" strokeWidth={1.4} />
        </div>
        <div>
          <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight">
            Customize the agent
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Skills, connectors, and plugins shape how the agent works with you.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card/40 px-5 py-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/40">
            <Plug className="h-4 w-4" />
          </div>
          <div className="text-[14px] font-medium">Connect your apps</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Let the agent read and write to the tools you already use.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/40 px-5 py-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/40">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="text-[14px] font-medium">Create new skills</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Teach the agent your processes, norms, and expertise.
          </p>
        </div>
      </div>

      <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Built-in tool connectors
      </h2>
      <div className="space-y-2">
        <ConnectorCard
          id="filesystem"
          label="Sandbox filesystem"
          desc="read_file · write_file · apply_patch · list_dir · tree · search_text — scoped to this conversation's sandbox."
        />
        <ConnectorCard
          id="shell"
          label="Shell"
          desc="run_shell — execute any command (npm, pip, git, build, test) inside the sandbox."
        />
        <ConnectorCard
          id="subagent"
          label="Subagent dispatch"
          desc="dispatch_subagent — spawn a focused subagent with the same toolset for parallel chunks of work."
        />
        <ConnectorCard
          id="web"
          label="Web fetch"
          desc="download_url — fetch and read any URL (docs, APIs, packages, web resources)."
        />
        <ConnectorCard
          id="todos"
          label="Todo list"
          desc="todo_write — structured task tracking stored in .agent/todos.json inside the sandbox."
        />
      </div>
    </>
  );
}

function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkills());
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [adding, setAdding] = useState(false);

  const update = (next: Skill[]) => {
    setSkills(next);
    saveSkills(next);
  };

  const toggle = (id: string) =>
    update(skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));

  const remove = (id: string) => update(skills.filter((s) => s.id !== id));

  const saveEdit = (id: string, name: string, prompt: string) => {
    update(skills.map((s) => (s.id === id ? { ...s, name, prompt } : s)));
    setEditing(null);
  };

  const addSkill = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    update([
      ...skills,
      {
        id: `skill-${Date.now()}`,
        name: newName.trim(),
        prompt: newPrompt.trim(),
        enabled: true,
      },
    ]);
    setNewName("");
    setNewPrompt("");
    setAdding(false);
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1 font-serif text-3xl font-semibold tracking-tight">Skills</h1>
          <p className="text-[14px] text-muted-foreground">
            Named system-prompt snippets. When enabled they are prepended to every
            conversation, shaping agent behaviour.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="hover-elevate active-elevate-2 mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card/40 px-3 py-1.5 text-[12.5px] text-foreground/85 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          New skill
        </button>
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-card/40 p-4 space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Skill name…"
            className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] font-medium focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={3}
            placeholder="System prompt addition — instructions prepended to every conversation when this skill is active…"
            className="slim-scroll w-full resize-none rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setNewName(""); setNewPrompt(""); }}
              className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-[12.5px] transition"
            >
              Cancel
            </button>
            <button
              onClick={addSkill}
              disabled={!newName.trim() || !newPrompt.trim()}
              className="rounded-lg border border-primary-border bg-primary px-3 py-1.5 text-[12.5px] text-primary-foreground transition disabled:opacity-40"
            >
              Add skill
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {skills.map((skill) =>
          editing === skill.id ? (
            <SkillEditCard
              key={skill.id}
              skill={skill}
              onSave={(name, prompt) => saveEdit(skill.id, name, prompt)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => toggle(skill.id)}
              onEdit={() => setEditing(skill.id)}
              onRemove={() => remove(skill.id)}
            />
          ),
        )}
        {skills.length === 0 && !adding && (
          <div className="rounded-xl border border-border bg-card/20 px-5 py-8 text-center text-[13px] text-muted-foreground">
            No skills yet. Create one to shape how the agent behaves.
          </div>
        )}
      </div>
    </>
  );
}

function PluginsPanel() {
  return (
    <div className="text-center">
      <div className="mb-5 inline-flex rounded-full border border-border bg-card/40 p-5">
        <Puzzle className="h-9 w-9 text-foreground/80" strokeWidth={1.4} />
      </div>
      <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight">Plugins</h1>
      <p className="mb-8 text-[14px] text-muted-foreground">
        Extend the agent with third-party plugins. Coming soon.
      </p>
      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { name: "GitHub", desc: "Read and write to your repos" },
          { name: "Google Drive", desc: "Access your documents" },
          { name: "Linear", desc: "Manage issues and projects" },
          { name: "Slack", desc: "Read and send messages" },
        ].map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="mb-1 text-[13px] font-medium">{p.name}</div>
            <div className="text-[12px] text-muted-foreground">{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onToggle,
  onEdit,
  onRemove,
}: {
  skill: Skill;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border bg-card/40 px-5 py-4 transition ${
        skill.enabled ? "border-primary/30" : "border-border"
      }`}
    >
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[14px] font-medium">{skill.name}</span>
          {skill.enabled && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              Active
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-muted-foreground line-clamp-2">{skill.prompt}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onEdit}
          className="hover-elevate-2 rounded-md p-1.5 text-muted-foreground transition hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="hover-elevate-2 rounded-md p-1.5 text-muted-foreground transition hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Toggle on={skill.enabled} onToggle={onToggle} />
      </div>
    </div>
  );
}

function SkillEditCard({
  skill,
  onSave,
  onCancel,
}: {
  skill: Skill;
  onSave: (name: string, prompt: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(skill.name);
  const [prompt, setPrompt] = useState(skill.prompt);
  return (
    <div className="rounded-xl border border-primary/40 bg-card/40 p-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] font-medium focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="slim-scroll w-full resize-none rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-[12.5px] transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onSave(name, prompt)}
          disabled={!name.trim() || !prompt.trim()}
          className="rounded-lg border border-primary-border bg-primary px-3 py-1.5 text-[12.5px] text-primary-foreground transition disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ConnectorCard({ id, label, desc }: { id: string; label: string; desc: string }) {
  const key = `coding-agent.connector.${id}`;
  const initialOn =
    typeof localStorage !== "undefined" ? localStorage.getItem(key) !== "false" : true;
  const [on, setOn] = useState(initialOn);
  const handleToggle = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {}
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card/40 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary/40">
        <Plug className="h-4 w-4 text-foreground/85" />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-medium">{label}</div>
        <div className="text-[12.5px] text-muted-foreground">{desc}</div>
      </div>
      <Toggle on={on} onToggle={handleToggle} />
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      style={{ background: on ? "hsl(var(--accent))" : "hsl(var(--secondary))" }}
      className="relative h-5 w-9 shrink-0 rounded-full transition"
    >
      <span
        style={{ left: on ? "18px" : "2px" }}
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
      />
    </button>
  );
}
