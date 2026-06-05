"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/"), 2000);
  };

  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", position: "relative", background: "var(--bg)" }}>
      <AmbientBg />
      <div className="fade-up" style={{ position: "relative", width: 400, maxWidth: "calc(100vw - 40px)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center",
              background: "linear-gradient(150deg, var(--violet) 0%, var(--blue) 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.14) inset, 0 5px 18px -5px rgba(99,102,241,0.7)",
              color: "#fff",
            }}>
              <Icon.flame size={21} sw={1.8} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
              NRL <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>RAGBot</span>
            </span>
          </div>
        </div>

        {success ? (
          <div className="card" style={{
            padding: "30px 30px 28px",
            background: "rgba(20,20,29,0.72)", backdropFilter: "blur(20px)",
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(99,102,241,0.06)",
            textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center",
              background: "var(--green-dim)", border: "1px solid rgba(34,197,94,0.3)",
              margin: "0 auto 16px",
            }}>
              <Icon.check size={22} style={{ color: "#6ee7a0" }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#6ee7a0", fontWeight: 550 }}>
              Password updated! Redirecting…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card" style={{
            padding: "30px 30px 28px",
            background: "rgba(20,20,29,0.72)", backdropFilter: "blur(20px)",
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(99,102,241,0.06)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em" }}>Set new password</h1>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Choose a strong password for your account.
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 13, color: "#f87171" }}>
                {error}
              </div>
            )}

            <label style={lblStyle}>New password</label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={iconInField}><Icon.lock size={16} /></span>
              <input
                className="field"
                style={{ paddingLeft: 38 }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <label style={lblStyle}>Confirm password</label>
            <div style={{ position: "relative", marginBottom: 22 }}>
              <span style={iconInField}><Icon.lock size={16} /></span>
              <input
                className="field"
                style={{ paddingLeft: 38 }}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" loading={loading} className="ai-glow" style={{ width: "100%", height: 42, fontSize: 14 }}>
              {loading ? "Updating…" : "Update password"}
            </Button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, justifyContent: "center", fontSize: 11.5, color: "var(--text-faint)" }}>
              <Icon.shield size={13} />
              <span>SSO via Supabase · session encrypted on-prem</span>
            </div>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-faint)", marginTop: 18 }}>
          Niger Refinery Ltd · Internal use only
        </p>
      </div>
    </div>
  );
}

const lblStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 550, color: "var(--text-1)", marginBottom: 6 };
const iconInField: React.CSSProperties = { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" };
