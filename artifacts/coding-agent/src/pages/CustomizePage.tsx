import { Link } from "wouter";
import { ArrowLeft, Plug, Briefcase } from "lucide-react";

export default function CustomizePage() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-sidebar/60 px-3 py-5">
        <Link
          href="/"
          className="hover-elevate active-elevate-2 mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Customize
        </Link>
        <nav className="space-y-0.5">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md bg-foreground/[0.05] px-3 py-2 text-left text-[13px] font-medium text-foreground"
          >
            <Plug className="h-4 w-4" />
            Connectors
          </button>
        </nav>
      </aside>

      <main className="slim-scroll flex flex-1 items-start justify-center overflow-y-auto px-12 py-16">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-10 flex flex-col items-center gap-5 text-center">
            <div className="rounded-full border border-border bg-card/40 p-5">
              <Briefcase className="h-9 w-9 text-foreground/80" strokeWidth={1.4} />
            </div>
            <div>
              <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight">
                Customize the agent
              </h1>
              <p className="text-[14px] text-muted-foreground">
                Connectors expose real tool capabilities to the agent. Toggle the ones you want
                available for this conversation.
              </p>
            </div>
          </div>

          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in connectors
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
          </div>
        </div>
      </main>
    </div>
  );
}

function ConnectorCard({ id, label, desc }: { id: string; label: string; desc: string }) {
  const key = `coding-agent.connector.${id}`;
  const initialOn =
    typeof localStorage !== "undefined" ? localStorage.getItem(key) !== "false" : true;
  const set = (on: boolean) => {
    try {
      localStorage.setItem(key, String(on));
    } catch {
      // ignore
    }
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
      <Toggle defaultOn={initialOn} onToggle={set} />
    </div>
  );
}

function Toggle({
  defaultOn,
  onToggle,
}: {
  defaultOn: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      defaultValue={String(defaultOn)}
      onClick={(e) => {
        const btn = e.currentTarget;
        const next = btn.dataset.on !== "true";
        btn.dataset.on = String(next);
        btn.querySelector("span")!.style.left = next ? "18px" : "2px";
        btn.style.background = next ? "hsl(var(--accent))" : "hsl(var(--secondary))";
        onToggle(next);
      }}
      data-on={String(defaultOn)}
      style={{
        background: defaultOn ? "hsl(var(--accent))" : "hsl(var(--secondary))",
      }}
      className="relative h-5 w-9 shrink-0 rounded-full transition"
    >
      <span
        style={{ left: defaultOn ? "18px" : "2px" }}
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
      />
    </button>
  );
}
