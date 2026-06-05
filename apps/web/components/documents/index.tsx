"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; }
interface Uploader   { id: string; full_name: string; email: string; }
interface Doc {
  id: string; name: string; original_name: string;
  department_id: string; file_type: string; version: number;
  status: "queued" | "processing" | "indexed" | "failed";
  error_msg: string | null; size_bytes: number; page_count: number | null;
  created_at: string; is_deleted: boolean;
  departments: Department;
  users: Uploader;
}
interface Version {
  id: string; version: number; status: string;
  size_bytes: number; page_count: number | null; created_at: string;
  users: { full_name: string; email: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeTag({ type }: { type: string }) {
  const label = type.toUpperCase().replace("_", " ");
  const color = ({ PDF: "#f87171", SCANNED_PDF: "#f97316", DOCX: "#60a5fa", XLSX: "#34d399" } as Record<string, string>)[label.replace(" ", "_")] ?? "var(--text-muted)";
  return (
    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", color, padding: "2px 6px", borderRadius: 5, background: "var(--surface-2)", border: "1px solid var(--border-1)" }}>
      {label}
    </span>
  );
}

function Dropdown({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-sm" style={{ gap: 7 }}>
        <span style={{ color: "var(--text-faint)" }}>{label}:</span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span>
        <Icon.chevronD size={13} style={{ color: "var(--text-faint)" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div className="card fade-in" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 31, minWidth: 140, padding: 5, background: "var(--surface-2)", boxShadow: "var(--shadow-pop)", borderColor: "var(--border-1)" }}>
            {options.map((o) => (
              <button key={o} onClick={() => { setValue(o); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "7px 9px", borderRadius: 6, border: 0, background: "transparent", cursor: "pointer", fontSize: 12.5, color: "var(--text-1)", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                {o} {value === o && <Icon.check size={14} style={{ color: "var(--blue-bright)" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UploadZone({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      if (profile?.departmentId) form.append("departmentId", profile.departmentId);
      const res = await fetch("/api/ingest/upload", { method: "POST", body: form });
      if (res.ok) {
        toast({ title: "Upload queued", body: `${file.name} — indexing started.`, tone: "blue", icon: <Icon.upload size={16} /> });
      } else {
        const err = await res.json() as { error?: { message?: string } };
        toast({ title: "Upload failed", body: err.error?.message ?? "Unknown error", tone: "red" });
      }
    }
    setUploading(false);
    onUploaded();
    onClose();
  };

  return (
    <div className="card fade-up" style={{ padding: 0, marginBottom: 16, overflow: "hidden", borderColor: "var(--border-1)" }}>
      <label style={{ display: "block" }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          style={{ margin: 12, padding: "30px 20px", borderRadius: "var(--r-md)", textAlign: "center", border: `1.5px dashed ${drag ? "var(--blue)" : "var(--border-strong)"}`, background: drag ? "var(--blue-dim)" : "var(--surface)", transition: "all .15s", cursor: "pointer" }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border-1)", color: "var(--blue-bright)", marginBottom: 12 }}>
            {uploading ? <div style={{ animation: "spin .8s linear infinite" }}><Icon.refresh size={20} /></div> : <Icon.upload size={20} />}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{uploading ? "Uploading…" : "Drop files here or click to browse"}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5 }}>PDF, DOCX, XLSX up to 50 MB · auto-indexed on upload</div>
          <input type="file" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.tiff" style={{ display: "none" }} onChange={(e) => upload(e.target.files)} disabled={uploading} />
        </div>
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

const td: React.CSSProperties  = { padding: "11px 10px", fontSize: 12.8, verticalAlign: "middle" };
const tdName: React.CSSProperties = { ...td, paddingLeft: 16, maxWidth: 320 };
const th: React.CSSProperties  = { padding: "10px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };

function DocRow({ d, expanded, onToggle, onDelete, canDelete }: { d: Doc; expanded: boolean; onToggle: () => void; onDelete: (id: string) => void; canDelete: boolean }) {
  const [versions, setVersions] = useState<Version[] | null>(null);

  const loadVersions = async () => {
    if (versions) return;
    const res = await fetch(`/api/documents/${d.id}/versions`);
    if (res.ok) { const { data } = await res.json() as { data: Version[] }; setVersions(data); }
  };

  const handleToggle = () => { onToggle(); if (!expanded) loadVersions(); };

  return (
    <>
      <tr className="doc-row" onClick={handleToggle} style={{ cursor: "pointer", borderTop: "1px solid var(--border)" }}>
        <td style={tdName}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon.chevron size={14} style={{ color: "var(--text-faint)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            <div style={{ width: 30, height: 30, borderRadius: 7, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-1)", color: d.departments?.name === "HR" ? "var(--violet-bright)" : "var(--blue-bright)" }}>
              <Icon.file size={15} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.3, fontWeight: 550, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name || d.original_name}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{d.page_count ? `${d.page_count} pages · ` : ""}{fmt(d.size_bytes)}</div>
            </div>
          </div>
        </td>
        <td style={td}><Badge tone={d.departments?.name === "HR" ? "violet" : "blue"}>{d.departments?.name ?? "—"}</Badge></td>
        <td style={td}><TypeTag type={d.file_type} /></td>
        <td style={{ ...td, color: "var(--text-1)" }} className="mono">v{d.version}</td>
        <td style={td}><StatusBadge status={d.status.charAt(0).toUpperCase() + d.status.slice(1)} /></td>
        <td style={{ ...td, color: "var(--text-1)" }}>{d.users?.full_name ?? d.users?.email ?? "—"}</td>
        <td style={{ ...td, color: "var(--text-muted)" }} className="tnum">{fmtDate(d.created_at)}</td>
        <td style={{ ...td, textAlign: "right", paddingRight: 16 }}>
          {canDelete && (
            <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); onDelete(d.id); }} style={{ width: 28, height: 28, color: "var(--red)" }} title="Delete">
              <Icon.trash size={14} />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: "var(--surface)" }}>
            <div className="fade-in" style={{ padding: "4px 16px 16px 60px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 8px", display: "flex", alignItems: "center", gap: 7 }}>
                <Icon.history size={13} /> Version history
              </div>
              {d.error_msg && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 10, fontSize: 12.5, color: "#f87171" }}>
                  <Icon.bug size={14} /> Indexing failed — {d.error_msg}
                </div>
              )}
              {versions === null ? (
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Loading…</div>
              ) : versions.map((v, i) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--blue-bright)" : "var(--text-muted)", width: 42 }}>v{v.version}</span>
                  {i === 0 && <Badge tone="blue">current</Badge>}
                  <span style={{ fontSize: 12.5, color: "var(--text-1)", flex: 1 }}>{v.users?.full_name ?? v.users?.email ?? "—"}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }} className="tnum">{fmtDate(v.created_at)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DocCard({ d, onDelete, canDelete }: { d: Doc; onDelete: (id: string) => void; canDelete: boolean }) {
  return (
    <div className="doc-card card" style={{ padding: 16, cursor: "pointer", transition: "all .15s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-1)", color: d.departments?.name === "HR" ? "var(--violet-bright)" : "var(--blue-bright)" }}>
          <Icon.file size={18} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <StatusBadge status={d.status.charAt(0).toUpperCase() + d.status.slice(1)} />
          {canDelete && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(d.id)} style={{ width: 24, height: 24, color: "var(--red)" }}><Icon.trash size={12} /></button>}
        </div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 10, minHeight: 36 }}>{d.name || d.original_name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Badge tone={d.departments?.name === "HR" ? "violet" : "blue"}>{d.departments?.name ?? "—"}</Badge>
        <TypeTag type={d.file_type} />
        <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>v{d.version}</span>
      </div>
      <div className="divider" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11, fontSize: 11, color: "var(--text-faint)" }}>
        <span>{d.users?.full_name ?? "—"}</span>
        <span className="tnum">{fmtDate(d.created_at)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentLibrary() {
  const toast = useToast();
  const { profile } = useAuth();
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState("table");
  const [dept, setDept]           = useState("All");
  const [ftype, setFtype]         = useState("All");
  const [q, setQ]                 = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const canDelete = profile?.role === "super_admin" || profile?.role === "dept_admin";

  const fetchDocs = useCallback(async () => {
    const params = new URLSearchParams();
    if (dept !== "All" && profile?.role === "super_admin") params.set("dept", dept);
    if (ftype !== "All") params.set("type", ftype.toLowerCase());
    if (q) params.set("q", q);
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) { const { data } = await res.json() as { data: Doc[] }; setDocs(data ?? []); }
    setLoading(false);
  }, [dept, ftype, q, profile?.role]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Poll every 5s while any doc is processing/queued
  useEffect(() => {
    const hasActive = docs.some((d) => d.status === "queued" || d.status === "processing");
    if (!hasActive) return;
    const t = setTimeout(fetchDocs, 5000);
    return () => clearTimeout(t);
  }, [docs, fetchDocs]);

  const deleteDoc = async (id: string) => {
    if (!confirm("Soft-delete this document? It can be restored by a super admin.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Document deleted", tone: "green" }); fetchDocs(); }
    else toast({ title: "Delete failed", tone: "red" });
  };

  const counts = {
    indexed:    docs.filter((d) => d.status === "indexed").length,
    processing: docs.filter((d) => d.status === "processing" || d.status === "queued").length,
    failed:     docs.filter((d) => d.status === "failed").length,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em" }}>Document Library</h1>
            {loading
              ? <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>Loading…</p>
              : <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                  {docs.length} documents · {counts.indexed} indexed{counts.processing > 0 ? `, ${counts.processing} processing` : ""}{counts.failed > 0 ? `, ${counts.failed} failed` : ""}
                </p>
            }
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Segmented size="sm" value={view} onChange={setView} options={[{ value: "table", label: "Table" }, { value: "grid", label: "Grid" }]} />
            <Button icon={<Icon.upload size={16} />} onClick={() => setShowUpload((s) => !s)}>Upload</Button>
          </div>
        </div>

        {showUpload && <UploadZone onClose={() => setShowUpload(false)} onUploaded={fetchDocs} />}

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}><Icon.search size={15} /></span>
            <input className="field" style={{ height: 36, paddingLeft: 34, fontSize: 13 }} placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {profile?.role === "super_admin" && (
            <Dropdown label="Department" value={dept} setValue={setDept} options={["All", "Operations", "HR"]} />
          )}
          <Dropdown label="Type" value={ftype} setValue={setFtype} options={["All", "PDF", "DOCX", "XLSX"]} />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
            <div className="skeleton" style={{ height: 14, width: "60%", margin: "0 auto 12px" }} />
            <div className="skeleton" style={{ height: 14, width: "40%", margin: "0 auto" }} />
          </div>
        )}

        {/* Table view */}
        {!loading && view === "table" && (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-1)" }}>
                  <th style={{ ...th, paddingLeft: 16 }}>Name</th>
                  <th style={th}>Dept</th><th style={th}>Type</th><th style={th}>Version</th>
                  <th style={th}>Status</th><th style={th}>Uploaded by</th><th style={th}>Date</th><th style={th} />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <DocRow key={d.id} d={d} expanded={expanded === d.id}
                    onToggle={() => setExpanded((e) => e === d.id ? null : d.id)}
                    onDelete={deleteDoc} canDelete={canDelete} />
                ))}
              </tbody>
            </table>
            {docs.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                No documents yet. Upload your first file.
              </div>
            )}
          </div>
        )}

        {/* Grid view */}
        {!loading && view === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 14 }}>
            {docs.map((d) => <DocCard key={d.id} d={d} onDelete={deleteDoc} canDelete={canDelete} />)}
          </div>
        )}
      </div>
    </div>
  );
}
