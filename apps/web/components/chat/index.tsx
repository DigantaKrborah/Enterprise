"use client";

import React, { useEffect, useRef, useState } from "react";
import { CONVERSATIONS, DOCS, DEMO_ANSWER, SEED_MESSAGES, LLMS, pickAnswer, Message, Citation } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";

type Layout = "classic" | "compact" | "panel";

/* ── Citation renderers ── */
function CitationChips({ citations, onOpen }: { citations: Citation[]; onOpen: (c: Citation) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 }}>
      {citations.map((c, i) => (
        <button key={i} onClick={() => onOpen(c)} className="cite-chip" style={citeChipStyle}>
          <Icon.file size={13} style={{ color: c.dept === "HR" ? "var(--violet-bright)" : "var(--blue-bright)" }} />
          <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.doc}</span>
          <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>{c.page}</span>
        </button>
      ))}
    </div>
  );
}
const citeChipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px",
  borderRadius: 999, border: "1px solid var(--border-1)", background: "var(--surface-1)",
  color: "var(--text-1)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .14s",
};

function CitationCompact({ citations }: { citations: Citation[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--border)" }}>
      <Icon.cite size={14} style={{ color: "var(--text-faint)" }} />
      <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>Sources</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {citations.map((c, i) => (
          <span key={i} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            <sup style={{ color: "var(--blue-bright)", fontWeight: 700, marginRight: 2 }}>{i + 1}</sup>
            {c.doc} <span style={{ color: "var(--text-faint)" }}>{c.page}</span>{i < citations.length - 1 ? " · " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Sources panel ── */
function SourcesPanel({ citations, onClose }: { citations: Citation[] | null; onClose: () => void }) {
  if (!citations) return null;
  return (
    <aside className="fade-in" style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 650 }}>Sources <span style={{ color: "var(--text-faint)" }}>· {citations.length}</span></span>
        <button onClick={onClose} style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 7, border: 0, background: "transparent", color: "var(--text-faint)", cursor: "pointer" }}>
          <Icon.x size={16} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        {citations.map((c, i) => (
          <div key={i} className="card" style={{ padding: 13, background: "var(--surface-1)", borderColor: "var(--border-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--blue-dim)", color: "var(--blue-bright)", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{c.doc}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
              "…the cold-start interlock will not clear until firebox O₂ reads below 8% and the purge cycle has completed…"
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Badge tone={c.dept === "HR" ? "violet" : "blue"}>{c.dept}</Badge>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.page} · {c.v}</span>
              <a href="#" onClick={(e) => e.preventDefault()} style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--blue-bright)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                Open <Icon.ext size={11} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── Message bubbles ── */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end", gap: 11 }}>
      <div style={{
        maxWidth: "75%", padding: "11px 15px", borderRadius: "14px 14px 4px 14px",
        background: "var(--surface-2)", border: "1px solid var(--border-1)",
        fontSize: 14.5, lineHeight: 1.55, color: "var(--text)",
      }}>{text}</div>
    </div>
  );
}

function IconBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 7, border: 0, background: "transparent", color: "var(--text-faint)", cursor: "pointer", transition: "all .12s" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-strong)"; e.currentTarget.style.color = "var(--text-1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}>
      {children}
    </button>
  );
}

function AiBubble({ msg, streaming, streamN, layout, onOpenCite, onOpenPanel }: {
  msg: Message; streaming: boolean; streamN: number;
  layout: Layout; onOpenCite: (c: Citation) => void; onOpenPanel: (cs: Citation[]) => void;
}) {
  const shown = streaming ? msg.text.slice(0, streamN) : msg.text;
  const tailLen = 16;
  const head = streaming ? shown.slice(0, Math.max(0, shown.length - tailLen)) : shown;
  const tail = streaming ? shown.slice(Math.max(0, shown.length - tailLen)) : "";
  const showCites = !streaming && msg.citations;

  return (
    <div className="fade-up" style={{ display: "flex", gap: 12 }}>
      <Avatar kind="ai" size={32} />
      <div style={{ flex: 1, minWidth: 0, maxWidth: "82%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text)" }}>RAGBot</span>
          <span style={{ fontSize: 10.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon.cpu size={11} /> {msg.model || "Ollama"}
          </span>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.62, color: "var(--text-1)", whiteSpace: "pre-wrap" }}>
          {head}
          {streaming && <span className="streaming-text">{tail}</span>}
          {streaming && <span className="caret" />}
        </div>

        {showCites && layout === "classic" && <CitationChips citations={msg.citations!} onOpen={onOpenCite} />}
        {showCites && layout === "compact" && <CitationCompact citations={msg.citations!} />}
        {showCites && layout === "panel" && (
          <button onClick={() => onOpenPanel(msg.citations!)} style={{ ...citeChipStyle, marginTop: 13 }}>
            <Icon.panel size={13} style={{ color: "var(--blue-bright)" }} />
            {msg.citations!.length} sources <Icon.chevron size={13} style={{ color: "var(--text-faint)" }} />
          </button>
        )}

        {showCites && (
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            <IconBtn title="Good response"><Icon.thumbUp size={14} /></IconBtn>
            <IconBtn title="Copy"><Icon.copy size={14} /></IconBtn>
            <IconBtn title="Regenerate"><Icon.refresh size={14} /></IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="fade-in" style={{ display: "flex", gap: 12 }}>
      <Avatar kind="ai" size={32} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 12, background: "var(--surface-1)", border: "1px solid var(--border)", alignSelf: "flex-start" }}>
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: 4 }}>searching documents…</span>
      </div>
    </div>
  );
}

/* ── Model picker ── */
function ModelPicker({ model, setModel }: { model: string; setModel: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = LLMS.filter((l) => l.active);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 7, height: 30, padding: "0 10px", borderRadius: 8,
        border: "1px solid var(--border-1)", background: "var(--surface)", cursor: "pointer",
        fontSize: 12, fontWeight: 550, color: "var(--text-1)",
      }}>
        <Icon.spark2 size={13} style={{ color: "var(--violet-bright)" }} />
        {model}
        <Icon.chevronD size={13} style={{ color: "var(--text-faint)" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div className="card fade-in" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 230, zIndex: 61, background: "var(--surface-2)", boxShadow: "var(--shadow-pop)", padding: 6, borderColor: "var(--border-1)" }}>
            {active.map((l) => (
              <button key={l.id} onClick={() => { setModel(l.name); setOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 9px", borderRadius: 7, border: 0,
                background: model === l.name ? "var(--hover-strong)" : "transparent", cursor: "pointer", textAlign: "left",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = model === l.name ? "var(--hover-strong)" : "transparent")}
              >
                <Icon.cpu size={15} style={{ color: l.tag === "On-prem" ? "var(--green)" : "var(--blue-bright)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{l.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)" }} className="mono">{l.model}</div>
                </div>
                {model === l.name && <Icon.check size={14} style={{ color: "var(--blue-bright)" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Composer ── */
function Composer({ model, setModel, onSend, busy }: { model: string; setModel: (m: string) => void; onSend: (t: string) => void; busy: boolean }) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };
  useEffect(grow, [val]);
  const send = () => { if (!val.trim() || busy) return; onSend(val.trim()); setVal(""); setTimeout(grow, 0); };

  return (
    <div style={{ padding: "12px 20px 18px", flexShrink: 0 }}>
      <div className={busy ? "" : "composer-glow"} style={{
        maxWidth: 820, margin: "0 auto", background: "var(--surface-1)", border: "1px solid var(--border-1)",
        borderRadius: "var(--r-lg)", padding: "10px 10px 9px", transition: "box-shadow .2s, border-color .2s",
      }}>
        <textarea ref={ref} className="composer-area" value={val} rows={1}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about SOPs, safety procedures, HR policy…"
          style={{ width: "100%", border: 0, outline: 0, background: "transparent", resize: "none", color: "var(--text)", fontSize: 14.5, lineHeight: 1.55, padding: "4px 8px", maxHeight: 180 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingLeft: 4 }}>
          <button title="Attach" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, border: 0, background: "transparent", color: "var(--text-faint)", cursor: "pointer" }}>
            <Icon.attach size={17} />
          </button>
          <ModelPicker model={model} setModel={setModel} />
          <div style={{ flex: 1 }} />
          <span className="kbd" style={{ marginRight: 2 }}>↵ to send</span>
          <Button size="sm" disabled={!val.trim() || busy} onClick={send} className="btn-icon" style={{ width: 34, height: 34, borderRadius: 9 }}>
            <Icon.send size={17} sw={2} />
          </Button>
        </div>
      </div>
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-faint)", margin: "10px 0 0" }}>
        Answers are grounded in indexed documents. Verify against the cited source before acting.
      </p>
    </div>
  );
}

/* ── Empty state ── */
function ChatEmpty({ onPrompt }: { onPrompt: (q: string) => void }) {
  const suggestions = [
    { q: "What's the interlock sequence for a cold start on the CDU?", dept: "Operations" },
    { q: "How much parental leave am I eligible for?", dept: "HR" },
    { q: "What's the max depressurization rate on the hydrocracker?", dept: "Operations" },
    { q: "Where do I report a workplace harassment concern?", dept: "HR" },
  ];
  return (
    <div className="fade-up" style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 620, textAlign: "center" }}>
        <div style={{ display: "inline-grid", placeItems: "center", marginBottom: 18 }}>
          <Avatar kind="ai" size={52} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em" }}>Ask the refinery knowledge base</h2>
        <p style={{ margin: "0 auto 26px", fontSize: 14, color: "var(--text-muted)", maxWidth: 440, lineHeight: 1.55 }}>
          Grounded answers from SOPs, safety manuals, and HR policy — every claim linked to its source document.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onPrompt(s.q)} className="suggest-card" style={{
              padding: "13px 15px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
              background: "var(--surface)", cursor: "pointer", textAlign: "left", transition: "all .15s",
            }}>
              <Badge tone={s.dept === "HR" ? "violet" : "blue"} style={{ marginBottom: 9 }}>{s.dept}</Badge>
              <div style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.45 }}>{s.q}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function ChatSidebar({ dept, setDept, activeId, setActiveId, onNew }: {
  dept: string; setDept: (d: string) => void;
  activeId: string; setActiveId: (id: string) => void; onNew: () => void;
}) {
  const filtered = dept === "All" ? CONVERSATIONS : CONVERSATIONS.filter((c) => c.dept === dept);
  const indexedCount = DOCS.filter((d) => d.status === "Indexed").length;
  return (
    <aside style={{ width: 270, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)" }}>
      <div style={{ padding: "14px 14px 10px" }}>
        <Button onClick={onNew} icon={<Icon.plus size={16} sw={2.1} />} style={{ width: "100%" }}>New chat</Button>
      </div>
      <div style={{ padding: "0 14px 12px" }}>
        <Segmented size="sm" value={dept} onChange={setDept} options={["All", "HR", "Operations"]} />
      </div>
      <div className="divider" />
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 8px 8px" }}>Recent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {filtered.map((c) => {
            const active = c.id === activeId;
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)} className={"convo" + (active ? " on" : "")}>
                {active && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2.5, borderRadius: 2, background: "var(--blue)" }} />}
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: c.dept === "HR" ? "var(--violet)" : "var(--blue)", opacity: active ? 1 : 0.5 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.8, color: active ? "var(--text)" : "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
                <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{c.time}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="divider" />
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
        <Icon.doc size={13} /> <span>{indexedCount} documents indexed</span>
      </div>
    </aside>
  );
}

/* ── Main Chat ── */
export function Chat({ layout = "classic" }: { layout?: Layout }) {
  const [dept, setDept] = useState("All");
  const [activeId, setActiveId] = useState("c1");
  const [messages, setMessages] = useState<Message[]>(() => SEED_MESSAGES.map((m) => ({ ...m, model: "Ollama" })));
  const [model, setModel] = useState("Ollama");
  const [busy, setBusy] = useState(false);
  const [streamN, setStreamN] = useState(0);
  const [streamId, setStreamId] = useState<number | null>(null);
  const [panelCites, setPanelCites] = useState<Citation[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollDown = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { scrollDown(); }, [messages.length, busy]);
  useEffect(() => { if (streamId !== null) scrollDown(); }, [streamN]);

  const send = (text: string) => {
    setPanelCites(null);
    const ans = pickAnswer(text);
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const id = Date.now();
      setMessages((m) => [...m, { role: "ai", text: ans.text, citations: ans.citations, model, done: false, _id: id }]);
      setStreamId(id); setStreamN(0);
      const total = ans.text.length;
      let n = 0;
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => {
        n += Math.max(2, Math.round(Math.random() * 5));
        if (n >= total) {
          n = total; if (timer.current) clearInterval(timer.current);
          setStreamN(total); setStreamId(null);
          setMessages((m) => m.map((x) => x._id === id ? { ...x, done: true } : x));
          return;
        }
        setStreamN(n);
      }, 24);
    }, 1100);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const reset = () => { if (timer.current) clearInterval(timer.current); setBusy(false); setStreamId(null); setMessages([]); setPanelCites(null); };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <ChatSidebar dept={dept} setDept={setDept} activeId={activeId} setActiveId={setActiveId} onNew={reset} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {messages.length === 0 ? (
          <ChatEmpty onPrompt={send} />
        ) : (
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "26px 0" }}>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 26 }}>
              {messages.map((m, i) =>
                m.role === "user"
                  ? <UserBubble key={i} text={m.text} />
                  : <AiBubble key={m._id || i} msg={m} streaming={m._id === streamId} streamN={streamN} layout={layout}
                      onOpenCite={(c) => setPanelCites([c])} onOpenPanel={(cs) => setPanelCites(cs)} />
              )}
              {busy && <TypingIndicator />}
            </div>
          </div>
        )}
        <Composer model={model} setModel={setModel} onSend={send} busy={busy || streamId !== null} />
      </div>
      {layout === "panel" && panelCites && <SourcesPanel citations={panelCites} onClose={() => setPanelCites(null)} />}
    </div>
  );
}
