"use client";

import React, { ButtonHTMLAttributes } from "react";

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: "spin .8s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size,
  icon,
  iconRight,
  children,
  className = "",
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    !children ? "btn-icon" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={size === "sm" ? 13 : 15} /> : icon}
      {children}
      {iconRight}
    </button>
  );
}
