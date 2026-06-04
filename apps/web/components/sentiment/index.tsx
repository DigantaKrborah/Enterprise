"use client";

import React, { useState } from "react";
import { SENTIMENT_SAMPLE } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Skel } from "@/components/ui/skeleton";

const SENTIMENT_RESULT = {
  sentiment: "Negative",
  tone: "Concerned & constructive",
  confidence: 0.87,
  summary: "The message expresses genuine frustration about recurring scheduling decisions affecting the night crew, but the tone stays professional and solution-oriented. The author signals risk of attrition while explicitly offering to help, indicating an escalation intended to prompt action rather than to vent.",
  scores: [
    { label: "Frustration",    value: 0.78, color: "var(--red)" },
    { label: "Urgency",        value: 0.71, color: "var(--amber)" },
    { label: "Constructiveness", value: 0.64, color: "var(--green)" },
  ],
  entities: [
    { t: "person", v: "Kwame" }, { t: "date", v: "June 15th" }, { t: "team", v: "Night crew" },
    { t: "action", v: "Transfer requests" }, { t: "doc", v: "Q3 shift rotation" }, { t: "metric", v: "6 consecutive shifts" },
  ],
};

function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em" }}>{title}</h1>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 11 }}>{children}</div>;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-1)" }}>{label}</span>
        <span className="mono tnum" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 100}%`, borderRadius: 99, background: color, opacity: 0.85, animation: "growBar .6s cubic-bezier(.2,.8,.3,1) both" }} />
      </div>
    </div>
  );
}

function entityColor(t: string) {
  return ({ person: "var(--blue-bright)", date: "var(--amber)", team: "var(--violet-bright)", action: "var(--green)", doc: "var(--text-muted)", metric: "#fb923c" } as Record<string, string>)[t] || "var(--text-muted)";
}

function ResultEmpty() {
  return (
    <div className="card" style={{ height: 360, display: "grid", placeItems: "center", borderStyle: "dashed", borderColor: "var(--border-1)", background: "transparent" }}>
      <div style={{ textAlign: "center", color: "var(--text-faint)" }}>
        <Icon.sentiment size={30} style={{ marginBottom: 10, opacity: 0.6 }} />
        <div style={{ fontSize: 13.5 }}>Results appear here after analysis</div>
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="card fade-in" style={{ padding: 18 }}>
      <Skel w={120} h={24} r={999} style={{ marginBottom: 18 }} />
      <Skel w="100%" h={13} style={{ marginBottom: 8 }} />
      <Skel w="92%" h={13} style={{ marginBottom: 8 }} />
      <Skel w="70%" h={13} style={{ marginBottom: 22 }} />
      <Skel w={90} h={11} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => <Skel key={i} w="100%" h={28} style={{ marginBottom: 10 }} />)}
      <Skel w={90} h={11} style={{ margin: "10px 0 12px" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[60, 80, 70, 90].map((w, i) => <Skel key={i} w={w} h={24} r={999} />)}
      </div>
    </div>
  );
}

function ResultPanel({ r }: { r: typeof SENTIMENT_RESULT }) {
  const tone = r.sentiment === "Negative" ? "red" : r.sentiment === "Positive" ? "green" : "amber";
  return (
    <div className="card fade-up" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Badge tone={tone as "red" | "green" | "amber"} style={{ height: 26, fontSize: 12.5, padding: "0 12px" }}>{r.sentiment}</Badge>
        <span style={{ fontSize: 13, color: "var(--text-1)" }}>{r.tone}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--violet-bright)", fontWeight: 600 }}>
          <Icon.spark2 size={13} /> AI analysis
        </span>
      </div>

      <p style={{ margin: "0 0 18px", fontSize: 13.3, lineHeight: 1.6, color: "var(--text-1)" }}>{r.summary}</p>

      <SectionLabel>Signal breakdown</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
        {r.scores.map((s) => <ScoreBar key={s.label} {...s} />)}
      </div>

      <SectionLabel>Confidence</SectionLabel>
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 8, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${r.confidence * 100}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--blue), var(--violet))", boxShadow: "0 0 12px -2px var(--violet)", animation: "growBar .7s cubic-bezier(.2,.8,.3,1) both" }} />
        </div>
        <span className="mono tnum" style={{ fontSize: 12, color: "var(--text-muted)" }}>{(r.confidence * 100).toFixed(0)}% confident</span>
      </div>

      <SectionLabel>Extracted entities</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {r.entities.map((e, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border-1)", fontSize: 12 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: entityColor(e.t) }}>{e.t}</span>
            <span style={{ color: "var(--text-1)" }}>{e.v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SentimentPage() {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "analyzing" | "done">("idle");

  const analyze = () => {
    if (!text.trim()) return;
    setState("analyzing");
    setTimeout(() => setState("done"), 1500);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 28px 60px" }}>
        <PageHeader title="Sentiment Analysis" sub="Paste an email or message to extract tone, entities, and a confidence read" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 9 }}>Email content</label>
            <textarea className="field" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Paste email content here…"
              style={{ minHeight: 280, fontSize: 13.5, lineHeight: 1.6, resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setText(SENTIMENT_SAMPLE); setState("idle"); }}>
                <Icon.copy size={14} /> Use sample
              </button>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto" }} className="tnum">{text.length} chars</span>
              <Button className="analyze-btn" loading={state === "analyzing"} disabled={!text.trim()} onClick={analyze}
                icon={state !== "analyzing" ? <Icon.sparkle size={15} /> : undefined}>
                {state === "analyzing" ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
          </div>

          <div style={{ minHeight: 360 }}>
            {state === "idle" && <ResultEmpty />}
            {state === "analyzing" && <ResultSkeleton />}
            {state === "done" && <ResultPanel r={SENTIMENT_RESULT} />}
          </div>
        </div>
      </div>
    </div>
  );
}
