"use client";

import React, { useEffect } from "react";

export function Modal({
  open,
  onClose,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onMouseDown={onClose}
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 8000,
        background: "rgba(5,5,9,0.66)", backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center", padding: 24,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="card modal-card"
        style={{
          width, maxWidth: "100%", maxHeight: "90vh", overflow: "auto",
          background: "var(--surface-1)", boxShadow: "var(--shadow-lg)",
          borderColor: "var(--border-1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
