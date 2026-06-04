"use client";

import React, { useState } from "react";
import { DOCS, Doc } from "@/lib/data";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

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

function TypeTag({ type }: { type: string }) {
  const color = ({ PDF: "#f87171", DOCX: "#60a5fa", XLSX: "#34d399" } as Record<string, string>)[type] || "var(--text-muted)";
  return <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", color, padding: "2px 6px", borderRadius: 5, background: "var(--surface-2)", border: "1px solid var(--border-1)" }}>{type}</span>;
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
              <button key={o} onClick={() => { setValue(o); setOpen(false); }} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "7px 9px", borderRadius: 6, border: 0,
                background: "transparent", cursor: "pointer", fontSize: 12.5, color: "var(--text-1)", textAlign: "left",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {o} {value === o && <Icon.check size={14} style={{ color: "var(--blue-bright)" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterBar({ dept, setDept, ftype, setFtype, q, setQ }: { dept: string; setDept: (v: string) => void; ftype: string; setFtype: (v: string) => void; q: string; setQ: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}><Icon.search size={15} /></span>
        <input className="field" style={{ height: 36, paddingLeft: 34, fontSize: 13 }} placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Dropdown label="Department" value={dept} setValue={setDept} options={["All", "Operations", "HR"]} />
      <Dropdown label="Type" value={ftype} setValue={setFtype} options={["All", "PDF", "DOCX", "XLSX"]} />
      <button className="btn btn-ghost btn-sm" style={{ gap: 6 }}><Icon.clock size={14} /> Date range</button>
    </div>
  );
}

function UploadZone({ onClose, onUpload }: { onClose: () => void; onUpload: () => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="card fade-up" style={{ padding: 0, marginBottom: 16, overflow: "hidden", borderColor: "var(--border-1)" }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onUpload(); }}
        style={{
          margin: 12, padding: "30px 20px", borderRadius: "var(--r-md)", textAlign: "center",
          border: `1.5px dashed ${drag ? "var(--blue)" : "var(--border-strong)"}`,
          background: drag ? "var(--blue-dim)" : "var(--surface)", transition: "all .15s", cursor: "pointer",
        }}
        onClick={onUpload}
      >
        <div style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border-1)", color: "var(--blue-bright)", marginBottom: 12 }}>
          <Icon.upload size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Drop files here or click to browse</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5 }}>PDF, DOCX, XLSX up to 50 MB · auto-indexed on upload</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

const td: React.CSSProperties = { padding: "11px 10px", fontSize: 12.8, verticalAlign: "middle" };
const tdName: React.CSSProperties = { ...td, paddingLeft: 16, maxWidth: 320 };
const th: React.CSSProperties = { padding: "10px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };

function DocRow({ d, expanded, onToggle }: { d: Doc; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="doc-row" onClick={onToggle} style={{ cursor: "pointer", borderTop: "1px solid var(--border)" }}>
        <td style={tdName}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon.chevron size={14} style={{ color: "var(--text-faint)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            <div style={{ width: 30, height: 30, borderRadius: 7, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-1)", color: d.dept === "HR" ? "var(--violet-bright)" : "var(--blue-bright)" }}>
              <Icon.file size={15} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.3, fontWeight: 550, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{d.pages} pages · {d.size}</div>
            </div>
          </div>
        </td>
        <td style={td}><Badge tone={d.dept === "HR" ? "violet" : "blue"}>{d.dept}</Badge></td>
        <td style={td}><TypeTag type={d.type} /></td>
        <td style={{ ...td, color: "var(--text-1)" }} className="mono">{d.version}</td>
        <td style={td}><StatusBadge status={d.status} /></td>
        <td style={{ ...td, color: "var(--text-1)" }}>{d.by}</td>
        <td style={{ ...td, color: "var(--text-muted)" }} className="tnum">{d.date}</td>
        <td style={{ ...td, textAlign: "right", paddingRight: 16 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => e.stopPropagation()} style={{ width: 28, height: 28 }}>
            <Icon.dotsV size={15} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: "var(--surface)" }}>
            <div className="fade-in" style={{ padding: "4px 16px 16px 60px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 8px", display: "flex", alignItems: "center", gap: 7 }}>
                <Icon.history size={13} /> Version history
              </div>
              {d.error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 10, fontSize: 12.5, color: "#f87171" }}>
                  <Icon.bug size={14} /> Indexing failed — {d.error}
                  <button className="btn btn-sm btn-danger" style={{ marginLeft: "auto" }}><Icon.refresh size={13} /> Retry</button>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {d.versions.map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? "1px solid var(--border)" : undefined }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--blue-bright)" : "var(--text-muted)", width: 42 }}>{v.v}</span>
                    {i === 0 && <Badge tone="blue">current</Badge>}
                    <span style={{ fontSize: 12.5, color: "var(--text-1)", flex: 1 }}>{v.note}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{v.by}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-faint)" }} className="tnum">{v.date}</span>
                    <button className="btn btn-ghost btn-sm">Restore</button>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DocCard({ d }: { d: Doc }) {
  return (
    <div className="doc-card card" style={{ padding: 16, cursor: "pointer", transition: "all .15s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-1)", color: d.dept === "HR" ? "var(--violet-bright)" : "var(--blue-bright)" }}>
          <Icon.file size={18} />
        </div>
        <StatusBadge status={d.status} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 10, minHeight: 36 }}>{d.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Badge tone={d.dept === "HR" ? "violet" : "blue"}>{d.dept}</Badge>
        <TypeTag type={d.type} />
        <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{d.version}</span>
      </div>
      <div className="divider" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11, fontSize: 11, color: "var(--text-faint)" }}>
        <span>{d.by}</span><span className="tnum">{d.date}</span>
      </div>
    </div>
  );
}

export function DocumentLibrary() {
  const toast = useToast();
  const [view, setView] = useState("table");
  const [dept, setDept] = useState("All");
  const [ftype, setFtype] = useState("All");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const rows = DOCS.filter((d) =>
    (dept === "All" || d.dept === dept) &&
    (ftype === "All" || d.type === ftype) &&
    (!q || d.name.toLowerCase().includes(q.toLowerCase()))
  );
  const counts = { indexed: DOCS.filter((d) => d.status === "Indexed").length, processing: DOCS.filter((d) => d.status === "Processing").length, failed: DOCS.filter((d) => d.status === "Failed").length };

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 60px" }}>
        <PageHeader title="Document Library" sub={`${DOCS.length} documents · ${counts.indexed} indexed, ${counts.processing} processing, ${counts.failed} failed`}>
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: "table", label: "Table" }, { value: "grid", label: "Grid" }]} />
          <Button icon={<Icon.upload size={16} />} onClick={() => setShowUpload((s) => !s)}>Upload</Button>
        </PageHeader>

        {showUpload && (
          <UploadZone
            onClose={() => setShowUpload(false)}
            onUpload={() => { setShowUpload(false); toast({ title: "Upload queued", body: "2 files added to the indexing queue.", tone: "blue", icon: <Icon.upload size={16} /> }); }}
          />
        )}

        <FilterBar dept={dept} setDept={setDept} ftype={ftype} setFtype={setFtype} q={q} setQ={setQ} />

        {view === "table" ? (
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
                {rows.map((d) => (
                  <DocRow key={d.id} d={d} expanded={expanded === d.id} onToggle={() => setExpanded((e) => e === d.id ? null : d.id)} />
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No documents match your filters.</div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 14 }}>
            {rows.map((d) => <DocCard key={d.id} d={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
