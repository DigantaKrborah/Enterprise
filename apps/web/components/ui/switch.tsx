"use client";

import React from "react";

export function Switch({
  checked,
  onChange,
  size = 1,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: number;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 38 * size, height: 22 * size, borderRadius: 99, border: 0, cursor: "pointer", padding: 0,
        background: checked ? "var(--blue)" : "var(--surface-3)",
        boxShadow: checked ? "0 0 14px -3px var(--blue)" : "inset 0 0 0 1px var(--border-1)",
        transition: "background .2s, box-shadow .2s", position: "relative", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3 * size,
        left: checked ? `calc(100% - ${19 * size}px)` : 3 * size,
        width: 16 * size, height: 16 * size, borderRadius: "50%", background: "#fff",
        transition: "left .2s cubic-bezier(.3,1.3,.5,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}
