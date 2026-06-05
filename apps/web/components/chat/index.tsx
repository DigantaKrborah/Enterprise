"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Citation {
  doc_id:      string;
  doc_name:    string;
  chunk_index: number;
  page:        number | null;
  dept:        string;
  version:     number;
}

interface Message {
  id?:       string;
  role:      "user" | "assistant";
  content:   string;
  citations?: Citation[];
  llm_used?: string;
  streaming?: boolean;
}

interface Conversation {
  id:         string;
  title:      string;
  updated_at: string;
  department_filter: string | null;
}

type Layout = "classic" | "compact" | "panel";

// ── Citation renderers ─────────────────────────────────────────────────────────

function CitationChips({ citations, onOpen }: { citations: Citation[]; onOpen: (c: Citation) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 }}>
      {citations.map((c, i) => (
        <button key={i} onClick={() => onOpen(c)} className="cite-chip" style={citeChipStyle}>
          <Icon.file size={13} style={{ color: c.dept?.includes("HR") ? "var(--violet-bright)" : "var(--blue-bright)" }} />
          <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.doc_name}
          </span>
          <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>
            {c.page ? `p. ${c.page}` : `chunk ${c.chunk_index}`}
          </span>
        </button>
      ))}
    </div>
  );
}

function CitationCompact({ citations }: { citations: Citation[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--border)" }}>
      <Icon.cite size={14} style={{ color: "var(--text-faint)" }} />
      <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>Sources</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {citations.map((c, i) => (
          <span key={i} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            <sup style={{ color: "var(--blue-bright)", fontWeight: 700, marginRight: 2 }}>{i + 1}</sup>
            {c.doc_name} <span style={{ color: "var(--text-faint)" }}>{c.page ? `p.${c.page}` : ""}</span>
            {i < citations.length - 1 ? " · " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const citeChipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px",
  borderRadius: 999, border: "1px solid var(--border-1)", background: "var(--surface-1)",
  color: "var(--text-1)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .14s",
};

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
              <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{c.doc_name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Badge tone="blue">v{c.version}</Badge>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.page ? `Page ${c.page}` : `Chunk ${c.chunk_index}`}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Message bubbles ────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        maxWidth: "75%", padding: "11px 15px", borderRadius: "14px 14px 4px 14px",
        background: "var(--surface-2)", border: "1px solid var(--border-1)",
        fontSize: 14.5, lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap",
      }}>{text}</div>
    </div>
  );
}

function IconBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 7, border: 0, background: "transparent", color: "var(--text-faint)", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-strong)"; e.currentTarget.style.color = "var(--text-1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}>
      {children}
    </button>
  );
}

function AiBubble({ msg, layout, onOpenCite, onOpenPanel }: {
  msg: Message; layout: Layout;
  onOpenCite: (c: Citation) => void; onOpenPanel: (cs: Citation[]) => void;
}) {
  const showCites = !msg.streaming && msg.citations && msg.citations.length > 0;
  const modelLabel = msg.llm_used ? msg.llm_used.split("/")[0] : "RAGBot";

  return (
    <div className="fade-up" style={{ display: "flex", gap: 12 }}>
      <Avatar kind="ai" size={32} />
      <div style={{ flex: 1, minWidth: 0, maxWidth: "82%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text)" }}>RAGBot</span>
          <span style={{ fontSize: 10.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon.cpu size={11} /> {modelLabel}
          </span>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.62, color: "var(--text-1)", whiteSpace: "pre-wrap" }}>
          {msg.content}
          {msg.streaming && <span className="caret" />}
        </div>

        {showCites && layout === "classic" && <CitationChips citations={msg.citations!} onOpen={onOpenCite} />}
        {showCites && layout === "compact" && <CitationCompact citations={msg.citations!} />}
        {showCites && layout === "panel"   && (
          <button onClick={() => onOpenPanel(msg.citations!)} style={{ ...citeChipStyle, marginTop: 13 }}>
            <Icon.panel size={13} style={{ color: "var(--blue-bright)" }} />
            {msg.citations!.length} sources <Icon.chevron size={13} style={{ color: "var(--text-faint)" }} />
          </button>
        )}

        {!msg.streaming && (
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            <IconBtn title="Good response"><Icon.thumbUp size={14} /></IconBtn>
            <IconBtn title="Copy"><Icon.copy size={14} /></IconBtn>
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

// ── Composer ───────────────────────────────────────────────────────────────────

function Composer({ onSend, busy }: { onSend: (t: string) => void; busy: boolean }) {
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

// ── Sidebar ────────────────────────────────────────────────────────────────────

function ChatSidebar({ conversations, activeId, setActiveId, dept, setDept, onNew }: {
  conversations: Conversation[]; activeId: string | null;
  setActiveId: (id: string) => void; dept: string; setDept: (d: string) => void; onNew: () => void;
}) {
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
        {conversations.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 10px" }}>No conversations yet</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)} className={"convo" + (active ? " on" : "")}>
                {active && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2.5, borderRadius: 2, background: "var(--blue)" }} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.8, color: active ? "var(--text)" : "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                  {new Date(c.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="divider" />
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
        <Icon.doc size={13} /> <span>Ask from indexed documents</span>
      </div>
    </aside>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function ChatEmpty({ onPrompt }: { onPrompt: (q: string) => void }) {
  const suggestions = [
    { q: "What's the interlock sequence for a cold start on the CDU?", dept: "Operations" },
    { q: "How much parental leave am I eligible for?",                  dept: "HR" },
    { q: "What's the max depressurization rate on the hydrocracker?",   dept: "Operations" },
    { q: "Where do I report a workplace harassment concern?",           dept: "HR" },
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

// ── Main Chat ─────────────────────────────────────────────────────────────────

export function Chat({ layout = "classic" }: { layout?: Layout }) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [dept,          setDept]          = useState("All");
  const [busy,          setBusy]          = useState(false);
  const [retrieving,    setRetrieving]    = useState(false);
  const [panelCites,    setPanelCites]    = useState<Citation[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  const scrollDown = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };

  // Load conversation list
  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/conversations");
    if (res.ok) {
      const { data } = await res.json() as { data: Conversation[] };
      setConversations(data);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    fetch(`/api/chat/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then(({ data }: { data: Message[] }) => { setMessages(data ?? []); setTimeout(scrollDown, 100); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => { scrollDown(); }, [messages.length]);

  // Create new conversation and return its ID
  const createConversation = async (firstQuery: string): Promise<string> => {
    const deptFilter = dept !== "All" ? profile?.departmentId ?? null : null;
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: firstQuery.slice(0, 80), departmentFilter: deptFilter }),
    });
    const { data } = await res.json() as { data: Conversation };
    setConversations((prev) => [data, ...prev]);
    setActiveId(data.id);
    return data.id;
  };

  const send = async (text: string) => {
    if (busy) return;

    // Ensure we have a conversation
    let convId = activeId;
    if (!convId) {
      convId = await createConversation(text);
    }

    // Optimistically add user message
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    setRetrieving(true);
    setTimeout(scrollDown, 50);

    // Add placeholder AI message (streaming state)
    const aiMsgId = `streaming-${Date.now()}`;
    setMessages((m) => [...m, { id: aiMsgId, role: "assistant", content: "", streaming: true }]);

    setRetrieving(false);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, departmentFilter: dept !== "All" ? profile?.departmentId : undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: { message: "Request failed" } })) as { error?: { message?: string } };
        setMessages((m) => m.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, content: `Error: ${err.error?.message ?? "Unknown error"}`, streaming: false }
            : msg
        ));
        setBusy(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: "chunk" | "done" | "error";
              content?: string;
              citations?: Citation[];
              model?: string;
              tokens?: number;
              message?: string;
            };

            if (event.type === "chunk") {
              setMessages((m) => m.map((msg) =>
                msg.id === aiMsgId
                  ? { ...msg, content: msg.content + (event.content ?? "") }
                  : msg
              ));
              scrollDown();
            } else if (event.type === "done") {
              setMessages((m) => m.map((msg) =>
                msg.id === aiMsgId
                  ? { ...msg, streaming: false, citations: event.citations, llm_used: event.model }
                  : msg
              ));
              loadConversations(); // refresh sidebar titles
            } else if (event.type === "error") {
              setMessages((m) => m.map((msg) =>
                msg.id === aiMsgId
                  ? { ...msg, content: `Error: ${event.message}`, streaming: false }
                  : msg
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((m) => m.map((msg) =>
          msg.id === aiMsgId ? { ...msg, content: "Request failed. Please try again.", streaming: false } : msg
        ));
      }
    }

    setBusy(false);
  };

  const startNew = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setBusy(false);
    setRetrieving(false);
    setPanelCites(null);
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <ChatSidebar
        conversations={conversations} activeId={activeId}
        setActiveId={(id) => { abortRef.current?.abort(); setBusy(false); setActiveId(id); setPanelCites(null); }}
        dept={dept} setDept={setDept} onNew={startNew}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {messages.length === 0 ? (
          <ChatEmpty onPrompt={send} />
        ) : (
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "26px 0" }}>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 26 }}>
              {messages.map((m, i) =>
                m.role === "user"
                  ? <UserBubble key={i} text={m.content} />
                  : <AiBubble key={m.id ?? i} msg={m} layout={layout}
                      onOpenCite={(c) => setPanelCites([c])}
                      onOpenPanel={(cs) => setPanelCites(cs)} />
              )}
              {retrieving && <TypingIndicator />}
            </div>
          </div>
        )}
        <Composer onSend={send} busy={busy} />
      </div>
      {layout === "panel" && panelCites && <SourcesPanel citations={panelCites} onClose={() => setPanelCites(null)} />}
    </div>
  );
}
