"use client";

import React, { CSSProperties } from "react";

type Tone = "green" | "amber" | "red" | "blue" | "violet" | "gray";

const STATUS_MAP: Record<string, { cls: string; dot: string }> = {
  Indexed:    { cls: "badge-green",  dot: "#22C55E" },
  Processing: { cls: "badge-amber",  dot: "#F59E0B" },
  Failed:     { cls: "badge-red",    dot: "#EF4444" },
  Active:     { cls: "badge-green",  dot: "#22C55E" },
  Inactive:   { cls: "badge-gray",   dot: "#5C5C68" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.Inactive;
  const showDot = ["Indexed", "Processing", "Failed", "Active"].includes(status);
  return (
    <span className={`badge ${s.cls}`}>
      {showDot && (
        <span className="dotmark" style={{ background: s.dot, boxShadow: `0 0 7px ${s.dot}99` }} />
      )}
      {status}
    </span>
  );
}

export function Badge({
  tone = "gray",
  children,
  style,
}: {
  tone?: Tone;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`badge badge-${tone}`} style={style}>
      {children}
    </span>
  );
}
