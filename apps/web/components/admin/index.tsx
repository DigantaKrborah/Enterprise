"use client";

import React, { useState, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

const ADMIN_NAV = [
  { id: "users",  label: "Users",         icon: Icon.users },
  { id: "depts",  label: "Departments",   icon: Icon.shield },
  { id: "llm",    label: "LLM Config",    icon: Icon.cpu },
  { id: "bugs",   label: "Bug Reports",   icon: Icon.bug },
  { id: "health", label: "System Health", icon: Icon.health },
] as const;

type SubTab = typeof ADMIN_NAV[number]["id"];

function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em" }}>{title}</h1>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{children}</div>
    </div>
  );
}

const tdA: React.CSSProperties = { padding: "11px 10px", fontSize: 12.8, verticalAlign: "middle" };
const thA: React.CSSProperties = { padding: "10px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }} className="tnum">{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  departments: { id: string; name: string } | null;
}

interface LlmConfig {
  defaultLlm: string;
  complexThreshold: number;
  ollamaModel: string;
  claudeModel: string;
  ollamaBaseUrl: string;
  embedModel: string;
}

interface LlmStats {
  totalLlmCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  modelBreakdown: Array<{ model: string; count: number }>;
}

interface BugReport {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string }>;
  html_url: string;
  user: { login: string };
  created_at: string;
}

interface HealthChecks {
  supabase: { ok: boolean; latencyMs?: number };
  elasticsearch: { ok: boolean; latencyMs?: number };
  ollama: { ok: boolean };
}

interface HealthResponse {
  ok: boolean;
  checks: HealthChecks;
}

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/* ── Users ── */
function UsersTab() {
  const toast = useToast();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json() as { data: ApiUser[] };
      setUsers(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  const toggle = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.is_active }),
    });
    await fetchUsers();
  };

  const inviteUser = async () => {
    const email = window.prompt("Email:");
    if (!email) return;
    const res = await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName: "", role: "employee" }),
    });
    if (res.ok) {
      toast({ title: "Invite sent", body: "An invitation email is on its way.", tone: "green" });
    }
  };

  return (
    <>
      <PageHeader title="Users" sub={`${users.filter((u) => u.is_active).length} active · ${users.length} total`}>
        <Button icon={<Icon.plus size={16} sw={2} />} onClick={() => { void inviteUser(); }}>Invite user</Button>
      </PageHeader>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface-1)" }}>
            <th style={{ ...thA, paddingLeft: 16 }}>User</th><th style={thA}>Role</th><th style={thA}>Department</th><th style={thA}>Last active</th><th style={{ ...thA, textAlign: "right", paddingRight: 16 }}>Active</th>
          </tr></thead>
          <tbody>
            {!loading && users.map((u) => (
              <tr key={u.id} className="doc-row" style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...tdA, paddingLeft: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <Avatar name={u.full_name ?? u.email} size={32} />
                    <div>
                      <div style={{ fontSize: 13.3, fontWeight: 550 }}>{u.full_name ?? u.email}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)" }} className="mono">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={tdA}><Badge tone={u.role === "super_admin" || u.role === "admin" ? "violet" : "gray"}>{toTitleCase(u.role)}</Badge></td>
                <td style={{ ...tdA, color: "var(--text-1)" }}>{u.departments?.name ?? "—"}</td>
                <td style={{ ...tdA, color: "var(--text-muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ ...tdA, textAlign: "right", paddingRight: 16 }}>
                  <div style={{ display: "inline-flex" }}><Switch checked={u.is_active} onChange={() => { void toggle(u.id); }} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Departments ── */
function DeptsTab() {
  const [users, setUsers] = useState<ApiUser[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json() as { data: ApiUser[] };
      setUsers(json.data);
    })();
  }, []);

  const deptMap = new Map<string, { name: string; count: number }>();
  for (const u of users) {
    if (u.departments) {
      const existing = deptMap.get(u.departments.id);
      if (existing) {
        existing.count += 1;
      } else {
        deptMap.set(u.departments.id, { name: u.departments.name, count: 1 });
      }
    }
  }

  const DEPT_COLORS: Record<string, string> = {
    Operations: "var(--blue)",
    HR: "var(--violet)",
  };
  const DEFAULT_COLOR = "var(--green)";

  const depts = Array.from(deptMap.values()).map((d) => ({
    name: d.name,
    users: d.count,
    docs: 0,
    color: DEPT_COLORS[d.name] ?? DEFAULT_COLOR,
  }));

  return (
    <>
      <PageHeader title="Departments" sub="Access scopes that segment documents and conversations">
        <Button icon={<Icon.plus size={16} sw={2} />}>Add department</Button>
      </PageHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {depts.map((d) => (
          <div key={d.name} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
              <span style={{ fontSize: 15, fontWeight: 650 }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <Stat label="Members" value={d.users} />
              <Stat label="Documents" value={d.docs} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── LLM Config ── */
function LLMTab() {
  const toast = useToast();
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [stats, setStats] = useState<LlmStats | null>(null);

  useEffect(() => {
    void (async () => {
      const [cfgRes, statsRes] = await Promise.all([
        fetch("/api/admin/llm-config"),
        fetch("/api/admin/stats"),
      ]);
      const cfgJson = await cfgRes.json() as { data: LlmConfig };
      const statsJson = await statsRes.json() as { data: LlmStats };
      setConfig(cfgJson.data);
      setStats(statsJson.data);
    })();
  }, []);

  const llms = config
    ? [
        {
          id: "ollama",
          name: "Ollama",
          tag: "On-prem",
          model: config.ollamaModel,
          host: config.ollamaBaseUrl,
          desc: "Local open-source model served via Ollama. Zero data egress.",
          active: true,
          calls: stats?.totalLlmCalls ?? 0,
          tokens: stats?.totalTokens ?? 0,
        },
        {
          id: "claude",
          name: "Anthropic Claude",
          tag: "Cloud",
          model: config.claudeModel,
          host: "api.anthropic.com",
          desc: "Cloud LLM used for complex queries above the routing threshold.",
          active: true,
          calls: stats?.totalLlmCalls ?? 0,
          tokens: stats?.totalTokens ?? 0,
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="LLM Configuration" sub="Toggle providers and set per-request token budgets" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {llms.map((l) => (
          <div key={l.id} className="card" style={{ padding: 18, borderColor: l.active ? "var(--border-1)" : "var(--border)", opacity: l.active ? 1 : 0.72, transition: "all .2s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", flexShrink: 0, background: l.active ? "linear-gradient(145deg, var(--violet-dim), var(--blue-dim))" : "var(--surface-2)", border: "1px solid var(--border-1)", color: l.tag === "On-prem" ? "var(--green)" : "var(--blue-bright)" }}>
                <Icon.cpu size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 15, fontWeight: 650 }}>{l.name}</span>
                  <Badge tone={l.tag === "On-prem" ? "green" : "blue"}>{l.tag}</Badge>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{l.model}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{l.desc}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: l.active ? "var(--green)" : "var(--text-faint)" }}>{l.active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <div className="divider" style={{ margin: "16px 0 14px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 24 }}>
                <Stat label="Total Calls" value={l.calls} />
                <Stat label="Total Tokens" value={l.tokens} />
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-faint)" }}>
                <Icon.shield size={13} /> {l.host}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Button onClick={() => toast({ title: "Changes require environment variable update", body: "Update your .env file and restart the service to apply LLM config changes.", tone: "blue" })}>Save changes</Button>
      </div>
    </>
  );
}

/* ── Bug Reports ── */
function BugsTab() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/bug-reports");
        const json = await res.json() as { data: BugReport[] };
        setBugs(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sevTone: Record<string, "red" | "amber" | "gray"> = { Critical: "red", High: "red", Medium: "amber", Low: "gray" };
  const statusTone: Record<string, "blue" | "green"> = { open: "blue", closed: "green" };

  const getSeverity = (labels: Array<{ name: string }>): string => {
    for (const l of labels) {
      const lower = l.name.toLowerCase();
      if (lower.includes("critical")) return "Critical";
      if (lower.includes("high")) return "High";
      if (lower.includes("medium")) return "Medium";
      if (lower.includes("low")) return "Low";
    }
    return "Medium";
  };

  return (
    <>
      <PageHeader title="Bug Reports" sub="Synced with the GitHub issue tracker">
        <a
          href="https://github.com/DigantaKrborah/Enterprise/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ gap: 6, textDecoration: "none" }}
        >
          <Icon.ext size={14} /> View on GitHub
        </a>
      </PageHeader>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface-1)" }}>
            <th style={{ ...thA, paddingLeft: 16 }}>Issue</th><th style={thA}>Severity</th><th style={thA}>Status</th><th style={thA}>Reporter</th><th style={thA}>Date</th>
          </tr></thead>
          <tbody>
            {!loading && bugs.map((b) => {
              const sev = getSeverity(b.labels);
              const statusLabel = b.state === "open" ? "Open" : "Closed";
              return (
                <tr key={b.number} className="doc-row" style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }} onClick={() => window.open(b.html_url, "_blank")}>
                  <td style={{ ...tdA, paddingLeft: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--blue-bright)", fontWeight: 600 }}>{`ISS-${b.number}`}</span>
                      <span style={{ fontSize: 13.2, color: "var(--text-1)" }}>{b.title}</span>
                    </div>
                  </td>
                  <td style={tdA}><Badge tone={sevTone[sev]}>{sev}</Badge></td>
                  <td style={tdA}><Badge tone={statusTone[b.state] ?? "gray"}>{statusLabel}</Badge></td>
                  <td style={{ ...tdA, color: "var(--text-1)" }}>{b.user.login}</td>
                  <td style={{ ...tdA, color: "var(--text-muted)" }} className="tnum">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── System Health ── */
function HealthTab() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const json = await res.json() as HealthResponse;
      setHealth(json);
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => { void fetchHealth(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const services: Array<{ name: string; ok: boolean; latencyMs?: number; detail: string }> = health
    ? [
        {
          name: "Supabase",
          ok: health.checks.supabase.ok,
          latencyMs: health.checks.supabase.latencyMs,
          detail: "PostgreSQL + pgvector database",
        },
        {
          name: "Elasticsearch",
          ok: health.checks.elasticsearch.ok,
          latencyMs: health.checks.elasticsearch.latencyMs,
          detail: "Full-text and hybrid search index",
        },
        {
          name: "Ollama",
          ok: health.checks.ollama.ok,
          latencyMs: undefined,
          detail: "Local LLM inference server",
        },
        {
          name: "Embedding worker",
          ok: health.checks.ollama.ok,
          latencyMs: undefined,
          detail: "nomic-embed-text via Ollama",
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="System Health" sub="Last checked — auto-refresh 30s">
        <Button variant="ghost" icon={<Icon.refresh size={15} />} onClick={() => { void fetchHealth(); }}>Refresh</Button>
      </PageHeader>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {services.map((h) => {
          const ok = h.ok;
          const color = ok ? "var(--green)" : "var(--amber)";
          return (
            <div key={h.name} className="card" style={{ padding: 17 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 650 }}>{h.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                  {ok ? "Operational" : "Degraded"}
                </span>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)" }}>{h.detail}</p>
              <div className="divider" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                  {health ? new Date().toLocaleTimeString() : "—"}
                </span>
                {h.latencyMs !== undefined && (
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-1)" }}>{h.latencyMs}ms</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Admin Panel ── */
export function AdminPanel() {
  const [sub, setSub] = useState<SubTab>("users");
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <aside style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--surface)", padding: "18px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 10px 12px" }}>Administration</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {ADMIN_NAV.map((n) => {
            const active = sub === n.id;
            return (
              <button key={n.id} onClick={() => setSub(n.id)} className={"subnav" + (active ? " on" : "")}>
                {active && <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 2.5, borderRadius: 2, background: "var(--blue)" }} />}
                <n.icon size={16} sw={1.8} /> {n.label}
              </button>
            );
          })}
        </div>
      </aside>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "28px 28px 60px" }}>
          {sub === "users"  && <UsersTab />}
          {sub === "depts"  && <DeptsTab />}
          {sub === "llm"    && <LLMTab />}
          {sub === "bugs"   && <BugsTab />}
          {sub === "health" && <HealthTab />}
        </div>
      </div>
    </div>
  );
}
