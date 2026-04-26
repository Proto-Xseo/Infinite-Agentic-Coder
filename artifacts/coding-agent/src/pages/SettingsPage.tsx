import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-sidebar/60 px-3 py-5">
        <Link
          href="/"
          className="hover-elevate active-elevate-2 mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to chat
        </Link>
        <nav className="space-y-0.5">
          <button
            type="button"
            className="block w-full rounded-md bg-foreground/[0.05] px-3 py-2 text-left text-[13px] font-medium text-foreground"
          >
            General
          </button>
        </nav>
      </aside>

      <main className="slim-scroll flex-1 overflow-y-auto px-12 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <GeneralPanel />
        </div>
      </main>
    </div>
  );
}

function GeneralPanel() {
  const [callMe, setCallMe] = useState(() => localStorage.getItem("settings.callMe") ?? "");
  const [prefs, setPrefs] = useState(() => localStorage.getItem("settings.prefs") ?? "");

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Profile
        </h2>
        <Field label="What should the agent call you?">
          <input
            value={callMe}
            onChange={(e) => {
              setCallMe(e.target.value);
              localStorage.setItem("settings.callMe", e.target.value);
            }}
            placeholder="Your name"
            className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Field>
        <div className="mt-4">
          <Field
            label="What personal preferences should the agent consider in responses?"
            help="Saved locally and prepended to every conversation's system prompt."
          >
            <textarea
              value={prefs}
              onChange={(e) => {
                setPrefs(e.target.value);
                localStorage.setItem("settings.prefs", e.target.value);
              }}
              rows={5}
              placeholder="e.g. keep explanations brief and to the point"
              className="slim-scroll w-full resize-none rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          About this build
        </h2>
        <div className="space-y-2 rounded-lg border border-border bg-card/40 px-4 py-3 text-[12.5px] text-muted-foreground">
          <Row k="Provider" v="Replit AI Integrations · Anthropic proxy" />
          <Row k="Model" v="claude-sonnet-4-6" />
          <Row k="Sandbox" v="Per-conversation isolated filesystem" />
          <Row k="Subagents" v="Enabled (orchestrator → focused subagent)" />
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{k}</span>
      <span className="font-mono text-foreground/85">{v}</span>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] text-muted-foreground">{label}</span>
      {children}
      {help ? <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{help}</span> : null}
    </label>
  );
}
