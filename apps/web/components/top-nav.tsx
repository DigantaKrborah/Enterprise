"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Icon } from "./ui/icons";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";

type Tab = "chat" | "documents" | "sentiment" | "admin";

const TABS: { id: Tab; label: string; icon: (p: { size: number; sw: number }) => React.ReactElement }[] = [
  { id: "chat",      label: "Chat",      icon: Icon.chat },
  { id: "documents", label: "Documents", icon: Icon.doc },
  { id: "sentiment", label: "Sentiment", icon: Icon.sentiment },
  { id: "admin",     label: "Admin",     icon: Icon.admin },
];

interface TopNavProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  onBug: () => void;
}

export function TopNav({ tab, setTab, onBug }: TopNavProps) {
  const { logout } = useAuth();
  const [menu, setMenu] = useState(false);

  return (
    <header style={{
      height: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 16,
      padding: "0 16px", borderBottom: "1px solid var(--border)",
      background: "rgba(12,12,18,0.8)", backdropFilter: "blur(14px)",
      position: "relative", zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center",
            background: "linear-gradient(150deg, var(--violet) 0%, var(--blue) 100%)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.14) inset, 0 5px 18px -5px rgba(99,102,241,0.7)",
            color: "#fff",
          }}>
            <Icon.flame size={17} sw={1.8} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
            NRL <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>RAGBot</span>
          </span>
        </div>
      </div>

      {/* Center tabs */}
      <nav style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 2 }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={"navtab" + (active ? " on" : "")}>
              <t.icon size={16} sw={1.8} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Right: bug report + user menu */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
        <button onClick={onBug} className="btn btn-ghost btn-sm" title="Report a bug" style={{ gap: 6 }}>
          <Icon.bug size={15} /> Report
        </button>
        <div style={{ width: 1, height: 22, background: "var(--border)" }} />
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenu((m) => !m)}
            style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: 0, cursor: "pointer", padding: "3px 6px 3px 4px", borderRadius: "var(--r-md)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-strong)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Avatar name="Mara Okonkwo" size={30} />
            <div style={{ textAlign: "left", lineHeight: 1.25 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Mara Okonkwo</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Operations</div>
            </div>
            <Badge tone="violet" style={{ marginLeft: 2 }}>Admin</Badge>
          </button>
          {menu && (
            <>
              <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div className="card fade-in" style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", width: 200, zIndex: 41,
                background: "var(--surface-1)", boxShadow: "var(--shadow-pop)", padding: 6, borderColor: "var(--border-1)",
              }}>
                <MenuItem icon={<Icon.users size={15} />} label="Profile settings" onClick={() => setMenu(false)} />
                <MenuItem icon={<Icon.shield size={15} />} label="Security" onClick={() => setMenu(false)} />
                <div className="divider" style={{ margin: "5px 0" }} />
                <MenuItem icon={<Icon.logout size={15} />} label="Sign out" danger onClick={() => { setMenu(false); logout(); }} />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", height: 34, padding: "0 10px",
      borderRadius: 7, border: 0, cursor: "pointer", background: "transparent", textAlign: "left",
      fontSize: 13, color: danger ? "#f87171" : "var(--text-1)", transition: "background .12s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "var(--red-dim)" : "var(--hover-strong)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon} {label}
    </button>
  );
}
