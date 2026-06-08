"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TopNav } from "./top-nav";
import { Chat } from "./chat";
import { DocumentLibrary } from "./documents";
import { SentimentPage } from "./sentiment";
import { AdminPanel } from "./admin";
import { BugReportModal } from "./bug-report-modal";

type Tab = "chat" | "documents" | "sentiment" | "admin";

export function AppShell() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chat");
  const [bugOpen, setBugOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid var(--border-strong)", borderTopColor: "var(--blue)", animation: "spin .7s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav tab={tab} setTab={setTab} onBug={() => setBugOpen(true)} />
      <main style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {tab === "chat"      && <Chat layout="classic" />}
        {tab === "documents" && <DocumentLibrary />}
        {tab === "sentiment" && <SentimentPage />}
        {tab === "admin"     && <AdminPanel />}
      </main>
      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
  );
}
