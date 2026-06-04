"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Icon } from "./ui/icons";
import { Button } from "./ui/button";

function Logo({ size = 1 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 * size }}>
      <div style={{
        width: 30 * size, height: 30 * size, borderRadius: 8 * size,
        display: "grid", placeItems: "center",
        background: "linear-gradient(150deg, var(--violet) 0%, var(--blue) 100%)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.14) inset, 0 5px 18px -5px rgba(99,102,241,0.7)",
        color: "#fff",
      }}>
        <Icon.flame size={17 * size} sw={1.8} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontSize: 16 * size, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
          NRL <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>RAGBot</span>
        </span>
      </div>
    </div>
  );
}

function AmbientBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: "55vw", height: "55vw", left: "8%", top: "-10%",
        background: "radial-gradient(circle, rgba(59,130,246,0.20), transparent 62%)",
        filter: "blur(30px)", animation: "ambientDrift 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "48vw", height: "48vw", right: "4%", bottom: "-12%",
        background: "radial-gradient(circle, rgba(139,92,246,0.20), transparent 62%)",
        filter: "blur(30px)", animation: "ambientDrift2 22s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.5,
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06), transparent 55%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.4,
        backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "46px 46px",
        maskImage: "radial-gradient(ellipse at 50% 45%, #000 10%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, #000 10%, transparent 70%)" }} />
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("m.okonkwo@nrl.co");
  const [pw, setPw] = useState("••••••••••");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => login(), 950);
  };

  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", position: "relative", background: "var(--bg)" }}>
      <AmbientBg />
      <div className="fade-up" style={{ position: "relative", width: 400, maxWidth: "calc(100vw - 40px)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <Logo size={1.25} />
        </div>
        <form onSubmit={submit} className="card" style={{
          padding: "30px 30px 28px",
          background: "rgba(20,20,29,0.72)", backdropFilter: "blur(20px)",
          borderColor: "var(--border-1)",
          boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(99,102,241,0.06)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em" }}>Sign in</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Knowledge assistant for refinery operations</p>
          </div>

          <label style={lblStyle}>Email</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={iconInField}><Icon.mail size={16} /></span>
            <input className="field" style={{ paddingLeft: 38 }} value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@nrl.co" />
          </div>

          <label style={lblStyle}>Password</label>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <span style={iconInField}><Icon.lock size={16} /></span>
            <input className="field" style={{ paddingLeft: 38 }} type="password" value={pw}
              onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
              Forgot password?
            </a>
          </div>

          <Button type="submit" loading={loading} className="ai-glow" style={{ width: "100%", height: 42, fontSize: 14 }}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, justifyContent: "center", fontSize: 11.5, color: "var(--text-faint)" }}>
            <Icon.shield size={13} />
            <span>SSO via Supabase · session encrypted on-prem</span>
          </div>
        </form>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-faint)", marginTop: 18 }}>
          Niger Refinery Ltd · Internal use only
        </p>
      </div>
    </div>
  );
}

const lblStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 550, color: "var(--text-1)", marginBottom: 6 };
const iconInField: React.CSSProperties = { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" };
