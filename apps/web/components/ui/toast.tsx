"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./icons";

interface ToastOptions {
  title: string;
  body?: string;
  tone?: "blue" | "green" | "red" | "violet";
  icon?: React.ReactNode;
  link?: string;
  duration?: number;
}

interface Toast extends ToastOptions {
  id: string;
}

const ToastCtx = createContext<(t: ToastOptions) => void>(() => {});
export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: ToastOptions) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(
      () => setToasts((ts) => ts.filter((x) => x.id !== id)),
      t.duration || 4200
    );
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{
        position: "fixed", right: 20, bottom: 20,
        display: "flex", flexDirection: "column", gap: 10,
        zIndex: 9000, alignItems: "flex-end",
      }}>
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            {...t}
            onClose={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({
  title, body, tone = "blue", icon, link, onClose,
}: Toast & { onClose: () => void }) {
  const color = { blue: "var(--blue)", green: "var(--green)", red: "var(--red)", violet: "var(--violet)" }[tone];
  return (
    <div className="toast-card" style={{
      minWidth: 270, maxWidth: 360, background: "var(--surface-1)",
      border: "1px solid var(--border-1)", borderLeft: `2.5px solid ${color}`,
      borderRadius: "var(--r-md)", padding: "12px 14px", boxShadow: "var(--shadow-pop)",
      display: "flex", gap: 11,
    }}>
      <div style={{ color, marginTop: 1 }}>{icon || <Icon.check size={17} sw={2.2} />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{title}</div>
        {body && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{body}</div>}
        {link && (
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12.5, color: "var(--blue-bright)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, textDecoration: "none" }}>
            {link} <Icon.ext size={12} />
          </a>
        )}
      </div>
      <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--text-faint)", cursor: "pointer", padding: 0, height: 16 }}>
        <Icon.x size={15} />
      </button>
    </div>
  );
}
