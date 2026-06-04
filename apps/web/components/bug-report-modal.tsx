"use client";

import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Icon } from "./ui/icons";
import { useToast } from "./ui/toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BugReportModal({ open, onClose }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [sev, setSev] = useState("Medium");
  const [phase, setPhase] = useState<"form" | "creating" | "done">("form");
  const [issueNo, setIssueNo] = useState<number | null>(null);

  const reset = () => { setTitle(""); setDesc(""); setSteps(""); setSev("Medium"); setPhase("form"); setIssueNo(null); };
  const close = () => { onClose(); setTimeout(reset, 200); };

  const submit = () => {
    if (!title.trim()) return;
    setPhase("creating");
    setTimeout(() => {
      const n = 143 + Math.floor(Math.random() * 6);
      setIssueNo(n);
      setPhase("done");
      toast({ title: "GitHub issue created", body: `ISS-${n} opened in nrl/ragbot`, tone: "green", link: `View ISS-${n}`, icon: <Icon.bug size={16} /> });
    }, 1800);
  };

  return (
    <Modal open={open} onClose={close} width={540}>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--red-dim)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Icon.bug size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Report a bug</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Creates a tracked issue in the GitHub repo</p>
        </div>
        <button onClick={close} style={{ background: "none", border: 0, color: "var(--text-faint)", cursor: "pointer", padding: 4 }}>
          <Icon.x size={18} />
        </button>
      </div>

      {phase === "done" ? (
        <div className="fade-up" style={{ padding: "34px 22px 26px", textAlign: "center" }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: "50%", background: "var(--green-dim)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--green)", marginBottom: 16 }}>
            <Icon.check size={28} sw={2.4} />
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 650 }}>Issue created</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>Your report was filed and assigned to the platform team.</p>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: "var(--r-md)", background: "var(--surface-2)", border: "1px solid var(--border-1)", textDecoration: "none", color: "var(--text)" }}>
            <Icon.bug size={16} style={{ color: "var(--blue-bright)" }} />
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>nrl/ragbot#{issueNo}</span>
            <Icon.ext size={14} style={{ color: "var(--text-faint)" }} />
          </a>
          <div style={{ marginTop: 24 }}>
            <Button variant="ghost" onClick={close} style={{ minWidth: 120 }}>Done</Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 22, position: "relative" }}>
          {phase === "creating" && (
            <div className="fade-in" style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(20,20,29,0.7)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", borderRadius: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="var(--blue-bright)" strokeWidth="2.4" opacity="0.2" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--blue-bright)" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--text-1)" }} className="streaming-text">Creating GitHub issue…</div>
              </div>
            </div>
          )}
          <Field label="Title" required>
            <input className="field" placeholder="Short summary of the problem" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className="field" rows={3} placeholder="What happened? What did you expect?" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ lineHeight: 1.5 }} />
          </Field>
          <Field label="Severity">
            <div style={{ display: "flex", gap: 7 }}>
              {(["Critical", "High", "Medium", "Low"] as const).map((s) => {
                const active = sev === s;
                const c = { Critical: "#f87171", High: "#fb923c", Medium: "#fbbf24", Low: "var(--text-muted)" }[s];
                return (
                  <button key={s} onClick={() => setSev(s)} style={{
                    flex: 1, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    border: `1px solid ${active ? c : "var(--border-1)"}`,
                    background: active ? `color-mix(in srgb, ${c} 14%, transparent)` : "var(--surface)",
                    color: active ? c : "var(--text-muted)", transition: "all .14s",
                  }}>{s}</button>
                );
              })}
            </div>
          </Field>
          <Field label="Steps to reproduce">
            <textarea className="field" rows={3} placeholder={"1. Go to…\n2. Click…\n3. Observe…"} value={steps} onChange={(e) => setSteps(e.target.value)} style={{ lineHeight: 1.5, fontFamily: "var(--mono)", fontSize: 12.5 }} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit} disabled={!title.trim()} icon={<Icon.bug size={15} />}>Submit report</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 550, color: "var(--text-1)", marginBottom: 7 }}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
