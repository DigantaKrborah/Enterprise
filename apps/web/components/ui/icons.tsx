"use client";

import React, { CSSProperties } from "react";

interface IcProps {
  size?: number;
  sw?: number;
  style?: CSSProperties;
  className?: string;
  fill?: string;
  stroke?: string;
  d?: string;
  paths?: React.ReactNode;
}

function Ic({ d, paths, size = 18, fill, stroke = "currentColor", sw = 1.7, style, className }: IcProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill || "none"}
      stroke={fill ? "none" : stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      className={className}
    >
      {d ? <path d={d} /> : null}
      {paths}
    </svg>
  );
}

type IconProps = Omit<IcProps, "d" | "paths">;

export const Icon = {
  chat:      (p: IconProps) => <Ic {...p} d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 20l1.5-5.5A8.5 8.5 0 1 1 21 11.5z" />,
  doc:       (p: IconProps) => <Ic {...p} paths={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>} />,
  sentiment: (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5"/><path d="M9 9.5h.01M15 9.5h.01"/></>} />,
  admin:     (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/></>} />,
  send:      (p: IconProps) => <Ic {...p} d="M3.5 12h16m0 0-6.5-6.5M19.5 12 13 18.5" />,
  plus:      (p: IconProps) => <Ic {...p} d="M12 5v14M5 12h14" />,
  search:    (p: IconProps) => <Ic {...p} paths={<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>} />,
  upload:    (p: IconProps) => <Ic {...p} paths={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v13M7 8l5-5 5 5"/></>} />,
  chevron:   (p: IconProps) => <Ic {...p} d="m9 6 6 6-6 6" />,
  chevronD:  (p: IconProps) => <Ic {...p} d="m6 9 6 6 6-6" />,
  check:     (p: IconProps) => <Ic {...p} d="m4 12 5 5L20 6" />,
  x:         (p: IconProps) => <Ic {...p} d="M6 6l12 12M18 6 6 18" />,
  users:     (p: IconProps) => <Ic {...p} paths={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></>} />,
  health:    (p: IconProps) => <Ic {...p} d="M3 12h4l2 6 4-14 2.5 8H21" />,
  bug:       (p: IconProps) => <Ic {...p} paths={<><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 9h-3M8 9H5M20 14h-4M8 14H4M19 19l-2.5-2M8.5 17 5 19M12 3v3M9.5 5 11 6.5M14.5 5 13 6.5"/></>} />,
  cpu:       (p: IconProps) => <Ic {...p} paths={<><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>} />,
  logout:    (p: IconProps) => <Ic {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  lock:      (p: IconProps) => <Ic {...p} paths={<><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>} />,
  mail:      (p: IconProps) => <Ic {...p} paths={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>} />,
  sparkle:   (p: IconProps) => <Ic {...p} d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />,
  spark2:    (p: IconProps) => <Ic {...p} paths={<><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></>} />,
  copy:      (p: IconProps) => <Ic {...p} paths={<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></>} />,
  thumbUp:   (p: IconProps) => <Ic {...p} d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-7a2 2 0 0 1 3 1.8V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />,
  refresh:   (p: IconProps) => <Ic {...p} d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />,
  trash:     (p: IconProps) => <Ic {...p} d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6" />,
  ext:       (p: IconProps) => <Ic {...p} d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
  flame:     (p: IconProps) => <Ic {...p} d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.7 1.3-3.6C8.6 9 9 10 10 10c0-2.5 2-4.8 2-8z" />,
  history:   (p: IconProps) => <Ic {...p} d="M3 3v6h6M3.5 9a9 9 0 1 0 2.5-4.5L3 9M12 8v5l3 2" />,
  file:      (p: IconProps) => <Ic {...p} paths={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>} />,
  cite:      (p: IconProps) => <Ic {...p} d="M7 7h4v8H7zM7 11c0-2 1-3 3-3M13 7h4v8h-4zM13 11c0-2 1-3 3-3" />,
  panel:     (p: IconProps) => <Ic {...p} paths={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></>} />,
  dotsV:     (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></>} />,
  shield:    (p: IconProps) => <Ic {...p} d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  clock:     (p: IconProps) => <Ic {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  attach:    (p: IconProps) => <Ic {...p} d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />,
};
