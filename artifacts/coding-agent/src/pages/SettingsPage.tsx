import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Github, HardDrive } from "lucide-react";

type SettingsTab = "general" | "account" | "capabilities" | "connectors";

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-sidebar/60 px-2 py-5">
        <Link
          href="/"
          className="hover-elevate active-elevate-2 mb-6 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to chat
        </Link>
        <nav className="space-y-0.5">
          {(
            [
              { id: "general" as const, label: "General" },
              { id: "account" as const, label: "Account" },
              { id: "capabilities" as const, label: "Capabilities" },
              { id: "connectors" as const, label: "Connectors" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-[13px] transition ${
                tab === t.id
                  ? "bg-foreground/[0.05] font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="slim-scroll flex-1 overflow-y-auto px-12 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          {tab === "general" && <GeneralPanel />}
          {tab === "account" && <AccountPanel />}
          {tab === "capabilities" && <CapabilitiesPanel />}
          {tab === "connectors" && <ConnectorsPanel />}
        </div>
      </main>
    </div>
  );
}

function GeneralPanel() {
  const [callMe, setCallMe] = useState(() => localStorage.getItem("settings.callMe") ?? "");
  const [prefs, setPrefs] = useState(() => localStorage.getItem("settings.prefs") ?? "");
  const [notifCompletion, setNotifCompletion] = useState(
    () => localStorage.getItem("settings.notif.completion") !== "false",
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-[18px] font-semibold">Profile</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Personalize how the agent addresses you.
        </p>
        <div className="space-y-4">
          <Field label="Full name">
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
          <Field label="What should the agent call you?">
            <input
              value={callMe}
              onChange={(e) => {
                setCallMe(e.target.value);
                localStorage.setItem("settings.callMe", e.target.value);
              }}
              placeholder="e.g. Xiao"
              className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
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
              rows={4}
              placeholder="e.g. keep explanations brief and to the point"
              className="slim-scroll w-full resize-none rounded-lg border border-border bg-card/40 px-3 py-2 text-[13px] focus:border-primary-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[18px] font-semibold">Notifications</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Control when you receive alerts from the agent.
        </p>
        <div className="space-y-3">
          <ToggleRow
            label="Response completions"
            desc="Get notified when the agent finishes a long-running task or tool call."
            on={notifCompletion}
            onToggle={(v) => {
              setNotifCompletion(v);
              localStorage.setItem("settings.notif.completion", String(v));
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-semibold">About this build</h2>
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

function AccountPanel() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-[18px] font-semibold">Account</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">Manage your account details.</p>
        <div className="rounded-lg border border-border bg-card/40 px-5 py-4 text-[13px] text-muted-foreground">
          Local account — data stored in this browser only.
        </div>
      </section>
    </div>
  );
}

function CapabilitiesPanel() {
  const [imageVision, setImageVision] = useState(
    () => localStorage.getItem("settings.cap.imageVision") !== "false",
  );
  const [extended, setExtended] = useState(
    () => localStorage.getItem("settings.cap.extendedThinking") !== "false",
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-[18px] font-semibold">Capabilities</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Toggle advanced agent features.
        </p>
        <div className="space-y-3">
          <ToggleRow
            label="Image and vision"
            desc="Allow the agent to see and analyze attached images."
            on={imageVision}
            onToggle={(v) => {
              setImageVision(v);
              localStorage.setItem("settings.cap.imageVision", String(v));
            }}
          />
          <ToggleRow
            label="Extended thinking"
            desc="Enable the agent to reason longer before responding (uses more tokens)."
            on={extended}
            onToggle={(v) => {
              setExtended(v);
              localStorage.setItem("settings.cap.extendedThinking", String(v));
            }}
          />
        </div>
      </section>
    </div>
  );
}

function ConnectorsPanel() {
  const connectors = [
    { id: "github", label: "GitHub Integration", icon: Github },
    { id: "gdrive", label: "Google Drive", icon: HardDrive },
  ];
  const [connected, setConnected] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("settings.connectors") ?? "{}");
    } catch {
      return {};
    }
  });
  const toggle = (id: string) => {
    const next = { ...connected, [id]: !connected[id] };
    setConnected(next);
    localStorage.setItem("settings.connectors", JSON.stringify(next));
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5 rounded-lg border border-border/60 bg-card/30 px-4 py-3">
          <p className="text-[13px] text-muted-foreground">
            Connectors have moved to Customize. Head to the new Customize page to manage your
            skills and connectors.{" "}
            <Link href="/customize" className="text-primary underline-offset-2 hover:underline">
              Go to Customize
            </Link>
          </p>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold">Connectors</h2>
            <p className="text-[13px] text-muted-foreground">
              Allow the agent to reference other apps and services for more context.
            </p>
          </div>
          <button className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-[12.5px] text-foreground/85 transition hover:bg-card/60">
            Browse connectors
          </button>
        </div>
        <div className="space-y-2">
          {connectors.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card/40 px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/40">
                <c.icon className="h-4 w-4" />
              </div>
              <span className="flex-1 text-[13px] font-medium">{c.label}</span>
              <button
                onClick={() => toggle(c.id)}
                className={`rounded-lg border px-4 py-1.5 text-[12.5px] font-medium transition ${
                  connected[c.id]
                    ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "border-border bg-card/40 text-foreground/85 hover:bg-card/60"
                }`}
              >
                {connected[c.id] ? "Disconnect" : "Connect"}
              </button>
            </div>
          ))}
        </div>
        <button className="mt-3 rounded-lg border border-dashed border-border bg-card/20 px-4 py-2.5 text-[12.5px] text-muted-foreground transition hover:text-foreground">
          + Add custom connector
        </button>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc: string;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => onToggle(!on)}
        style={{ background: on ? "hsl(var(--accent))" : "hsl(var(--secondary))" }}
        className="relative h-5 w-9 shrink-0 rounded-full transition"
      >
        <span
          style={{ left: on ? "18px" : "2px" }}
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
        />
      </button>
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
      {help ? (
        <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}
