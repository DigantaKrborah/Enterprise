"use client";

import React from "react";

type Option = string | { value: string; label: string };

export function Segmented({
  options,
  value,
  onChange,
  size,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm";
}) {
  return (
    <div style={{
      display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border-1)",
      borderRadius: "var(--r-md)", padding: 3, gap: 2,
    }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const active = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              height: size === "sm" ? 26 : 30, padding: "0 12px", borderRadius: 6, border: 0, cursor: "pointer",
              fontSize: size === "sm" ? 12 : 12.5, fontWeight: 550,
              background: active ? "var(--surface-3)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px var(--border-1)" : "none",
              transition: "all .14s", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
