"use client";

import React from "react";
import { Icon } from "./icons";

export function Avatar({
  name = "?",
  size = 30,
  kind = "user",
}: {
  name?: string;
  size?: number;
  kind?: "user" | "ai";
}) {
  if (kind === "ai") {
    return (
      <div style={{
        width: size, height: size, borderRadius: 9, flexShrink: 0,
        display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, var(--violet) 0%, var(--blue) 100%)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset, 0 4px 14px -4px rgba(139,92,246,0.6)",
        color: "#fff",
      }}>
        <Icon.spark2 size={size * 0.52} sw={1.9} />
      </div>
    );
  }

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "grid", placeItems: "center",
      background: "var(--surface-3)", border: "1px solid var(--border-1)",
      color: "var(--text-1)", fontSize: size * 0.38, fontWeight: 650,
    }}>
      {initials}
    </div>
  );
}
