"use client";

import React, { CSSProperties } from "react";

export function Skel({
  w = "100%",
  h = 14,
  r = 6,
  style,
}: {
  w?: number | string;
  h?: number;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}
